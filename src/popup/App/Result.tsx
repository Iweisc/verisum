import showdown from 'showdown';
import styles from './Result.module.css';
import cn from '../../helpers/classnames';
import { highlightParagraphFromContent } from '../../helpers/chromeMessages';
import { Copy, Check, Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  generateSpeech,
  isConfigured as isTTSConfigured,
} from '../../helpers/vpsTTS';
import { AudioPlayer } from '../../helpers/AudioPlayer';

const showdownConverter = new showdown.Converter();
const Result = ({
  className,
  answer,
  sources,
  isStreaming = false,
}: {
  className?: string;
  answer: string;
  sources: Array<{ content: string; id: string }>;
  isStreaming?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedWithSources, setCopiedWithSources] = useState(false);
  const [focusedSourceIndex, setFocusedSourceIndex] = useState<number>(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const sourceRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyWithSources = async () => {
    try {
      const text = `${answer}\n\nSources:\n${sources.map((s, i) => `[${i + 1}] ${s.content}`).join('\n')}`;
      await navigator.clipboard.writeText(text);
      setCopiedWithSources(true);
      setTimeout(() => setCopiedWithSources(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSpeak = async () => {
    if (isSpeaking) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
      }
      setIsSpeaking(false);
      return;
    }

    try {
      setIsSpeaking(true);

      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new AudioPlayer();
      }

      const audioData = await generateSpeech(answer.replace(/\[(\d+)\]/g, ''));
      await audioPlayerRef.current.play(audioData);
      setIsSpeaking(false);
    } catch (err) {
      console.error('Failed to speak:', err);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    if (sources.length === 0) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedSourceIndex((prev) =>
          prev < sources.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedSourceIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && focusedSourceIndex >= 0) {
        e.preventDefault();
        sourceRefs.current[focusedSourceIndex]?.click();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sources.length, focusedSourceIndex]);

  useEffect(() => {
    if (focusedSourceIndex >= 0) {
      sourceRefs.current[focusedSourceIndex]?.focus();
    }
  }, [focusedSourceIndex]);

  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.answerHeader}>
        <div className={styles.qualityBadge}>
          {sources.length >= 5 ? (
            <span className={styles.qualityHigh}>High confidence</span>
          ) : sources.length >= 3 ? (
            <span className={styles.qualityMedium}>Medium confidence</span>
          ) : (
            <span className={styles.qualityLow}>Limited sources</span>
          )}
        </div>
        {isTTSConfigured() && (
          <button
            onClick={handleSpeak}
            className={styles.copyButton}
            title={isSpeaking ? 'Stop speaking' : 'Speak answer'}
          >
            {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isSpeaking ? 'Stop' : 'Speak'}</span>
          </button>
        )}
        <button
          onClick={handleCopy}
          className={styles.copyButton}
          title="Copy answer"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div
        className={cn(styles.answer, { [styles.answerStreaming]: isStreaming })}
        dangerouslySetInnerHTML={{
          __html: showdownConverter.makeHtml(answer),
        }}
      />
      {sources.length > 0 && (
        <div className={styles.sourcesContainer}>
          <div className={styles.sourcesHeader}>
            <h3 className={styles.sourcesTitle}>
              Sources{' '}
              <span className={styles.sourceCount}>({sources.length})</span>
            </h3>
            <button
              onClick={handleCopyWithSources}
              className={styles.copySourcesButton}
              title="Copy answer with sources"
            >
              {copiedWithSources ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedWithSources ? 'Copied!' : 'Copy all'}</span>
            </button>
          </div>
          <div className={styles.sourcesList}>
            {sources.map((result, index) => (
              <div key={result.id} className={styles.source}>
                <button
                  ref={(el) => (sourceRefs.current[index] = el)}
                  className={cn(styles.sourceButton, {
                    [styles.sourceFocused]: focusedSourceIndex === index,
                  })}
                  onClick={async (e) => {
                    const button = e.currentTarget;
                    button.classList.add(styles.sourceClicked);
                    setTimeout(
                      () => button.classList.remove(styles.sourceClicked),
                      300
                    );
                    await highlightParagraphFromContent(result.id);
                  }}
                  onFocus={() => setFocusedSourceIndex(index)}
                  onBlur={() => setFocusedSourceIndex(-1)}
                  title="Click to highlight on page (↑↓ to navigate, Enter to select)"
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
