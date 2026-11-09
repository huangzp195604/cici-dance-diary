/**
 * Web Audio API based Jazz Metronome & Groove Synth
 * Generates natural warm click & swing beats without external audio files.
 */

class JazzMetronome {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private tempo: number = 96; // typical mid-tempo Jazz / Choreo BPM
  private currentCount: number = 0; // 0 to 7 (1 to 8 count)
  private timerId: number | null = null;
  private onBeatCallback: ((count: number) => void) | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setTempo(newBpm: number) {
    this.tempo = Math.max(60, Math.min(180, newBpm));
  }

  public getTempo(): number {
    return this.tempo;
  }

  public setOnBeat(cb: (count: number) => void) {
    this.onBeatCallback = cb;
  }

  public start() {
    if (this.isRunning) return;
    this.initContext();
    this.isRunning = true;
    this.currentCount = 0;
    this.scheduleNextBeat();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.currentCount = 0;
    if (this.onBeatCallback) {
      this.onBeatCallback(0);
    }
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private scheduleNextBeat() {
    if (!this.isRunning || !this.ctx) return;

    const time = this.ctx.currentTime + 0.05;
    const countIndex = this.currentCount; // 0..7 representing counts 1..8
    const isAccent = countIndex === 0 || countIndex === 4; // 1 and 5 count in dance

    this.playTone(time, isAccent ? 880 : 440, isAccent ? 0.35 : 0.2);

    if (this.onBeatCallback) {
      this.onBeatCallback(countIndex + 1);
    }

    this.currentCount = (this.currentCount + 1) % 8;

    const intervalMs = (60 / this.tempo) * 1000;
    this.timerId = window.setTimeout(() => {
      this.scheduleNextBeat();
    }, intervalMs);
  }

  private playTone(time: number, freq: number, gainValue: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = freq > 600 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.09);
  }
}

export const metronomeInstance = new JazzMetronome();
