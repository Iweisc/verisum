import showdown from 'showdown';
import styles from './Result.module.css';
import cn from '../../helpers/classnames';
import { highlightParagraphFromContent } from '../../helpers/chromeMessages';

const showdownConverter = new showdown.Converter();
const Result = ({
  className,
  answer,
  sources,
}: {
  className?: string;
  answer: string;
  sources: Array<{ content: string; id: string }>;
}) => {
  return (
    <div className={cn(styles.root, className)}>
      <div
        className={styles.answer}
        dangerouslySetInnerHTML={{
          __html: showdownConverter.makeHtml(answer),
        }}
      />
      {sources.length > 0 && (
        <div className={styles.sourcesContainer}>
          <h3 className={styles.sourcesTitle}>Sources</h3>
          <div className={styles.sourcesList}>
            {sources.map((result, index) => (
              <div key={result.id} className={styles.source}>
                <button
                  className={styles.sourceButton}
                  onClick={async () => {
                    await highlightParagraphFromContent(result.id);
                  }}
                  title="Click to highlight on page"
                >
                  <span className={styles.sourceNumber}>[{index + 1}]</span>
                  <span className={styles.sourceContent}>{result.content}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Result;
