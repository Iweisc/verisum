export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;

  async play(audioData: ArrayBuffer): Promise<void> {
    this.stop();

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const buffer = await this.audioContext.decodeAudioData(audioData);
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.audioContext.destination);

    this.isPlaying = true;

    return new Promise<void>((resolve) => {
      if (this.currentSource) {
        this.currentSource.onended = () => {
          this.isPlaying = false;
          resolve();
        };
        this.currentSource.start(0);
      } else {
        resolve();
      }
    });
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  async close(): Promise<void> {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}
