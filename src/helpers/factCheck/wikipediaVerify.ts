import { WikipediaCheckResult } from './types';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_SEARCH_LIMIT = 3;
const WIKIPEDIA_MAX_RESULTS = 2;
const WIKIPEDIA_MIN_WORD_LENGTH = 4;
const WIKIPEDIA_CONSISTENCY_THRESHOLD = 0.3;
const WIKIPEDIA_MIN_ENTITY_LENGTH = 2;
const WIKIPEDIA_MAX_ENTITIES = 3;

interface WikiSearchResult {
  title: string;
  snippet: string;
}

const extractNamedEntities = (text: string): string[] => {
  const entities: string[] = [];

  const capitalizedWords =
    text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  entities.push(...capitalizedWords);

  const numbers = text.match(/\b\d{4}\b/g) || [];
  entities.push(...numbers);

  return [...new Set(entities)].filter(
    (e) => e.length > WIKIPEDIA_MIN_ENTITY_LENGTH
  );
};

const searchWikipedia = async (query: string): Promise<WikiSearchResult[]> => {
  try {
    const url = new URL(WIKIPEDIA_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('srlimit', String(WIKIPEDIA_SEARCH_LIMIT));

    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const data = await response.json();
    return data.query?.search || [];
  } catch (error) {
    return [];
  }
};

const getWikipediaExtract = async (title: string): Promise<string | null> => {
  try {
    const url = new URL(WIKIPEDIA_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'extracts');
    url.searchParams.set('exintro', 'true');
    url.searchParams.set('explaintext', 'true');
    url.searchParams.set('titles', title);
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    return pages[pageId]?.extract || null;
  } catch (error) {
    return null;
  }
};

export const verifyWithWikipedia = async (
  claimText: string
): Promise<WikipediaCheckResult> => {
  if (
    !claimText ||
    typeof claimText !== 'string' ||
    claimText.trim().length === 0
  ) {
    return {
      consistent: false,
      sources: [],
      summary: 'Invalid claim text provided',
    };
  }

  try {
    const entities = extractNamedEntities(claimText);

    if (entities.length === 0) {
      return {
        consistent: false,
        sources: [],
        summary: 'No verifiable entities found',
      };
    }

    const searchQuery = entities.slice(0, WIKIPEDIA_MAX_ENTITIES).join(' ');
    const searchResults = await searchWikipedia(searchQuery);

    if (searchResults.length === 0) {
      return {
        consistent: false,
        sources: [],
        summary: 'No Wikipedia articles found',
      };
    }

    const sources: string[] = [];
    let foundContent = '';

    for (const result of searchResults.slice(0, WIKIPEDIA_MAX_RESULTS)) {
      const extract = await getWikipediaExtract(result.title);
      if (extract) {
        sources.push(
          `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`
        );
        foundContent += extract.toLowerCase() + ' ';
      }
    }

    const claimLower = claimText.toLowerCase();
    const words = claimLower
      .split(/\s+/)
      .filter((w) => w.length > WIKIPEDIA_MIN_WORD_LENGTH);
    const matchingWords = words.filter((word) => foundContent.includes(word));
    const consistency = matchingWords.length / Math.max(words.length, 1);

    return {
      consistent: consistency > WIKIPEDIA_CONSISTENCY_THRESHOLD,
      sources,
      summary:
        consistency > WIKIPEDIA_CONSISTENCY_THRESHOLD
          ? `Found ${sources.length} related Wikipedia articles`
          : 'Claim not supported by Wikipedia content',
    };
  } catch (error) {
    return {
      consistent: false,
      sources: [],
      summary: 'Error verifying with Wikipedia',
    };
  }
};
