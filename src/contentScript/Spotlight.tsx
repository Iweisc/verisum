import { useState, useRef, useEffect } from 'preact/hooks';
import { Send, X } from 'lucide-react';
import { Loader } from '../theme';
import styles from './Spotlight.module.css';

interface SpotlightProps {
  onClose: () => void;
  onSubmit: (
    query: string,
    callback?: (response: { answer: string; sources: any[] }) => void
  ) => Promise<{ answer: string; sources: any[] }>;
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

const Spotlight = ({ onClose, onSubmit }: SpotlightProps) => {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setAnswer('');

    try {
      const result = await onSubmit(query, (response) => {
        setAnswer(response.answer);
      });
      setAnswer(result.answer);
    } catch (error) {
      setAnswer('Sorry, something went wrong.');
    } finally {
      setLoading(false);
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
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
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

        {answer && (
          <div
            className={styles.answer}
            dangerouslySetInnerHTML={{ __html: parseMarkdown(answer) }}
          />
        )}
      </div>
    </div>
  );
};

export default Spotlight;
