import { h } from 'preact';
import { useState } from 'preact/hooks';
import { AlertTriangle, X } from 'lucide-react';
import styles from './FlagMenu.module.css';

interface FlagMenuProps {
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

const FlagMenu = ({
  selectedText,
  position,
  onClose,
  onSubmit,
}: FlagMenuProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const predefinedReasons = [
    'Factually incorrect',
    'Misleading context',
    'Unverified claim',
    'Missing source',
    'Other',
  ];

  const handleSubmit = async () => {
    const reason = selectedReason === 'Other' ? customReason : selectedReason;
    if (!reason.trim()) return;

    setIsSubmitting(true);
    await onSubmit(reason);
    setIsSubmitting(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.menu}
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <AlertTriangle size={18} />
          <h3>Flag Potential Misinformation</h3>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.selectedText}>
          "{selectedText.slice(0, 150)}
          {selectedText.length > 150 ? '...' : ''}"
        </div>

        <div className={styles.reasonSection}>
          <label>Why is this suspicious?</label>
          {predefinedReasons.map((reason) => (
            <label key={reason} className={styles.radioLabel}>
              <input
                type="radio"
                name="reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={(e) =>
                  setSelectedReason((e.target as HTMLInputElement).value)
                }
              />
              {reason}
            </label>
          ))}

          {selectedReason === 'Other' && (
            <textarea
              className={styles.customInput}
              placeholder="Describe the issue..."
              value={customReason}
              onInput={(e) =>
                setCustomReason((e.target as HTMLTextAreaElement).value)
              }
              rows={3}
            />
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={
              !selectedReason ||
              (selectedReason === 'Other' && !customReason.trim()) ||
              isSubmitting
            }
          >
            {isSubmitting ? 'Verifying...' : 'Submit & Verify'}
          </button>
        </div>

        <div className={styles.footer}>
          <small>
            We'll check this against Google Fact Check, Wikipedia, and domain
            reputation databases.
          </small>
        </div>
      </div>
    </div>
  );
};

export default FlagMenu;
