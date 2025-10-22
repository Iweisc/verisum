import { Verdict } from './factCheck/types';

const HIGHLIGHT_ATTR = 'data-verisum-flagged';
const HIGHLIGHT_ID_ATTR = 'data-verisum-flag-id';

const getHighlightColor = (
  verdict: Verdict,
  confidence: number
): { bg: string; border: string } => {
  if (verdict === 'FALSE' && confidence >= 70) {
    return { bg: '#ffebee', border: '#f44336' };
  }

  if (verdict === 'FALSE' || (verdict === 'MISLEADING' && confidence >= 60)) {
    return { bg: '#fff3e0', border: '#ff9800' };
  }

  if (verdict === 'MISLEADING' || verdict === 'UNVERIFIED') {
    return { bg: '#fffde7', border: '#ffc107' };
  }

  return { bg: '#f5f5f5', border: '#9e9e9e' };
};

export const highlightMisinformation = (
  elementId: string,
  flagId: string,
  verdict: Verdict,
  confidence: number,
  reason: string
): void => {
  const element = document.querySelector(
    `[data-vectordb-id="${elementId}"]`
  ) as HTMLElement;

  if (!element) {
    console.warn(`Element with ID ${elementId} not found`);
    return;
  }

  const colors = getHighlightColor(verdict, confidence);

  element.style.transition = 'all 0.3s ease-in-out';
  element.style.backgroundColor = colors.bg;
  element.style.border = `3px solid ${colors.border}`;
  element.style.borderRadius = '4px';
  element.style.padding = '8px';
  element.style.margin = '4px 0';
  element.style.cursor = 'help';
  element.setAttribute(HIGHLIGHT_ATTR, 'true');
  element.setAttribute(HIGHLIGHT_ID_ATTR, flagId);
  element.setAttribute(
    'title',
    `Flagged: ${reason}\nConfidence: ${confidence}%\nVerdict: ${verdict}`
  );

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

export const removeHighlight = (flagId: string): void => {
  const element = document.querySelector(
    `[${HIGHLIGHT_ID_ATTR}="${flagId}"]`
  ) as HTMLElement;

  if (!element) return;

  element.style.transition = 'all 0.3s ease-in-out';
  element.style.backgroundColor = '';
  element.style.border = '';
  element.style.borderRadius = '';
  element.style.padding = '';
  element.style.margin = '';
  element.style.cursor = '';
  element.removeAttribute(HIGHLIGHT_ATTR);
  element.removeAttribute(HIGHLIGHT_ID_ATTR);
  element.removeAttribute('title');
};

export const clearAllHighlights = (): void => {
  const elements = document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`);
  elements.forEach((element) => {
    const flagId = element.getAttribute(HIGHLIGHT_ID_ATTR);
    if (flagId) {
      removeHighlight(flagId);
    }
  });
};

export const scrollToHighlight = (flagId: string): void => {
  const element = document.querySelector(
    `[${HIGHLIGHT_ID_ATTR}="${flagId}"]`
  ) as HTMLElement;
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#ffeb3b';
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
    }, 1000);
  }
};
