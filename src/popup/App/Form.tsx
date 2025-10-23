import { useRef, useState, useEffect } from 'preact/hooks';
import cn from '../../helpers/classnames';
import { Send, History } from 'lucide-react';
import { Loader } from '../../theme';
import styles from './Form.module.css';

const Form = ({
  className,
  onSubmit,
  defaultQuery = '',
  queryHistory = [],
}: {
  className?: string;
  onSubmit: (query: string) => Promise<void>;
  defaultQuery?: string;
  queryHistory?: string[];
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [showSuggestions, setShowSuggestions] =
    useState<boolean>(!defaultQuery);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = [
    'Summarize the main points',
    'What are the key takeaways?',
    'Explain this in simple terms',
    'What is this page about?',
  ];

  useEffect(() => {
    if (defaultQuery && textRef.current) {
      textRef.current.value = defaultQuery;
      setShowSuggestions(false);
    }
  }, [defaultQuery]);

  const handleSuggestionClick = async (suggestion: string) => {
    if (textRef.current) {
      textRef.current.value = suggestion;
      setShowSuggestions(false);
      setLoading(true);
      setLoadingStage('Searching page...');
      setTimeout(() => setLoadingStage('Generating answer...'), 500);
      await onSubmit(suggestion);
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleHistoryClick = async (query: string) => {
    if (textRef.current) {
      textRef.current.value = query;
      setShowHistory(false);
      setShowSuggestions(false);
      setLoading(true);
      setLoadingStage('Searching page...');
      setTimeout(() => setLoadingStage('Generating answer...'), 500);
      await onSubmit(query);
      setLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className={cn(className || '', styles.root)}>
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!textRef.current) return;

          setLoading(true);
          setLoadingStage('Searching page...');
          setShowSuggestions(false);
          setShowHistory(false);
          const query = textRef.current.value;
          if (!query) {
            setLoading(false);
            setLoadingStage('');
            return;
          }
          setTimeout(() => setLoadingStage('Generating answer...'), 500);
          await onSubmit(query);
          textRef.current.value = '';
          setLoading(false);
          setLoadingStage('');
        }}
      >
        <label htmlFor="query" className={styles.label}>
          <textarea
            id="query"
            name="query"
            ref={textRef}
            className={styles.textarea}
            placeholder="Ask a question..."
            disabled={loading}
            aria-label="Enter your question about the page"
            onFocus={() => {
              setShowSuggestions(false);
              setShowHistory(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.form;
                if (form) {
                  form.requestSubmit();
                }
              }
            }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
          title={loadingStage || 'Send'}
          aria-label={loadingStage || 'Submit query'}
        >
          {loading ? (
            <Loader className={styles.buttonLoader} />
          ) : (
            <Send size="1em" className={styles.icon} />
          )}
        </button>
        {queryHistory.length > 0 && !showHistory && !showSuggestions && (
          <button
            type="button"
            className={styles.historyButton}
            onClick={() => setShowHistory(!showHistory)}
            disabled={loading}
            title="Show query history"
            aria-label="Show query history"
          >
            <History size={18} />
          </button>
        )}
      </form>
      {loadingStage && (
        <div className={styles.loadingStage}>
          <span>{loadingStage}</span>
        </div>
      )}
      {showHistory && queryHistory.length > 0 && (
        <div className={styles.history}>
          <p className={styles.historyTitle}>Recent queries:</p>
          {queryHistory.map((query, idx) => (
            <button
              key={`${query}-${idx}`}
              className={styles.historyButton2}
              onClick={() => handleHistoryClick(query)}
              disabled={loading}
            >
              {query}
            </button>
          ))}
        </div>
      )}
      {showSuggestions && (
        <div className={styles.suggestions}>
          <p className={styles.suggestionsTitle}>Try asking:</p>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Form;
