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
  const [loadingMessage, setLoadingMessage] =
    useState<string>('Initializing...');

  const initialize = async () => {
    try {
      const timeoutId = setTimeout(() => {
        setLoadingMessage(
          'Downloading model... (this may take a minute on first run)'
        );
      }, 3000);

      const [vectorDB, availability] = await Promise.all([
        getInitializeVectorDBFromContent(),
        getLanguageModelAvailabilityInServiceWorker(),
      ]);

      clearTimeout(timeoutId);
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
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
            {loadingMessage}
          </p>
        </div>
      )}
    </div>
  );
};

export default Initializer;
