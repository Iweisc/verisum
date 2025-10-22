import {
  VerificationResult,
  Verdict,
  FlagRequest,
  FlaggedClaim,
} from './types';
import { checkWithGoogleFactCheck } from './googleFactCheckAPI';
import { verifyWithWikipedia } from './wikipediaVerify';
import { checkDomainReputation } from './domainReputation';

const CONFIDENCE_SCORES = {
  GOOGLE_FACT_CHECK_FALSE: 95,
  GOOGLE_FACT_CHECK_MOSTLY_FALSE: 70,
  GOOGLE_FACT_CHECK_TRUE: 10,
  GOOGLE_FACT_CHECK_DEFAULT: 50,
  WIKIPEDIA_CONSISTENT: 20,
  WIKIPEDIA_INCONSISTENT: 60,
  DOMAIN_UNRELIABLE: 70,
  DOMAIN_SATIRE: 50,
  DOMAIN_MIXED: 40,
  DOMAIN_RELIABLE: 10,
  DOMAIN_DEFAULT: 30,
  WIKIPEDIA_CONSISTENCY_THRESHOLD: 0.3,
  DOMAIN_CONFIDENCE_THRESHOLD: 60,
  MISLEADING_CONFIDENCE_THRESHOLD: 50,
} as const;

const calculateConfidence = (result: VerificationResult): number => {
  let confidence = 0;
  let factors = 0;

  if (result.googleFactCheck?.found) {
    factors++;
    const rating = result.googleFactCheck.rating?.toLowerCase() || '';
    if (
      rating.includes('false') ||
      rating.includes('misleading') ||
      rating.includes('pants on fire')
    ) {
      confidence += CONFIDENCE_SCORES.GOOGLE_FACT_CHECK_FALSE;
    } else if (
      rating.includes('mostly false') ||
      rating.includes('half true')
    ) {
      confidence += CONFIDENCE_SCORES.GOOGLE_FACT_CHECK_MOSTLY_FALSE;
    } else if (rating.includes('true') || rating.includes('correct')) {
      confidence += CONFIDENCE_SCORES.GOOGLE_FACT_CHECK_TRUE;
    } else {
      confidence += CONFIDENCE_SCORES.GOOGLE_FACT_CHECK_DEFAULT;
    }
  }

  if (result.wikipediaCheck) {
    factors++;
    confidence += result.wikipediaCheck.consistent
      ? CONFIDENCE_SCORES.WIKIPEDIA_CONSISTENT
      : CONFIDENCE_SCORES.WIKIPEDIA_INCONSISTENT;
  }

  if (result.domainReputation) {
    factors++;
    if (result.domainReputation.category === 'unreliable') {
      confidence += CONFIDENCE_SCORES.DOMAIN_UNRELIABLE;
    } else if (result.domainReputation.category === 'satire') {
      confidence += CONFIDENCE_SCORES.DOMAIN_SATIRE;
    } else if (result.domainReputation.category === 'mixed') {
      confidence += CONFIDENCE_SCORES.DOMAIN_MIXED;
    } else if (result.domainReputation.category === 'reliable') {
      confidence += CONFIDENCE_SCORES.DOMAIN_RELIABLE;
    } else {
      confidence += CONFIDENCE_SCORES.DOMAIN_DEFAULT;
    }
  }

  if (result.llmAnalysis) {
    factors++;
    confidence += result.llmAnalysis.confidence;
  }

  return factors > 0 ? Math.round(confidence / factors) : 50;
};

