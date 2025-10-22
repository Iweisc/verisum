import { GoogleFactCheckResult } from './types';

const GOOGLE_FACT_CHECK_API =
  'https://factchecktools.googleapis.com/v1alpha1/claims:search';

export const checkWithGoogleFactCheck = async (
  query: string,
  apiKey?: string
): Promise<GoogleFactCheckResult> => {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { found: false };
  }

  if (!apiKey) {
    return { found: false };
  }

  try {
    const url = new URL(GOOGLE_FACT_CHECK_API);
    url.searchParams.set('query', query);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { found: false };
    }

    const data = await response.json();

    if (!data.claims || data.claims.length === 0) {
      return { found: false };
    }

    const firstClaim = data.claims[0];
    const claimReview = firstClaim.claimReview?.[0];

    return {
      found: true,
      rating: claimReview?.textualRating || 'Unknown',
      url: claimReview?.url,
      claimReview: firstClaim.text,
      publisher: claimReview?.publisher?.name,
    };
  } catch (error) {
    return { found: false };
  }
};
