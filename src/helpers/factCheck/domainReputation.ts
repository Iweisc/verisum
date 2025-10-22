import { DomainReputationResult, DomainCategory } from './types';

const UNRELIABLE_DOMAINS = [
  'naturalnews.com',
  'infowars.com',
  'beforeitsnews.com',
  'dcgazette.com',
  'worldnewsdailyreport.com',
  'nationalreport.net',
  'empirenews.net',
  'clickhole.com',
  'theonion.com',
  'newsthump.com',
];

const SATIRE_DOMAINS = [
  'theonion.com',
  'clickhole.com',
  'newsthump.com',
  'thedailymash.co.uk',
  'babylonbee.com',
  'waterfallmagazine.com',
];

const MIXED_CREDIBILITY_DOMAINS = [
  'dailymail.co.uk',
  'nypost.com',
  'rt.com',
  'sputniknews.com',
  'breitbart.com',
  'huffpost.com',
];

const RELIABLE_DOMAINS = [
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'nytimes.com',
  'washingtonpost.com',
  'theguardian.com',
  'npr.org',
  'pbs.org',
  'cnn.com',
  'cbsnews.com',
  'nbcnews.com',
  'abcnews.go.com',
  'usatoday.com',
  'wsj.com',
  'ft.com',
  'economist.com',
  'nature.com',
  'science.org',
  'sciencedaily.com',
  'nih.gov',
  'cdc.gov',
  'who.int',
  'gov.uk',
  'wikipedia.org',
  'snopes.com',
  'factcheck.org',
  'politifact.com',
];

const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^www\./, '');
  }
};

const categorizeDomain = (domain: string): DomainCategory => {
  if (SATIRE_DOMAINS.includes(domain)) return 'satire';
  if (UNRELIABLE_DOMAINS.includes(domain)) return 'unreliable';
  if (RELIABLE_DOMAINS.includes(domain)) return 'reliable';
  if (MIXED_CREDIBILITY_DOMAINS.includes(domain)) return 'mixed';
  return 'unknown';
};

const getDomainScore = (category: DomainCategory): number => {
  switch (category) {
    case 'reliable':
      return 90;
    case 'mixed':
      return 60;
    case 'satire':
      return 30;
    case 'unreliable':
      return 10;
    case 'unknown':
      return 50;
  }
};

export const checkDomainReputation = (url: string): DomainReputationResult => {
  const domain = extractDomain(url);
  const category = categorizeDomain(domain);
  const score = getDomainScore(category);

  return {
    score,
    category,
    source: 'Local Database',
  };
};

export const addToUnreliableDomains = (domain: string): void => {
  const cleaned = extractDomain(domain);
  if (!UNRELIABLE_DOMAINS.includes(cleaned)) {
    UNRELIABLE_DOMAINS.push(cleaned);
  }
};

export const addToReliableDomains = (domain: string): void => {
  const cleaned = extractDomain(domain);
  if (!RELIABLE_DOMAINS.includes(cleaned)) {
    RELIABLE_DOMAINS.push(cleaned);
  }
};
