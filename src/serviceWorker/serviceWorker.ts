import { Source } from '../helpers/types';
import { initializeVectorDB, queryVectorDB } from './vectorDB';
import {
  runVerificationPipeline,
  createFlaggedClaim,
} from '../helpers/factCheck/verificationPipeline';
import { FlagRequest, FlaggedClaim } from '../helpers/factCheck/types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_BASE_URL = import.meta.env.VITE_OPENAI_BASE_URL;
const MODEL = import.meta.env.VITE_MODEL;
const GOOGLE_FACT_CHECK_API_KEY = import.meta.env
  .VITE_GOOGLE_FACT_CHECK_API_KEY;

const FACT_CHECK_STORAGE_KEY = 'verisum_fact_check_flags';

const factCheckCache = new Map<string, FlaggedClaim>();

const loadFlagsFromStorage = async (): Promise<void> => {
  const result = await chrome.storage.local.get(FACT_CHECK_STORAGE_KEY);
  const storedFlags = result[FACT_CHECK_STORAGE_KEY] || {};

  for (const [key, value] of Object.entries(storedFlags)) {
    factCheckCache.set(key, value as FlaggedClaim);
  }
};

const saveFlagsToStorage = async (): Promise<void> => {
  const flagsObject: Record<string, FlaggedClaim> = {};

  for (const [key, value] of factCheckCache.entries()) {
    flagsObject[key] = value;
  }

  await chrome.storage.local.set({ [FACT_CHECK_STORAGE_KEY]: flagsObject });
};

loadFlagsFromStorage();

const extractCitedSources = (
  answer: string,
  allSources: Array<Source>
): Array<Source> => {
  const citedIndices = new Set<number>();
  const citationRegex = /\[(\d+)\]/g;
  let match;

  while ((match = citationRegex.exec(answer)) !== null) {
    const index = parseInt(match[1]) - 1;
    if (index >= 0 && index < allSources.length) {
      citedIndices.add(index);
    }
  }

  return Array.from(citedIndices)
    .sort((a, b) => a - b)
    .map((index) => allSources[index]);
};

const generatePrompt = (
  documents: Array<string>,
  title: string,
  query: string
) =>
  `INSTRUCTIONS:
You are answering questions about the website "${title}".
Answer the QUESTION using ONLY the DOCUMENT text below.
Keep your answer VERY SHORT and CONCISE (1-2 sentences maximum).
Only state the essential facts - no explanations or elaborations.
IMPORTANT: Cite your sources by adding [1], [2], etc. after each fact from that source.
If the DOCUMENT doesn't contain the answer, say "I don't have that information."

DOCUMENT:
${documents.map((document, index) => `[${index + 1}] ${document}`).join('\n\n')}

QUESTION:
${query}`;