const determineVerdict = (
  result: VerificationResult,
  confidence: number
): Verdict => {
  if (result.googleFactCheck?.found) {
    const rating = result.googleFactCheck.rating?.toLowerCase() || '';
    if (rating.includes('false') || rating.includes('pants on fire')) {
      return 'FALSE';
    } else if (
      rating.includes('misleading') ||
      rating.includes('mostly false') ||
      rating.includes('half true')
    ) {
      return 'MISLEADING';
    } else if (
      rating.includes('true') ||
      rating.includes('correct') ||
      rating.includes('mostly true')
    ) {
      return 'TRUE';
    }
  }

  if (
    result.domainReputation?.category === 'unreliable' &&
    confidence > CONFIDENCE_SCORES.DOMAIN_CONFIDENCE_THRESHOLD
  ) {
    return 'FALSE';
  }

  if (result.domainReputation?.category === 'satire') {
    return 'MISLEADING';
  }

  if (
    !result.wikipediaCheck?.consistent &&
    confidence > CONFIDENCE_SCORES.MISLEADING_CONFIDENCE_THRESHOLD
  ) {
    return 'MISLEADING';
  }

  if (result.llmAnalysis) {
    return result.llmAnalysis.verdict;
  }

  return 'UNVERIFIED';
};

export const runVerificationPipeline = async (
  request: FlagRequest,
  googleApiKey?: string,
  includeWikipedia: boolean = true,
  includeDomainCheck: boolean = true
): Promise<VerificationResult> => {
  if (!request || !request.text || typeof request.text !== 'string') {
    throw new Error('Invalid flag request: text is required');
  }

  if (!request.url || typeof request.url !== 'string') {
    throw new Error('Invalid flag request: url is required');
  }

  const results: VerificationResult = {};

  const googlePromise = googleApiKey
    ? checkWithGoogleFactCheck(request.text, googleApiKey)
    : Promise.resolve({ found: false });

  const wikipediaPromise = includeWikipedia
    ? verifyWithWikipedia(request.text)
    : Promise.resolve(null);

  const domainPromise = includeDomainCheck
    ? Promise.resolve(checkDomainReputation(request.url))
    : Promise.resolve(null);

  const [googleResult, wikipediaResult, domainResult] = await Promise.all([
    googlePromise,
    wikipediaPromise,
    domainPromise,
  ]);

  if (googleResult.found || googleApiKey) {
    results.googleFactCheck = googleResult;
  }

  if (wikipediaResult) {
    results.wikipediaCheck = wikipediaResult;
  }

  if (domainResult) {
    results.domainReputation = domainResult;
  }

  return results;
};

const generateShortReason = (
  verificationResults: VerificationResult,
  verdict: Verdict,
  userReason?: string
): string => {
  if (userReason && userReason.length <= 50) {
    return userReason.split(' ').slice(0, 7).join(' ');
  }

  if (verificationResults.googleFactCheck?.found) {
    return verificationResults.googleFactCheck.rating || 'Fact-check flagged';
  }

  if (verificationResults.domainReputation?.category === 'unreliable') {
    return 'Unreliable source';
  }

  if (verificationResults.domainReputation?.category === 'satire') {
    return 'Satire content';
  }

  if (
    verificationResults.wikipediaCheck &&
    !verificationResults.wikipediaCheck.consistent
  ) {
    return 'Contradicts verified sources';
  }

  if (verificationResults.llmAnalysis?.reasoning) {
    const words = verificationResults.llmAnalysis.reasoning.split(' ');
    return words.slice(0, 7).join(' ');
  }

  if (verdict === 'FALSE') return 'Likely false information';
  if (verdict === 'MISLEADING') return 'Potentially misleading content';
  return 'Unverified claim';
};

export const createFlaggedClaim = (
  request: FlagRequest,
  verificationResults: VerificationResult
): FlaggedClaim => {
  const confidence = calculateConfidence(verificationResults);
  const verdict = determineVerdict(verificationResults, confidence);
  const shortReason = generateShortReason(
    verificationResults,
    verdict,
    request.reason
  );

  return {
    id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text: request.text,
    elementId: request.elementId,
    context: request.context,
    userReason: shortReason,
    url: request.url,
    verificationResults,
    confidence,
    verdict,
    timestamp: Date.now(),
  };
};
