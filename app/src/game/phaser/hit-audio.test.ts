import { expect, test, vi } from "vitest";
import { HitAudio, HIT_AUDIO_POLICY } from "./hit-audio";

function context() {
  const oscillators: { onended: (() => void) | null; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const port = {
    state: "running", currentTime: 10, destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const oscillator = { type: "sine", frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null as (() => void) | null };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
  };
  return { port, oscillators, borrowed: port as unknown as AudioContext };
}

test("original quiet cue uses bounded voices and releases ended nodes", () => {
  const fake = context();
  const audio = new HitAudio(() => fake.borrowed);
  for (let hit = 0; hit < 6; hit++) audio.play();
  expect(audio.inspect()).toMatchObject({ requests: 6, played: 4, activeVoices: 4 });
  expect(HIT_AUDIO_POLICY).toMatchObject({ peakGain: 0.018, durationSeconds: 0.055, maxVoices: 4 });
  expect(fake.port.createGain.mock.results[0]!.value.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.018, 10.005);
  fake.oscillators[0]!.onended!();
  expect(audio.inspect().activeVoices).toBe(3);
  expect(fake.oscillators[0]!.disconnect).toHaveBeenCalled();
});

test("mute, suspension and pause drop cues without later catch-up; retry resets and dispose prevents play", async () => {
  const fake = context();
  const audio = new HitAudio(() => fake.borrowed);
  audio.play();
  audio.setMuted(true);
  expect(audio.inspect().activeVoices).toBe(0);
  audio.play();
  audio.setMuted(false);
  fake.port.state = "suspended";
  audio.play();
  fake.port.resume.mockRejectedValueOnce(Error("blocked"));
  audio.unlock();
  await Promise.resolve();
  fake.port.state = "running";
  expect(audio.inspect().played).toBe(1);
  audio.play();
  audio.stop();
  expect(audio.inspect().activeVoices).toBe(0);
  audio.reset();
  expect(audio.inspect()).toMatchObject({ requests: 0, played: 0 });
  audio.dispose();
  audio.play();
  expect(audio.inspect().played).toBe(0);
});

test("missing, throwing and closed audio contexts never block practice", () => {
  for (const getter of [() => null, () => { throw Error("unavailable"); }, () => ({ state: "closed" }) as AudioContext]) {
    const audio = new HitAudio(getter);
    expect(() => { audio.unlock(); audio.play(); audio.stop(); audio.dispose(); }).not.toThrow();
    expect(audio.inspect().activeVoices).toBe(0);
  }
});