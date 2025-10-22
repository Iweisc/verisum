import { Source } from '../helpers/types';
import { initializeVectorDB, queryVectorDB } from './vectorDB';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_BASE_URL = import.meta.env.VITE_OPENAI_BASE_URL;
const MODEL = import.meta.env.VITE_MODEL;

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
  const dbResponse = await queryVectorDB(query);

  const prompt = generatePrompt(dbResponse.documentParts, documentTitle, query);

  console.log(prompt);

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
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
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
