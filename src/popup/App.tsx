import Form from './App/Form';
import Result from './App/Result';
import FactCheck from './App/FactCheck';
import styles from './App.module.css';
import { useState, useEffect } from 'preact/hooks';
import { VectorDBStats } from '../helpers/types';
import { runLanguageModelStreamInServiceWorker } from '../helpers/chromeMessages';
import { Shield, MessageCircleQuestion } from 'lucide-react';

const CACHE_KEY = 'verisum_last_query';
const HISTORY_KEY = 'verisum_query_history';
const MAX_HISTORY = 10;

const App = ({
  stats,
  documentTitle,
}: {
  stats: VectorDBStats | null;
  documentTitle: string;
}) => {
  const [answer, setAnswer] = useState<string>('');
  const [sources, setSources] = useState<
    Array<{ content: string; id: string }>
  >([]);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'factcheck'>(
    'questions'
  );

  useEffect(() => {
    chrome.storage.local.get([CACHE_KEY, HISTORY_KEY], (result) => {
      if (result[CACHE_KEY]) {
        const { query, answer, sources } = result[CACHE_KEY];
        setLastQuery(query || '');
        setAnswer(answer || '');
        setSources(sources || []);
      }
      if (result[HISTORY_KEY]) {
        setQueryHistory(result[HISTORY_KEY]);
      }
    });
  }, []);

  const onSubmit = async (query: string) => {
    setAnswer('');
    setSources([]);
    setError('');
    setIsStreaming(true);

    try {
      const done = await runLanguageModelStreamInServiceWorker(
        query,
        documentTitle,
        (resp) => {
          setAnswer(resp.answer);
          setSources(resp.sources);
        }
      );
      setIsStreaming(false);
      setAnswer(done.answer);
      setSources(done.sources);

      const updatedHistory = [
        query,
        ...queryHistory.filter((q) => q !== query),
      ].slice(0, MAX_HISTORY);
      setQueryHistory(updatedHistory);

      chrome.storage.local.set({
        [CACHE_KEY]: {
          query,
          answer: done.answer,
          sources: done.sources,
          timestamp: Date.now(),
        },
        [HISTORY_KEY]: updatedHistory,
      });
    } catch (err: any) {
      setIsStreaming(false);
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
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'questions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          <MessageCircleQuestion size={16} />
          Questions
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'factcheck' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('factcheck')}
        >
          <Shield size={16} />
          Fact Check
        </button>
      </div>

      {activeTab === 'questions' ? (
        <>
          <Form
            className={styles.form}
            onSubmit={onSubmit}
            defaultQuery={lastQuery}
            queryHistory={queryHistory}
          />
          {error && (
            <div className={styles.error}>
              <p className={styles.errorMessage}>{error}</p>
              <button
                onClick={() => {
                  setError('');
                  const textarea = document.querySelector('textarea');
                  if (textarea?.value) {
                    onSubmit(textarea.value);
                  }
                }}
                className={styles.retryButton}
              >
                Try Again
              </button>
            </div>
          )}
          {answer && !error && (
            <Result
              className={styles.result}
              answer={answer}
              sources={sources}
              isStreaming={isStreaming}
            />
          )}
        </>
      ) : (
        <FactCheck />
      )}
    </div>
  );
};

export default App;
