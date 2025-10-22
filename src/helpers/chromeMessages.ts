import { Source, VectorDBStats } from './types';

const sendMessageToContent = <T = {}>(
  action: string,
  payload?: any,
  retries: number = 0
): Promise<T> =>
  new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const tabId = tabs[0].id;

          if (!tabId) {
            reject(new Error('No tab ID found'));
            return;
          }

          chrome.tabs.sendMessage(tabId, { action, payload }, (response) => {
            if (chrome.runtime.lastError) {
              if (retries < 5) {
                setTimeout(() => {
                  sendMessageToContent<T>(action, payload, retries + 1)
                    .then(resolve)
                    .catch(reject);
                }, 300);
              } else {
                reject(
                  new Error(
                    'Content script not responding. Please refresh the page and try again.'
                  )
                );
              }
            } else {
              resolve(response);
            }
          });
        } else {
          reject(new Error('No active tab found'));
        }
      });
    } catch (e) {
      reject(e);
    }
  });

export const getInitializeVectorDBFromContent = async (): Promise<{
  dbStats: VectorDBStats;
  dbResponse: null;
  documentTitle: string;
}> => {
  const { parts, documentTitle, url } = await sendMessageToContent<{
    parts: Array<any>;
    documentTitle: string;
    url: string;
  }>('extractWebsiteParts');

  const { stats, error } = await new Promise<{
    stats: VectorDBStats;
    error?: string;
  }>((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'initializeVectorDB',
        payload: { url, parts },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      }
    );
  });

  return {
    dbStats: stats,
    dbResponse: null,
    documentTitle,
  };
};

export const getQueryResponseFromContent = async (
  query: string
): Promise<{
  dbStats: VectorDBStats;
  dbResponse: {
    sources: Array<{ content: string; id: string }>;
    documentParts: Array<string>;
  };
  documentTitle: string;
}> => {
  const dbResponse = await new Promise<{
    sources: Array<{ content: string; id: string }>;
    documentParts: Array<string>;
  }>((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'queryVectorDBInWorker',
        payload: { query },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      }
    );
  });

  return {
    dbStats: { parsedCharacters: 0, entries: 0, sections: 0 },
    dbResponse,
    documentTitle: '',
  };
};

export const getConversationModeFromContent = async (): Promise<boolean> =>
  sendMessageToContent<boolean>('conversationMode');

export const setConversationModeFromContent = async (
  active: boolean
): Promise<boolean> =>
  sendMessageToContent<boolean>('conversationMode', active);

export const highlightParagraphFromContent = async (
  id: string
): Promise<void> => {
  return sendMessageToContent<void>('highlight', { id });
};

export const runLanguageModelInServiceWorker = (
  query: string
): Promise<{
  answer: string;
  sources: Array<Source>;
  prompt: string;
}> =>
  new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        {
          action: 'runLanguageModel',
          payload: { query },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    } catch (e) {
      reject(e);
    }
  });

export const getLanguageModelAvailabilityInServiceWorker =
  (): Promise<AICapabilityAvailability> =>
    new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          {
            action: 'checkLanguageModelAvailability',
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      } catch (e) {
        reject(e);
      }
    });

export const runLanguageModelStreamInServiceWorker = (
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
}> =>
  new Promise((resolve, reject) => {
    try {
      const port = chrome.runtime.connect();
      port.postMessage({
        action: 'runLanguageModelStream',
        payload: { query, documentTitle },
      });
      port.onMessage.addListener(
        (resp: {
          answer?: string;
          sources?: Array<Source>;
          prompt?: string;
          done: boolean;
          error?: string;
        }) => {
          if (resp.error) {
            reject(new Error(resp.error));
            return;
          }

          if (callback && resp.answer && resp.sources && resp.prompt) {
            callback({
              answer: resp.answer,
              sources: resp.sources,
              prompt: resp.prompt,
            });
          }

          if (resp.done && resp.answer && resp.sources && resp.prompt) {
            resolve({
              answer: resp.answer,
              sources: resp.sources,
              prompt: resp.prompt,
            });
          }
        }
      );
    } catch (e) {
      reject(e);
    }
  });
