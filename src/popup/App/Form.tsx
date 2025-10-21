import { useRef, useState, useEffect } from 'preact/hooks';
import cn from '../../helpers/classnames';
import { Send } from 'lucide-react';
import { Loader } from '../../theme';
import styles from './Form.module.css';

const Form = ({
  className,
  onSubmit,
  defaultQuery = '',
}: {
  className?: string;
  onSubmit: (query: string) => Promise<void>;
  defaultQuery?: string;
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (defaultQuery && textRef.current) {
      textRef.current.value = defaultQuery;
    }
  }, [defaultQuery]);

  return (
    <div className={cn(className, styles.root)}>
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const query = textRef.current.value;
          if (!query) {
            setLoading(false);
            return;
          }
          await onSubmit(query);
          textRef.current.value = '';
          setLoading(false);
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
        >
          {loading ? (
            <Loader className={styles.buttonLoader} />
          ) : (
            <Send size="1em" className={styles.icon} />
          )}
        </button>
      </form>
    </div>
  );
};

export default Form;
