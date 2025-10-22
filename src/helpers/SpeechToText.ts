class SpeechToText {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;

  public start = () => {
    if (this.recognition) {
      throw new Error('Already started');
    }
    this.recognition = new webkitSpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 5;
    this.recognition.continuous = false;

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    this.isListening = true;
    this.recognition.start();
  };

  public stop = (): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Not started'));
        return;
      }

      const currentRecognition = this.recognition;

      currentRecognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        resolve(transcript);
      };

      currentRecognition.onerror = (event) => {
        reject(new Error(`Recognition error: ${event.error}`));
      };

      try {
        currentRecognition.stop();
      } catch (e) {
        reject(e);
      }

      this.recognition = null;
      this.isListening = false;
    });

  public isActive = (): boolean => {
    return this.isListening;
  };

  public abort = () => {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
      this.recognition = null;
      this.isListening = false;
    }
  };
}

export default SpeechToText;
