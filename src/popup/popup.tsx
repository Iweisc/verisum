import { render } from 'preact';
import { useState } from 'preact/hooks';
import './styles/reset.css';
import './styles/typography.css';
import styles from './popup.module.css';
import Initializer from './Initializer';
import App from './App';
import { VectorDBStats } from '../helpers/types';

const Popup = () => {
  const [initialized, setInitialized] = useState<boolean>(false);
  const [stats, setStats] = useState<VectorDBStats>(null);
  const [documentTitle, setDocumentTitle] = useState<string>('');

  return (
    <div className={styles.root}>
      {!initialized ? (
        <Initializer
          className={styles.initializer}
          setInitialized={() => setInitialized(true)}
          setStats={setStats}
          setDocumentTitle={setDocumentTitle}
        />
      ) : (
        <App stats={stats} documentTitle={documentTitle} />
      )}
    </div>
  );
};

render(<Popup />, document.querySelector('#amw-popup-container'));
