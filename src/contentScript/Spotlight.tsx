import { useState, useRef, useEffect } from 'preact/hooks';
import { Send, X, Copy, Check } from 'lucide-react';
import { Loader } from '../theme';
import styles from './Spotlight.module.css';
import Sources from './Sources';

interface SpotlightProps {
  onClose: () => void;
  onSubmit: (
    query: string,
    callback?: (response: { answer: string; sources: any[] }) => void
  ) => Promise<{ answer: string; sources: any[] }>;
  initialState?: {
    query: string;
    answer: string;
    sources: Array<{ content: string; id: string }>;
  };
  onStateChange?: (state: {
    query: string;
    answer: string;
    sources: Array<{ content: string; id: string }>;
  }) => void;
}

const parseMarkdown = (text: string): string => {
  let html = text;

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );
  html = html.replace(/\n/g, '<br>');

  return html;
};

const Spotlight = ({
  onClose,
  onSubmit,
  initialState,
  onStateChange,
}: SpotlightProps) => {
  const [query, setQuery] = useState(initialState?.query || '');
  const [answer, setAnswer] = useState(initialState?.answer || '');
  const [sources, setSources] = useState<
    Array<{ content: string; id: string }>
  >(initialState?.sources || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [hasAnswer, setHasAnswer] = useState(!!initialState?.answer);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange({ query, answer, sources });
    }
  }, [query, answer, sources, onStateChange]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setAnswer('');
    setSources([]);
    setError('');

    try {
      const result = await onSubmit(query, (response) => {
        setAnswer(response.answer);
        setSources(response.sources || []);
      });
      setAnswer(result.answer);
      setSources(result.sources || []);
      setHasAnswer(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      const errorMessage = err?.message || '';
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Check your connection and try again.');
      } else if (errorMessage.includes('rate limit')) {
        setError('Rate limit reached. Please wait a moment and try again.');
      } else if (errorMessage.includes('model')) {
        setError('AI model error. The service may be temporarily unavailable.');
      } else if (errorMessage.includes('VectorDB')) {
        setError(
          'Failed to analyze page content. Please refresh and try again.'
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError('');
    handleSubmit(new Event('submit'));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.spotlight} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onInput={(e) => {
              const newValue = (e.target as HTMLInputElement).value;
              if (hasAnswer && newValue !== query) {
                setAnswer('');
                setSources([]);
                setError('');
                setHasAnswer(false);
              }
              setQuery(newValue);
            }}
            placeholder="Ask anything about this page..."
            className={styles.input}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className={styles.submitButton}
          >
            {loading ? <Loader /> : <Send size={20} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
          >
            <X size={20} />
          </button>
        </form>

        {loading && !answer && (
          <div className={styles.loadingMessage}>
            <span>Searching the page</span>
            <span className={styles.dots}>
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}

        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <button onClick={handleRetry} className={styles.retryButton}>
              Try Again
            </button>
          </div>
        )}

        {answer && !error && (
          <>
            <div className={styles.answerContainer}>
              <div className={styles.answerHeader}>
                <div className={styles.qualityBadge}>
                  {sources.length >= 5 ? (
                    <span className={styles.qualityHigh}>High confidence</span>
                  ) : sources.length >= 3 ? (
                    <span className={styles.qualityMedium}>
                      Medium confidence
                    </span>
                  ) : (
                    <span className={styles.qualityLow}>Limited sources</span>
                  )}
                </div>
                <button
                  onClick={handleCopy}
                  className={styles.copyButton}
                  title="Copy answer"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <div
                className={styles.answer}
                dangerouslySetInnerHTML={{ __html: parseMarkdown(answer) }}
              />
            </div>
            {sources.length > 0 && (
              <Sources sources={sources} className={styles.sources} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Spotlight;