const runLanguageModel = async (
  query: string,
  documentTitle: string,
  callback?: ({
    answer,
    sources,
    prompt,
  }: {
    answer: string;
    sources: Array<Source>;
    prompt: string;
  }) => void
): Promise<{
  answer: string;
  sources: Array<Source>;
  prompt: string;
}> => {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Invalid query provided to runLanguageModel');
  }

  if (!documentTitle || typeof documentTitle !== 'string') {
    throw new Error('Invalid documentTitle provided to runLanguageModel');
  }

  if (!OPENAI_API_KEY || !OPENAI_BASE_URL || !MODEL) {
    throw new Error('OpenAI API not configured. Check environment variables.');
  }

  const dbResponse = await queryVectorDB(query);

  const prompt = generatePrompt(dbResponse.documentParts, documentTitle, query);

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise AI assistant. Always give short, direct answers. Maximum 1-2 sentences.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: !!callback,
    }),
  });

  let answer = '';

  if (callback) {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                answer += content;
                const citedSources = extractCitedSources(
                  answer,
                  dbResponse.sources
                );
                callback({
                  answer,
                  sources: citedSources,
                  prompt,
                });
              }
            } catch (e) {}
          }
        }
      }
    }
  } else {
    const data = await response.json();
    answer = data.choices[0]?.message?.content || '';
  }

  const citedSources = extractCitedSources(answer, dbResponse.sources);

  return {
    answer,
    sources: citedSources,
    prompt,
  };
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'initializeVectorDB') {
    const { url, parts } = request.payload;
    initializeVectorDB(url, parts)
      .then((stats) => sendResponse({ stats }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'queryVectorDBInWorker') {
    const { query } = request.payload;
    queryVectorDB(query)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'checkLanguageModelAvailability') {
    sendResponse(true);
    return true;
  }

  if (request.action === 'runLanguageModel') {
    const { query, documentTitle } = request.payload;
    runLanguageModel(query, documentTitle)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'verifyFactCheck') {
    const flagRequest: FlagRequest = request.payload;
    const cacheKey = `${flagRequest.url}:${flagRequest.text}`;

    if (factCheckCache.has(cacheKey)) {
      sendResponse({ claim: factCheckCache.get(cacheKey) });
      return true;
    }

    runVerificationPipeline(flagRequest, GOOGLE_FACT_CHECK_API_KEY)
      .then(async (verificationResults) => {
        const claim = createFlaggedClaim(flagRequest, verificationResults);
        factCheckCache.set(cacheKey, claim);
        await saveFlagsToStorage();
        sendResponse({ claim });
      })
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getAllFactCheckFlags') {
    const flags = Array.from(factCheckCache.values());
    sendResponse({ flags });
    return true;
  }

  if (request.action === 'clearFactCheckCache') {
    factCheckCache.clear();
    chrome.storage.local.remove(FACT_CHECK_STORAGE_KEY);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getFlagsForUrl') {
    const { url } = request.payload;
    const urlFlags: FlaggedClaim[] = [];

    for (const [key, claim] of factCheckCache.entries()) {
      if (claim.url === url) {
        urlFlags.push(claim);
      }
    }

    sendResponse({ flags: urlFlags });
    return true;
  }

  if (request.action === 'scanPageForMisinformation') {
    const { tabId } = request.payload;

    (async () => {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'extractWebsiteParts',
        });

        if (!response?.parts || response.parts.length === 0) {
          sendResponse({ error: 'Failed to extract page content' });
          return;
        }

        const { parts, url, documentTitle } = response;
        const pageContent = parts.map((p: any) => p.content).join('\n\n');

        const factCheckPrompt = `You are a fact-checking AI. Analyze the following webpage content and identify ALL false, misleading, or unverifiable claims.

For each claim you identify:
1. Quote the EXACT text (word-for-word)
2. Explain why it's false/misleading
3. Rate confidence (0-100)
4. Classify as: FALSE, MISLEADING, or UNVERIFIED

WEBPAGE TITLE: ${documentTitle}

CONTENT:
${pageContent}

Respond in JSON format:
{
  "claims": [
    {
      "text": "exact quote from content",
      "reason": "why this is false/misleading",
      "confidence": 95,
      "verdict": "FALSE"
    }
  ]
}

Be thorough and flag EVERYTHING suspicious, even if it seems absurd.`;

        const llmResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: 'system',
                content:
                  'You are a fact-checking expert. Identify misinformation accurately.',
              },
              {
                role: 'user',
                content: factCheckPrompt,
              },
            ],
            temperature: 0.3,
          }),
        });

        const llmData = await llmResponse.json();
        const llmText = llmData.choices[0]?.message?.content || '';

        let flaggedClaims: any[] = [];
        try {
          const jsonMatch = llmText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            flaggedClaims = parsed.claims || [];
          }
        } catch (e) {}

        const scannedClaims: FlaggedClaim[] = [];

        for (const llmClaim of flaggedClaims) {
          const claimWords = llmClaim.text
            .toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length > 3);
          const matchingPart = parts.find((p: any) => {
            const partLower = p.content.toLowerCase();
            const matchedWords = claimWords.filter((word: string) =>
              partLower.includes(word)
            );
            return matchedWords.length >= Math.min(5, claimWords.length * 0.6);
          });

          if (!matchingPart) {
            continue;
          }

          const cacheKey = `${url}:${llmClaim.text}`;

          const flagRequest: FlagRequest = {
            text: llmClaim.text,
            context: matchingPart.content,
            reason: llmClaim.reason,
            elementId: matchingPart.id,
            url: url,
          };

          const verificationResults = {
            llmAnalysis: {
              verdict: llmClaim.verdict,
              confidence: llmClaim.confidence,
              reasoning: llmClaim.reason,
            },
          };

          const claim = createFlaggedClaim(flagRequest, verificationResults);
          factCheckCache.set(cacheKey, claim);
          await saveFlagsToStorage();
          scannedClaims.push(claim);

          try {
            await chrome.tabs.sendMessage(tabId, {
              action: 'highlightMisinformation',
              payload: {
                elementId: claim.elementId,
                flagId: claim.id,
                verdict: claim.verdict,
                confidence: claim.confidence,
                reason: llmClaim.reason,
              },
            });
          } catch (e) {}
        }

        sendResponse({ success: true, flagsFound: scannedClaims.length });
      } catch (error: any) {
        sendResponse({ error: error.message || 'Scan failed' });
      }
    })();

    return true;
  }

  return false;
});

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (request) => {
    if (request.action === 'runLanguageModelStream') {
      const { query, documentTitle } = request.payload;
      runLanguageModel(query, documentTitle, (response) => {
        port.postMessage({ ...response, done: false });
      })
        .then((response) => {
          port.postMessage({ ...response, done: true });
          port.disconnect();
        })
        .catch((error) => {
          port.postMessage({ error: error.message, done: true });
          port.disconnect();
        });
    } else if (request.action === 'generateTTS') {
      const { text, voice, speed } = request.payload;

      try {
        const TTS_API_URL = import.meta.env.VITE_TTS_API_URL;
        const TTS_API_KEY = import.meta.env.VITE_TTS_API_KEY;

        if (!TTS_API_URL || !TTS_API_KEY) {
          port.postMessage({
            action: 'tts-error',
            error: 'TTS API not configured',
            messageId: request.messageId,
          });
          return;
        }

        const response = await fetch(`${TTS_API_URL}/api/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TTS_API_KEY,
          },
          body: JSON.stringify({
            text,
            voice: voice || 'default',
            speed: speed || 1.0,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          port.postMessage({
            action: 'tts-error',
            error: `TTS API error: ${response.status}`,
            messageId: request.messageId,
          });
          return;
        }

        const audioData = await response.arrayBuffer();

        port.postMessage({
          action: 'tts-audio',
          audioData,
          messageId: request.messageId,
          done: true,
        });
      } catch (error: any) {
        port.postMessage({
          action: 'tts-error',
          error: error?.message || 'Unknown TTS error',
          messageId: request.messageId,
        });
      }
    }
  });
});
