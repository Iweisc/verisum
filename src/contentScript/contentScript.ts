import { renderApp, removeApp } from './App';
import extractWebsiteParts from '../helpers/extractWebsiteParts';
import highlightParagraph from '../helpers/highlightParagraph';
import { render, createElement } from 'preact';
import Spotlight from './Spotlight';
import { runLanguageModelStreamInServiceWorker } from '../helpers/chromeMessages';

let spotlightOpen = false;
const SPOTLIGHT_ID = 'verisum-spotlight';

const toggleSpotlight = () => {
  if (spotlightOpen) {
    closeSpotlight();
  } else {
    openSpotlight();
  }
};

const openSpotlight = async () => {
  if (spotlightOpen) return;

  const container = document.createElement('div');
  container.id = SPOTLIGHT_ID;
  document.body.appendChild(container);

  const handleSubmit = async (
    query: string,
    callback?: (response: { answer: string; sources: any[] }) => void
  ) => {
    try {
      return await runLanguageModelStreamInServiceWorker(
        query,
        document.title,
        callback
      );
    } catch (error: any) {
      if (error?.message?.includes('VectorDB not initialized')) {
        const main =
          document.querySelector('main') || document.querySelector('body');
        const parts = extractWebsiteParts(main);

        await chrome.runtime.sendMessage({
          action: 'initializeVectorDB',
          payload: { url: window.location.href, parts },
        });

        return await runLanguageModelStreamInServiceWorker(
          query,
          document.title,
          callback
        );
      }
      throw error;
    }
  };

  render(
    createElement(Spotlight, {
      onClose: closeSpotlight,
      onSubmit: handleSubmit,
    }),
    container
  );
  spotlightOpen = true;
};

const closeSpotlight = () => {
  const container = document.getElementById(SPOTLIGHT_ID);
  if (container) {
    render(null, container);
    container.remove();
  }
  spotlightOpen = false;
};

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.code === 'Space') {
    e.preventDefault();
    toggleSpotlight();
  }

  if (e.code === 'Escape' && spotlightOpen) {
    closeSpotlight();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle-spotlight') {
    toggleSpotlight();
    sendResponse();
  }

  if (message.action === 'extractWebsiteParts') {
    const main =
      document.querySelector('main') || document.querySelector('body');
    const parts = extractWebsiteParts(main);
    sendResponse({
      parts,
      documentTitle: document.title,
      url: window.location.href,
    });
  }

  if (message.action === 'highlight') {
    highlightParagraph(message.payload.id);
    sendResponse();
  }

  if (message.action === 'conversationMode') {
    const id = 'ask-my-website';
    if (message.payload === true) {
      renderApp(id);
    } else if (message.payload === false) {
      removeApp(id);
    }
    sendResponse();
  }

  return true;
});
