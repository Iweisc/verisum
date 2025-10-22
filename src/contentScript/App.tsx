import { render, createElement } from 'preact';
import { FileQuestion, Ear, Volume2, Mic, MicOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Loader } from '../theme';
import styles from './App.module.css';
import SpeechToText from '../helpers/SpeechToText';
import Sources from './Sources';
import cn from '../helpers/classnames';
import { runLanguageModelInServiceWorker } from '../helpers/chromeMessages';
import {
  generateSpeech,
  isConfigured as isTTSConfigured,
} from '../helpers/vpsTTS';
import { AudioPlayer } from '../helpers/AudioPlayer';

enum State {
  IDLE,
  LISTENING,
  THINKING,
  SPEAKING,
}

const ICON_SIZE = 30;

const App = () => {
  const [metaVisible, setMetaVisible] = useState<boolean>(false);
  const [state, setState] = useState<State>(State.IDLE);
  const [sources, setSources] = useState<
    Array<{ content: string; id: string }>
  >([]);
  const [conversationalMode, setConversationalMode] = useState<boolean>(false);
  const audioPlayerRef = useRef<AudioPlayer>(new AudioPlayer());
  const speechToTextRef = useRef<SpeechToText | null>(null);
  const conversationalLoopRef = useRef<boolean>(false);

  const processQuery = async (text: string) => {
    if (!text.trim()) return;

    setState(State.THINKING);
    try {
      const done = await runLanguageModelInServiceWorker(text);

      const filteredSources = done.sources.filter((source) =>
        done.prompt.includes(source.content)
      );
      setSources(filteredSources);

      setState(State.SPEAKING);

      if (isTTSConfigured()) {
        const cleanText = done.answer.replace(/\[\d+\]/g, '');
        const audioData = await generateSpeech(cleanText);
        await audioPlayerRef.current.play(audioData);
      }

      setState(State.IDLE);
    } catch (e) {
      setState(State.IDLE);
    } finally {
      if (conversationalLoopRef.current && conversationalMode) {
        setTimeout(() => startListening(), 500);
      }
    }
  };

  const startListening = () => {
    if (state !== State.IDLE) return;

    if (!speechToTextRef.current) {
      speechToTextRef.current = new SpeechToText();
    }

    try {
      speechToTextRef.current.start();
      setState(State.LISTENING);
    } catch (e) {
      speechToTextRef.current = null;
    }
  };

  const stopListening = async () => {
    if (!speechToTextRef.current) return;

    try {
      const text = await speechToTextRef.current.stop();
      speechToTextRef.current = null;

      if (text.trim()) {
        await processQuery(text);
      } else {
        setState(State.IDLE);
      }
    } catch (e) {
      speechToTextRef.current = null;
      setState(State.IDLE);
    } finally {
      if (
        !speechToTextRef.current &&
        conversationalLoopRef.current &&
        conversationalMode
      ) {
        setTimeout(() => startListening(), 500);
      }
    }
  };

  useEffect(() => {
    const speechToText = new SpeechToText();
    let started = false;

    const keydown = (event: KeyboardEvent) => {
      if (conversationalMode) return;

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
      }
      if (
        (event.code === 'Space' || event.key === ' ') &&
        !started &&
        (event.target as HTMLTextAreaElement)?.type !== 'textarea'
      ) {
        setState(State.LISTENING);
        speechToText.start();
        started = true;
      }
    };

    const keyup = async (event: KeyboardEvent) => {
      if (conversationalMode) return;

      if (event.code === 'Space' || event.key === ' ') {
        started = false;
        const text = await speechToText.stop();
        await processQuery(text);
      }
    };

    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);

    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
    };
  }, [conversationalMode]);

  useEffect(() => {
    if (conversationalMode) {
      conversationalLoopRef.current = true;
      startListening();
    } else {
      conversationalLoopRef.current = false;
      if (speechToTextRef.current) {
        speechToTextRef.current.stop().catch(() => {});
        speechToTextRef.current = null;
      }
      audioPlayerRef.current.stop();
      setState(State.IDLE);
    }
  }, [conversationalMode]);

  const handleVoiceButtonClick = () => {
    if (state === State.LISTENING && !conversationalMode) {
      stopListening();
    }
  };

  const toggleConversationalMode = () => {
    setConversationalMode((prev) => !prev);
  };

  return (
    <div className={styles.root}>
      <div
        className={cn(styles.overlay, {
          [styles.overlayVisible]: sources.length !== 0 && conversationalMode,
        })}
      >
        <Sources sources={sources} />
      </div>

      <div className={styles.controls}>
        {isTTSConfigured() && (
          <button
            className={cn(styles.toggleButton, {
              [styles.toggleButtonActive]: conversationalMode,
            })}
            onClick={toggleConversationalMode}
            title={
              conversationalMode
                ? 'Exit conversational mode'
                : 'Enter conversational mode'
            }
          >
            {conversationalMode ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        )}

        <button
          style={{ width: ICON_SIZE * 1.7, height: ICON_SIZE * 1.7 }}
          className={styles.button}
          onClick={() => {
            if (conversationalMode) {
              setMetaVisible((v) => !v);
            } else {
              handleVoiceButtonClick();
            }
          }}
        >
          {state === State.IDLE ? (
            <FileQuestion size={ICON_SIZE} />
          ) : state === State.LISTENING ? (
            <Ear size={ICON_SIZE} />
          ) : state === State.THINKING ? (
            <span
              style={{
                position: 'relative',
                display: 'inline-block',
                width: ICON_SIZE,
                height: ICON_SIZE,
              }}
            >
              <Loader
                style={{
                  fontSize: ICON_SIZE,
                  display: 'block',
                  left: '50%',
                  top: '50%',
                  position: 'absolute',
                }}
              />
            </span>
          ) : state === State.SPEAKING ? (
            <Volume2 size={ICON_SIZE} />
          ) : null}
        </button>
      </div>

      {!conversationalMode && (
        <div
          className={cn(styles.meta, {
            [styles.metaVisible]:
              metaVisible &&
              sources.length !== 0 &&
              (state === State.IDLE || state === State.SPEAKING),
          })}
        >
          <Sources sources={sources} />
        </div>
      )}
    </div>
  );
};

export const renderApp = (id: string) => {
  const root = document.createElement('div');
  root.id = id;
  document.body.appendChild(root);
  root && render(createElement(App, {}), root);
  root.classList.add(styles.container);
  window.setTimeout(() => root.classList.add(styles.containerVisible), 10);
};

export const removeApp = (id: string) => {
  const root = document.getElementById(id);
  if (root) {
    root.classList.remove(styles.containerVisible);
    window.setTimeout(() => {
      render(null, root);
      root.remove();
    }, 200);
  }
};
