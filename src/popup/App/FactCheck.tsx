import { useState, useEffect } from 'preact/hooks';
import styles from './FactCheck.module.css';
import { FlaggedClaim } from '../../helpers/factCheck/types';

const FactCheck = () => {
  const [flags, setFlags] = useState<FlaggedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadFlags = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getAllFactCheckFlags',
      });
      if (response && response.flags) {
        setFlags(response.flags);
      } else {
        setFlags([]);
      }
    } catch (error) {
      console.error('Error loading flags:', error);
      setFlags([]);
    } finally {
      setLoading(false);
    }
  };

  const scanPage = async () => {
    setScanning(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) {
        alert('No active tab found');
        return;
      }

      console.log('Starting scan', tab.id);

      const response = await chrome.runtime.sendMessage({
        action: 'scanPageForMisinformation',
        payload: { tabId: tab.id },
      });

      console.log('Scan response:', response);

      if (response && response.error) {
        console.error('Scan error:', response.error);
        alert('Scan failed: ' + response.error);
      } else if (response && response.success) {
        await loadFlags();
        if (response.flagsFound === 0) {
          alert('No misinformation detected');
        }
      }
    } catch (error) {
      console.error('Error scanning page:', error);
      alert('Failed to scan page. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleJumpTo = async (claim: FlaggedClaim) => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'scrollToHighlight',
          payload: { flagId: claim.id },
        });
      }
    } catch (error) {
      console.error('Error jumping to highlight:', error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all fact-check flags?')) return;

    try {
      await chrome.runtime.sendMessage({ action: 'clearFactCheckCache' });
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'clearAllHighlights' });
      }
      setFlags([]);
    } catch (error) {
      console.error('Error clearing flags:', error);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Loading...</div>
      </div>
    );
  }

  if (scanning) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Scanning page...</div>
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <div className={styles.container}>
        <button onClick={scanPage} className={styles.scanButton}>
          Scan Page
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <button onClick={scanPage} className={styles.actionButton}>
          Rescan
        </button>
        <button onClick={handleClearAll} className={styles.actionButton}>
          Clear All
        </button>
      </div>

      <div className={styles.list}>
        {flags.map((claim) => (
          <button
            key={claim.id}
            className={styles.claim}
            onClick={() => handleJumpTo(claim)}
          >
            <div className={styles.claimText}>
              {claim.text.slice(0, 120)}
              {claim.text.length > 120 ? '...' : ''}
            </div>
            <div className={styles.claimReason}>{claim.userReason}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FactCheck;
