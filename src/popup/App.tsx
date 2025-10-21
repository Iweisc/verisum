import Form from './App/Form';
import Result from './App/Result';
import styles from './App.module.css';
import { useState, useEffect } from 'preact/hooks';
import { VectorDBStats } from '../helpers/types';
import { runLanguageModelStreamInServiceWorker } from '../helpers/chromeMessages';

const CACHE_KEY = 'verisum_last_query';

const App = ({
  stats,
  documentTitle,
}: {
  stats: VectorDBStats;
  documentTitle: string;
}) => {
  const [answer, setAnswer] = useState<string>('');
  const [sources, setSources] = useState<
    Array<{ content: string; id: string }>
  >([]);
  const [lastQuery, setLastQuery] = useState<string>('');

  useEffect(() => {
    chrome.storage.local.get(CACHE_KEY, (result) => {
      if (result[CACHE_KEY]) {
        const { query, answer, sources } = result[CACHE_KEY];
        setLastQuery(query || '');
        setAnswer(answer || '');
        setSources(sources || []);
      }
    });
  }, []);

  const onSubmit = async (query: string) => {
    setAnswer('');
    setSources([]);
    const done = await runLanguageModelStreamInServiceWorker(
      query,
      documentTitle,
      (resp) => {
        setAnswer(resp.answer);
        setSources(resp.sources);
      }
    );
    setAnswer(done.answer);
    setSources(done.sources);

    chrome.storage.local.set({
      [CACHE_KEY]: {
        query,
        answer: done.answer,
        sources: done.sources,
        timestamp: Date.now(),
      },
    });
  };

  return (
    <div className={styles.root}>
      <Form
        className={styles.form}
        onSubmit={onSubmit}
        defaultQuery={lastQuery}
      />
      {answer && (
        <Result className={styles.result} answer={answer} sources={sources} />
      )}
    </div>
  );
};

export default App;
