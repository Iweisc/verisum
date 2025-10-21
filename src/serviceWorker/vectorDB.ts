import VectorDB from '../helpers/VectorDB';
import { Part } from '../helpers/extractWebsiteParts';
import { VectorDBStats } from '../helpers/types';

const db = new VectorDB<Part>();
const cache = new Map<
  string,
  { stats: VectorDBStats; initialized: number; entries: any[] }
>();

const queryCache = new Map<
  string,
  {
    sources: Array<{ content: string; id: string }>;
    documentParts: Array<string>;
    timestamp: number;
  }
>();

const QUERY_CACHE_TTL = 1800000;

const getCacheKey = (url: string, contentHash: string) =>
  `${url}:${contentHash}`;

export const initializeVectorDB = async (
  url: string,
  parts: Array<Part>
): Promise<VectorDBStats> => {
  const contentHash = parts
    .map((p) => p.content)
    .join('')
    .slice(0, 100);
  const cacheKey = getCacheKey(url, contentHash);

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.initialized < 3600000) {
    console.log('Using cached VectorDB');

    if (!db.entries.length) {
      console.log('Loading model for in-memory cache...');
      await db.setModel();
      db.entries = cached.entries;
      console.log('Model loaded for in-memory cache');
    }

    return cached.stats;
  }

  const stored = await chrome.storage.local.get(cacheKey);
  if (stored[cacheKey]) {
    const data = stored[cacheKey];
    if (Date.now() - data.initialized < 3600000) {
      console.log('Using stored VectorDB');
      cache.set(cacheKey, data);

      db.clear();

      console.log('Loading model for cached VectorDB...');
      await db.setModel();
      console.log('Model loaded for cached VectorDB');

      db.entries = data.entries;

      return data.stats;
    }
  }

  console.log('Initializing fresh VectorDB');
  console.log(`Found ${parts.length} parts, filtering paragraphs...`);
  db.clear();
  const onlyParagraphs = parts.filter((part) => part.tagName === 'p');
  console.log(`Processing ${onlyParagraphs.length} paragraphs`);

  console.log('Loading model...');
  await db.setModel();
  console.log('Generating embeddings...');
  await db.addEntries(
    onlyParagraphs.map((part) => ({ str: part.content, metadata: part }))
  );
  console.log('VectorDB initialization complete');

  const stats: VectorDBStats = {
    parsedCharacters: parts.reduce((acc, curr) => acc + curr.content.length, 0),
    entries: db.entries.length,
    sections: [...new Set(parts.map((p) => p.sectionId))].length,
  };

  const cacheData = {
    stats,
    initialized: Date.now(),
    entries: db.entries,
  };

  cache.set(cacheKey, cacheData);

  if (JSON.stringify(cacheData).length < 5000000) {
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
  if (!db.entries.length) {
    throw new Error('VectorDB not initialized. Please refresh the page.');
  }

  const queryCacheKey = query.toLowerCase().trim();
  const cached = queryCache.get(queryCacheKey);

  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL) {
    console.log('Using cached query result');
    return { sources: cached.sources, documentParts: cached.documentParts };
  }

  await db.setModel();

  const results = await db.search(query, 7, 0.5);

  const sources = results
    .map((result) => ({
      content: result[0].metadata.content,
      id: result[0].metadata.id,
    }))
    .filter((source) => Boolean(source.content));

  const sections = [
    ...new Set(results.map((result) => result[0].metadata.sectionId)),
  ];

  const dbEntries = sections.map((section) =>
    db.entries.filter((entry) => entry.metadata.sectionId === section)
  );

  const documentParts: Array<string> = dbEntries.map((entries) =>
    entries
      .filter((entry) => Boolean(entry.metadata.content))
      .map((entry) => entry.metadata.content)
      .join('\n')
  );

  queryCache.set(queryCacheKey, {
    sources,
    documentParts,
    timestamp: Date.now(),
  });

  return { sources, documentParts };
};
