export const HIT_AUDIO_POLICY = {
  peakGain: 0.018,
  attackSeconds: 0.005,
  durationSeconds: 0.055,
  startFrequencyHz: 440,
  endFrequencyHz: 220,
  maxVoices: 4,
} as const;

type Voice = { oscillator: OscillatorNode; gain: GainNode };

export class HitAudio {
  private voices = new Set<Voice>();
  private muted = false;
  private disposed = false;
  private requests = 0;
  private played = 0;
  private getContext: () => AudioContext | null;

  constructor(getContext: () => AudioContext | null) {
    this.getContext = getContext;
  }

  unlock(): void {
    if (this.disposed) return;
    try {
      const context = this.getContext();
      if (context?.state === "suspended") void context.resume().catch(() => {});
    } catch {}
  }

  play(): void {
    if (this.disposed) return;
    this.requests++;
    if (this.muted || this.voices.size >= HIT_AUDIO_POLICY.maxVoices) return;
    let oscillator: OscillatorNode | undefined;
    let gain: GainNode | undefined;
    try {
      const context = this.getContext();
      if (!context || context.state !== "running") return;
      oscillator = context.createOscillator();
      gain = context.createGain();
      const now = context.currentTime;
      const policy = HIT_AUDIO_POLICY;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(policy.startFrequencyHz, now);
      oscillator.frequency.linearRampToValueAtTime(
        policy.endFrequencyHz,
        now + policy.durationSeconds,
      );
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(
        policy.peakGain,
        now + policy.attackSeconds,
      );
      gain.gain.linearRampToValueAtTime(0, now + policy.durationSeconds);
      oscillator.connect(gain);
      gain.connect(context.destination);
      const voice = { oscillator, gain };
      oscillator.onended = () => this.release(voice);
      oscillator.start(now);
      oscillator.stop(now + policy.durationSeconds);
      this.voices.add(voice);
      this.played++;
    } catch {
      oscillator?.disconnect();
      gain?.disconnect();
    }
  }

  private release(voice: Voice): void {
    voice.oscillator.onended = null;
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }

  stop(): void {
    for (const voice of this.voices) {
      try {
        voice.oscillator.stop();
      } catch {}
      this.release(voice);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stop();
  }
  reset(): void {
    this.stop();
    this.requests = 0;
    this.played = 0;
  }
  dispose(): void {
    this.stop();
    this.disposed = true;
  }
  inspect() {
    return {
      muted: this.muted,
      requests: this.requests,
      played: this.played,
      activeVoices: this.voices.size,
    };
  }
}
