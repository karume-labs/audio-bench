/**
 * Generates a 5-second fixture audio file for local development:
 *
 *   fixtures/test_session.wav  44.1 kHz stereo 16-bit PCM - two short
 *                              speech-like bursts separated by silence.
 *
 * Run: bun tools/make-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(ROOT, "fixtures");

const SAMPLE_RATE = 44_100;
const LEAD_SILENCE_S = 0.3;
const GAP_SILENCE_S = 1.0;
const EDGE_RAMP_S = 0.03;

const LINES = [{ speechSeconds: 1.8 }, { speechSeconds: 1.6 }];

let seed = 0x2f6e2b1;
const noise = (): number => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296 - 0.5;
};

const buildAudio = (): { left: Float32Array; right: Float32Array } => {
  const totalSamples = Math.ceil(
    (LEAD_SILENCE_S +
      LINES.reduce((sum, l) => sum + l.speechSeconds, 0) +
      (LINES.length - 1) * GAP_SILENCE_S +
      LEAD_SILENCE_S) *
      SAMPLE_RATE,
  );

  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const writeSilence = (from: number, count: number): void => {
    for (let i = from; i < from + count && i < totalSamples; i++) {
      left[i] = noise() * 0.002;
      right[i] = noise() * 0.002;
    }
  };

  let cursor = Math.floor(LEAD_SILENCE_S * SAMPLE_RATE);
  writeSilence(0, cursor);

  LINES.forEach((line, index) => {
    const n = Math.floor(line.speechSeconds * SAMPLE_RATE);
    const ramp = Math.floor(EDGE_RAMP_S * SAMPLE_RATE);
    const syllableRate = 3.1 + index * 0.4;

    for (let i = 0; i < n && cursor + i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      const syllable =
        0.55 + 0.45 * Math.sin(2 * Math.PI * syllableRate * t + index);
      const env = Math.max(0.12, syllable);
      const rampIn = Math.min(1, i / ramp);
      const rampOut = Math.min(1, (n - i) / ramp);
      const gain = env * rampIn * rampOut;

      const voiceL =
        0.6 * Math.sin(2 * Math.PI * 170 * t) +
        0.3 * Math.sin(2 * Math.PI * 340 * t + 0.6) +
        0.12 * Math.sin(2 * Math.PI * 515 * t + 1.2) +
        0.06 * Math.sin(2 * Math.PI * 690 * t);
      const tR = Math.max(0, t - 3 / SAMPLE_RATE);
      const voiceR =
        0.6 * Math.sin(2 * Math.PI * 170 * tR) +
        0.3 * Math.sin(2 * Math.PI * 340 * tR + 0.6) +
        0.12 * Math.sin(2 * Math.PI * 515 * tR + 1.2) +
        0.06 * Math.sin(2 * Math.PI * 690 * tR);

      left[cursor + i] = 0.5 * gain * voiceL;
      right[cursor + i] = 0.5 * gain * voiceR;
    }

    cursor += n;
    if (index < LINES.length - 1) {
      const gap = Math.floor(GAP_SILENCE_S * SAMPLE_RATE);
      writeSilence(cursor, gap);
      cursor += gap;
    }
  });
  writeSilence(cursor, totalSamples - cursor);

  return { left, right };
};

const writeWav = (
  path: string,
  left: Float32Array,
  right: Float32Array,
): void => {
  const frames = left.length;
  const dataBytes = frames * 2 * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2 * 2, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, left[i])) * 32767),
      offset,
    );
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, right[i])) * 32767),
      offset + 2,
    );
    offset += 4;
  }

  writeFileSync(path, buffer);
};

mkdirSync(FIXTURES_DIR, { recursive: true });
const { left, right } = buildAudio();
writeWav(join(FIXTURES_DIR, "test_session.wav"), left, right);

console.log(
  `Generated ${(left.length / SAMPLE_RATE).toFixed(1)}s of audio in ${FIXTURES_DIR}`,
);
