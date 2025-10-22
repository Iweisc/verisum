import VectorDB from '../helpers/VectorDB';
import { Part } from '../helpers/extractWebsiteParts';
import { VectorDBStats } from '../helpers/types';

const db = new VectorDB<Part>();
const cache = new Map<
  string,
  { url: string; stats: VectorDBStats; initialized: number; entries: any[] }
>();

const queryCache = new Map<
  string,
  {
    sources: Array<{ content: string; id: string }>;
    documentParts: Array<string>;
    timestamp: number;
  }
>();

const CACHE_CONFIG = {
  QUERY_TTL: 1800000,
  DB_TTL: 3600000,
  MAX_STORAGE_SIZE: 5000000,
  SEARCH_RESULTS: 7,
  MIN_SIMILARITY: 0.5,
} as const;

const getCacheKey = (url: string, contentHash: string) =>
  `${url}:${contentHash}`;

export const initializeVectorDB = async (
  url: string,
  parts: Array<Part>
): Promise<VectorDBStats> => {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided to initializeVectorDB');
  }

  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error(
      'Invalid or empty parts array provided to initializeVectorDB'
    );
  }

  const allContent = parts.map((p) => p.content).join('');
  const contentHash = `${allContent.length}_${allContent.slice(0, 100)}_${allContent.slice(-50)}`;
  const cacheKey = getCacheKey(url, contentHash);

  const cached = cache.get(cacheKey);
  if (
    cached &&
    cached.url === url &&
    Date.now() - cached.initialized < CACHE_CONFIG.DB_TTL
  ) {
    if (!db.entries.length) {
      await db.setModel();
      db.entries = cached.entries;
    }

    return cached.stats;
  }

  const stored = await chrome.storage.local.get(cacheKey);
  if (stored[cacheKey]) {
    const data = stored[cacheKey];
    if (
      data.url === url &&
      Date.now() - data.initialized < CACHE_CONFIG.DB_TTL
    ) {
      cache.set(cacheKey, data);

      db.clear();

      await db.setModel();

      db.entries = data.entries;

      return data.stats;
    }
  }

  db.clear();
  const onlyParagraphs = parts.filter((part) => part.tagName === 'p');

  await db.setModel();
  await db.addEntries(
    onlyParagraphs.map((part) => ({ str: part.content, metadata: part }))
  );

  const stats: VectorDBStats = {
    parsedCharacters: parts.reduce((acc, curr) => acc + curr.content.length, 0),
    entries: db.entries.length,
    sections: [...new Set(parts.map((p) => p.sectionId))].length,
  };

  const cacheData = {
    url,
    stats,
    initialized: Date.now(),
    entries: db.entries,
  };

  cache.set(cacheKey, cacheData);

  if (JSON.stringify(cacheData).length < CACHE_CONFIG.MAX_STORAGE_SIZE) {
    await chrome.storage.local.set({ [cacheKey]: cacheData });
  }

  return stats;
};

export const queryVectorDB = async (
  query: string
): Promise<{
  sources: Array<{ content: string; id: string }>;
  documentParts: Array<string>;
}> => {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Invalid query provided to queryVectorDB');
  }

  if (!db.entries.length) {
    throw new Error('VectorDB not initialized. Please refresh the page.');
  }

  const queryCacheKey = query.toLowerCase().trim();
  const cached = queryCache.get(queryCacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.QUERY_TTL) {
    return { sources: cached.sources, documentParts: cached.documentParts };
  }

  await db.setModel();

  const results = await db.search(
    query,
    CACHE_CONFIG.SEARCH_RESULTS,
    CACHE_CONFIG.MIN_SIMILARITY
  );

  const sources = results
    .map((result) => ({
      content: result[0].metadata.content,
      id: result[0].metadata.id,
    }))
    .filter((source) => Boolean(source.content));

  const documentParts: Array<string> = results
    .map((result) => result[0].metadata.content)
    .filter((content) => Boolean(content));

  queryCache.set(queryCacheKey, {
    sources,
    documentParts,
    timestamp: Date.now(),
  });

  return { sources, documentParts };
};
