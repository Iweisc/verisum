import styles from './Sources.module.css';
import cn from '../helpers/classnames';
import { Link2 } from 'lucide-react';
import highlightParagraph from '../helpers/highlightParagraph';
import { useState, useEffect, useRef } from 'preact/hooks';

const Sources = ({
  className = '',
  sources = [],
}: {
  className?: string;
  sources: Array<{ content: string; id: string }>;
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const sourceRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (sources.length === 0) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < sources.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        sourceRefs.current[focusedIndex]?.click();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sources.length, focusedIndex]);

  useEffect(() => {
    if (focusedIndex >= 0) {
      sourceRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  return (
    <div className={cn(className, styles.root)}>
      <p className={styles.heading}>
        <b>Sources:</b> <span className={styles.count}>({sources.length})</span>
      </p>
      <ul className={styles.list}>
        {sources.map((source, index) => (
          <li className={styles.item} key={source.id}>
            <button
              ref={(el) => (sourceRefs.current[index] = el)}
              onClick={() => {
                highlightParagraph(source.id);
              }}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(-1)}
              className={cn(styles.button, 'fs-small', {
                [styles.buttonFocused]: focusedIndex === index,
              })}
              title="Click to highlight on page (↑↓ to navigate, Enter to select)"
            >
              <Link2 size="1em" className={styles.buttonIcon} />
              {source.content}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sources;
