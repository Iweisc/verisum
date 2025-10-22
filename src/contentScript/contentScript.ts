import { renderApp, removeApp } from './App';
import extractWebsiteParts from '../helpers/extractWebsiteParts';
import highlightParagraph from '../helpers/highlightParagraph';
import { render, createElement } from 'preact';
import Spotlight from './Spotlight';
import { runLanguageModelStreamInServiceWorker } from '../helpers/chromeMessages';
import FlagMenu from './FlagMenu';
import {
  highlightMisinformation,
  removeHighlight,
  clearAllHighlights,
  scrollToHighlight,
} from '../helpers/highlightMisinformation';
import { FlagRequest } from '../helpers/factCheck/types';

let spotlightOpen = false;
const SPOTLIGHT_ID = 'verisum-spotlight';
const FLAG_MENU_ID = 'verisum-flag-menu';
let spotlightState: {
  query: string;
  answer: string;
  sources: Array<{ content: string; id: string }>;
} = {
  query: '',
  answer: '',
  sources: [],
};

let flagMenuOpen = false;
let selectedTextData: {
  text: string;
  elementId: string;
  context: string;
} | null = null;

const restoreFlagsForCurrentPage = async () => {
  try {
    const main =
      document.querySelector('main') || document.querySelector('body');
    if (!main) return;

    const parts = extractWebsiteParts(main);

    const response = await chrome.runtime.sendMessage({
      action: 'getFlagsForUrl',
      payload: { url: window.location.href },
    });

    if (response.flags && response.flags.length > 0) {
      for (const claim of response.flags) {
        highlightMisinformation(
          claim.elementId,
          claim.id,
          claim.verdict,
          claim.confidence,
          claim.userReason
        );
      }
    }
  } catch (error) {
    console.error('Error restoring flags:', error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(restoreFlagsForCurrentPage, 500);
  });
} else {
  setTimeout(restoreFlagsForCurrentPage, 500);
}

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
        if (!main) throw error;

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
      initialState: spotlightState,
      onStateChange: (state) => {
        spotlightState = state;
      },
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

const openFlagMenu = (x: number, y: number) => {
  if (!selectedTextData) return;

  const container = document.createElement('div');
  container.id = FLAG_MENU_ID;
  document.body.appendChild(container);

  const handleSubmit = async (reason: string) => {
    if (!selectedTextData) return;

    const flagRequest: FlagRequest = {
      text: selectedTextData.text,
      context: selectedTextData.context,
      reason,
      elementId: selectedTextData.elementId,
      url: window.location.href,
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'verifyFactCheck',
        payload: flagRequest,
      });

      if (response.claim) {
        highlightMisinformation(
          response.claim.elementId,
          response.claim.id,
          response.claim.verdict,
          response.claim.confidence,
          response.claim.userReason
        );
      }

      closeFlagMenu();
    } catch (error) {
      console.error('Error verifying fact check:', error);
      closeFlagMenu();
    }
  };

  render(
    createElement(FlagMenu, {
      selectedText: selectedTextData.text,
      position: { x, y },
      onClose: closeFlagMenu,
      onSubmit: handleSubmit,
    }),
    container
  );

  flagMenuOpen = true;
};

const closeFlagMenu = () => {
  const container = document.getElementById(FLAG_MENU_ID);
  if (container) {
    render(null, container);
    container.remove();
  }
  flagMenuOpen = false;
  selectedTextData = null;
};

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.code === 'Space') {
    e.preventDefault();
    toggleSpotlight();
  }

  if (e.code === 'Escape' && spotlightOpen) {
    closeSpotlight();
  }

  if (e.code === 'Escape' && flagMenuOpen) {
    closeFlagMenu();
  }
});

document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  if (!selectedText || selectedText.length < 10) {
    return;
  }

  const range = selection?.getRangeAt(0);
  if (!range) return;

  let element = range.commonAncestorContainer;
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentElement!;
  }

  const vectorDbElement = (element as HTMLElement).closest(
    '[data-vectordb-id]'
  );
  const paragraphElement = (element as HTMLElement).closest(
    'p, h1, h2, h3, h4, h5, h6, li, div'
  );

  if (!vectorDbElement && !paragraphElement) return;

  const targetElement = vectorDbElement || paragraphElement;
  let elementId = targetElement?.getAttribute('data-vectordb-id') || '';

  if (!elementId) {
    elementId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    targetElement?.setAttribute('data-vectordb-id', elementId);
  }

  const context = targetElement?.textContent?.slice(0, 500) || '';

  selectedTextData = {
    text: selectedText,
    elementId,
    context,
  };

  setTimeout(() => {
    if (window.getSelection()?.toString().trim() === selectedText) {
      const rect = range.getBoundingClientRect();
      openFlagMenu(
        rect.left + rect.width / 2,
        rect.bottom + window.scrollY + 10
      );
    }
  }, 300);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle-spotlight') {
    toggleSpotlight();
    sendResponse();
  }

  if (message.action === 'extractWebsiteParts') {
    const main =
      document.querySelector('main') || document.querySelector('body');
    if (!main) {
      sendResponse({ error: 'No main or body element found' });
      return;
    }

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

  if (message.action === 'highlightMisinformation') {
    const { elementId, flagId, verdict, confidence, reason } = message.payload;
    highlightMisinformation(elementId, flagId, verdict, confidence, reason);
    sendResponse();
  }

  if (message.action === 'removeHighlight') {
    removeHighlight(message.payload.flagId);
    sendResponse();
  }

  if (message.action === 'clearAllHighlights') {
    clearAllHighlights();
    sendResponse();
  }

  if (message.action === 'scrollToHighlight') {
    scrollToHighlight(message.payload.flagId);
    sendResponse();
  }

  return true;
});
