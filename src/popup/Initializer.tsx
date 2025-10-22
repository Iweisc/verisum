import { useEffect, useState } from 'preact/hooks';
import { Loader } from '../theme';
import styles from './Initializer.module.css';
import cn from '../helpers/classnames';
import { VectorDBStats } from '../helpers/types';
import {
  getInitializeVectorDBFromContent,
  getLanguageModelAvailabilityInServiceWorker,
} from '../helpers/chromeMessages';
import { TriangleAlert } from 'lucide-react';

const Initializer = ({
  setStats,
  setInitialized,
  setDocumentTitle,
  className = '',
}: {
  setStats: (stats: VectorDBStats) => void;
  setInitialized: () => void;
  setDocumentTitle: (title: string) => void;
  className?: string;
}) => {
  const [error, setError] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string>(
    'Extracting page content...'
  );
  const [progress, setProgress] = useState<number>(0);

  const initialize = async () => {
    try {
      setProgress(10);
      setLoadingMessage('Extracting page content...');

      const timeout1 = setTimeout(() => {
        setProgress(30);
        setLoadingMessage('Processing content...');
      }, 1000);

      const timeout2 = setTimeout(() => {
        setProgress(50);
        setLoadingMessage(
          'Downloading AI model... (first run may take a minute)'
        );
      }, 3000);

      const timeout3 = setTimeout(() => {
        setProgress(70);
        setLoadingMessage('Generating embeddings...');
      }, 5000);

      const [vectorDB, availability] = await Promise.all([
        getInitializeVectorDBFromContent(),
        getLanguageModelAvailabilityInServiceWorker(),
      ]);

      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);

      setProgress(90);
      setLoadingMessage('Almost ready...');

      await new Promise((resolve) => setTimeout(resolve, 200));

      setProgress(100);
      setStats(vectorDB.dbStats);
      setDocumentTitle(vectorDB.documentTitle);
      setInitialized();
    } catch (e) {
      setError(
        (e as Error).message ||
          'Failed to initialize. Check service worker console for details.'
      );
    }
  };

  useEffect(() => {
    initialize();
  }, []);

  return (
    <div className={cn(styles.root, className)}>
      {error ? (
        <div className={styles.error}>
          <TriangleAlert className={styles.errorIcon} size="1.5rem" />
          <p className={styles.errorText}>{error}</p>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Loader className={styles.loader} />
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={styles.progressText}>{progress}%</p>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
            {loadingMessage}
          </p>
        </div>
      )}
    </div>
  );
};

export default Initializer;
