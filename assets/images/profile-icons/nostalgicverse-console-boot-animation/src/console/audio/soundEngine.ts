// SoundEngine — a tiny chiptune/buzzer-style synth built on the Web Audio API.
// Designed to emulate what a single-pin piezo buzzer on an ESP32 could produce:
// square/triangle tones, quick envelopes, noise bursts for impacts, and
// time-scheduled melodies. All scheduling uses the AudioContext clock so
// sound stays sample-accurate regardless of requestAnimationFrame jitter.

export type Wave = OscillatorType;

export interface Note {
  freq: number;
  dur: number; // seconds
  gap?: number; // seconds of silence after
  type?: Wave;
  vol?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;
  private _volume = 0.5;
  private activeNodes: Set<AudioScheduledSourceNode> = new Set();

  stopAll() {
    for (const n of this.activeNodes) {
      try {
        n.stop(0);
      } catch {
        /* already stopped */
      }
    }
    this.activeNodes.clear();
  }

  get isReady() {
    return this.ctx !== null;
  }

  init() {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : this._volume;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this.ctx?.resume().catch(() => {});
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this._volume;
  }

  setVolume(v: number) {
    this._volume = v;
    if (this.master && !this._muted) this.master.gain.value = v;
  }

  private tone(freq: number, dur: number, type: Wave = "square", vol = 0.3, when = 0, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + Math.max(0, when);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + Math.min(0.012, dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
    this.activeNodes.add(osc);
    osc.onended = () => this.activeNodes.delete(osc);
  }

  click(when = 0) {
    this.tone(1900, 0.025, "square", 0.22, when);
  }

  tick(mul = 1, when = 0) {
    this.tone(820 * mul, 0.045, "square", 0.28, when);
  }

  beep(freq: number, dur = 0.08, type: Wave = "square", vol = 0.3, when = 0) {
    this.tone(freq, dur, type, vol, when);
  }

  sweep(f0: number, f1: number, dur: number, when = 0, vol = 0.3, type: Wave = "sawtooth") {
    this.tone(f0, dur, type, vol, when, f1);
  }

  noiseBurst(dur = 0.15, vol = 0.35, when = 0, cutoff = 3000) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + Math.max(0, when);
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    this.activeNodes.add(src);
    src.onended = () => this.activeNodes.delete(src);
  }

  // Schedules a sequence of notes starting `startDelay` seconds from now.
  // Returns the total duration (seconds) of the melody.
  melody(notes: Note[], startDelay = 0): number {
    let t = startDelay;
    for (const n of notes) {
      this.tone(n.freq, n.dur, n.type ?? "square", n.vol ?? 0.3, t);
      t += n.dur + (n.gap ?? 0.02);
    }
    return t - startDelay;
  }

  // The recognizable 3-note NostalgicVerse signature — reused for boot,
  // achievements, game launches, victories, etc.
  signature(when = 0, vol = 0.35) {
    this.melody(
      [
        { freq: 523.25, dur: 0.1, vol, type: "square" },
        { freq: 659.25, dur: 0.1, vol, type: "square" },
        { freq: 987.77, dur: 0.22, vol: vol + 0.05, type: "square" },
      ],
      when,
    );
  }
}

export const soundEngine = new SoundEngine();
