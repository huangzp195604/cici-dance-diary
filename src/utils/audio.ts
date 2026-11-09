/**
 * Web Audio API based Jazz Metronome & Groove Synth
 * Generates natural warm click & swing beats without external audio files.
 *
 * 2026-11 音量修正（用户反馈「手机音量开到最大还是小」）：
 * 1) 原来重音 880Hz/三角波、弱拍 440Hz/正弦波，峰值增益 0.35 / 0.2，衰减只有 80ms。
 *    440Hz 正弦在手机小喇叭上几乎不出声（低频被滚降掉），0.2 的峰值又只有 -14dB。
 * 2) 现在弱拍也升到 880Hz、重音 1320Hz，统一三角波（带奇次谐波，小喇叭更容易推出来），
 *    峰值提到 0.95 / 0.72，衰减拉到 130ms。相对原实现约 +8dB 峰值 + 明显更高的感知响度。
 * 3) 中间加了一级总音量节点（0~100%），默认 90%，用户可在节拍器面板里调，
 *    设置写进 localStorage，下次打开还是上次的音量。
 * 4) 起音加了 4ms 斜坡：直接从 0 跳到 0.95 会有「咔」的爆音。
 */

const VOLUME_STORAGE_KEY = 'cici_metronome_volume_v1';
const DEFAULT_VOLUME = 0.9;

class JazzMetronome {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private isRunning: boolean = false;
  private tempo: number = 96; // typical mid-tempo Jazz / Choreo BPM
  private currentCount: number = 0; // 0 to 7 (1 to 8 count)
  private timerId: number | null = null;
  private onBeatCallback: ((count: number) => void) | null = null;
  private volume: number = DEFAULT_VOLUME;

  constructor() {
    this.loadVolume();
  }

  private loadVolume() {
    try {
      const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      if (raw === null) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) this.volume = Math.min(1, Math.max(0, parsed));
    } catch {
      // 隐私模式 / 禁用 localStorage 时静默降级到默认音量
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    // 所有节拍都经过这一级总音量，改音量不用重建振荡器
    if (!this.master && this.ctx) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** 0 ~ 1，超出范围自动夹紧 */
  public getVolume(): number {
    return this.volume;
  }

  public setVolume(next: number) {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(next) ? next : DEFAULT_VOLUME));
    this.volume = clamped;
    if (this.master && this.ctx) {
      // 15ms 平滑过渡，拖动滑块时不会「啪」一下
      this.master.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.015);
    }
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
    } catch {
      // 存不上就只在本次会话生效，不影响发声
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

    this.playTone(time, isAccent ? 1320 : 880, isAccent ? 0.95 : 0.72);

    if (this.onBeatCallback) {
      this.onBeatCallback(countIndex + 1);
    }

    this.currentCount = (this.currentCount + 1) % 8;

    const intervalMs = (60 / this.tempo) * 1000;
    this.timerId = window.setTimeout(() => {
      this.scheduleNextBeat();
    }, intervalMs);
  }

  private playTone(time: number, freq: number, peak: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // 三角波带奇次谐波：手机小喇叭上比正弦波明显更「亮」、更容易听清
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    // exponentialRamp 不能以 0 为起点，用一个极小数起步；4ms 起音避免爆音
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0012, time + 0.13);

    osc.connect(gain);
    gain.connect(this.master);

    osc.start(time);
    osc.stop(time + 0.14);
  }
}

export const metronomeInstance = new JazzMetronome();
