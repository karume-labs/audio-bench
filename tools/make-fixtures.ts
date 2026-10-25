/**
 * Generates deterministic fixture assets for local development:
 *
 *   fixtures/test_session.wav  44.1 kHz stereo 16-bit PCM — speech-like
 *                              bursts separated by 1.8s silences. The 44.1k
 *                              stereo format intentionally exercises the
 *                              conform pipeline (downmix + resample) rather
 *                              than being master-ready.
 *   fixtures/test_script.csv   7-digit IDs + sentences matching the bursts.
 *
 * Run: bun tools/make-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(ROOT, "fixtures");

const SAMPLE_RATE = 44_100;
const LEAD_SILENCE_S = 0.4;
const GAP_SILENCE_S = 1.8; // > min_silence_ms default (1500ms) so cuts land in the gaps
const EDGE_RAMP_S = 0.03;

interface ScriptLine {
  id: string;
  text: string;
  speechSeconds: number;
}

// 10 lines: IDs are 7-digit strings (leading zeros are load-bearing).
const SCRIPT: ScriptLine[] = [
  {
    id: "0100101",
    text: "Welcome to the audio workbench demonstration.",
    speechSeconds: 2.4,
  },
  {
    id: "0100102",
    text: "Each sentence here is a separate clip to align.",
    speechSeconds: 2.6,
  },
  {
    id: "0100103",
    text: "Silence between lines lets the detector find the cuts.",
    speechSeconds: 2.8,
  },
  {
    id: "0100104",
    text: "The master is conformed to forty eight kilohertz.",
    speechSeconds: 2.5,
  },
  {
    id: "0100105",
    text: "Twenty four bit depth preserves every detail.",
    speechSeconds: 2.3,
  },
  {
    id: "0100106",
    text: "Review flagged clips before exporting the batch.",
    speechSeconds: 2.6,
  },
  {
    id: "0100107",
    text: "Split and merge operations shift later identifiers.",
    speechSeconds: 2.7,
  },
  {
    id: "0100108",
    text: "Anchored clips stay locked during reassignment.",
    speechSeconds: 2.4,
  },
  {
    id: "0100109",
    text: "Every export window carries five seconds of padding.",
    speechSeconds: 2.9,
  },
  {
    id: "0100110",
    text: "The manifest preserves leading zeros in the names.",
    speechSeconds: 2.6,
  },
];

/** Deterministic pseudo-random noise in [-1, 1]. */
let seed = 0x2f6e2b1;
const noise = (): number => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296 - 0.5;
};

const buildAudio = (): { left: Float32Array; right: Float32Array } => {
  const totalSamples = Math.ceil(
    (LEAD_SILENCE_S +
      SCRIPT.reduce((sum, l) => sum + l.speechSeconds, 0) +
      (SCRIPT.length - 1) * GAP_SILENCE_S +
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

  SCRIPT.forEach((line, index) => {
    const dur = line.speechSeconds;
    const n = Math.floor(dur * SAMPLE_RATE);
    const ramp = Math.floor(EDGE_RAMP_S * SAMPLE_RATE);
    const syllableRate = 3.1 + (index % 3) * 0.4; // vary cadence per line

    for (let i = 0; i < n && cursor + i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      // Sentence envelope: syllable modulation with attack/release ramps.
      const syllable =
        0.55 + 0.45 * Math.sin(2 * Math.PI * syllableRate * t + index);
      const env = Math.max(0.12, syllable);
      const rampIn = Math.min(1, i / ramp);
      const rampOut = Math.min(1, (n - i) / ramp);
      const gain = env * rampIn * rampOut;

      // Harmonic stack roughly matching a voice's formants.
      const voiceL =
        0.6 * Math.sin(2 * Math.PI * 170 * t) +
        0.3 * Math.sin(2 * Math.PI * 340 * t + 0.6) +
        0.12 * Math.sin(2 * Math.PI * 515 * t + 1.2) +
        0.06 * Math.sin(2 * Math.PI * 690 * t);
      // Right channel: same content with a tiny decorrelation delay so the
      // downmix stays well-correlated (no anti-correlation warning expected).
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
    if (index < SCRIPT.length - 1) {
      const gap = Math.floor(GAP_SILENCE_S * SAMPLE_RATE);
      writeSilence(cursor, gap);
      cursor += gap;
    }
  });
  writeSilence(cursor, totalSamples - cursor);

  return { left, right };
};

/** Minimal 16-bit PCM stereo WAV writer (RIFF, little-endian). */
const writeWav = (
  path: string,
  left: Float32Array,
  right: Float32Array,
): void => {
  const frames = left.length;
  const dataBytes = frames * 2 /* channels */ * 2 /* bytes per sample */;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM header size
  buffer.writeUInt16LE(1, 20); // format = PCM
  buffer.writeUInt16LE(2, 22); // channels
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2 * 2, 28); // byte rate
  buffer.writeUInt16LE(4, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
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

/** RFC 4180 CSV escaping. */
const csvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const writeCsv = (path: string): void => {
  const lines = [SCRIPT.map((l) => `${l.id},${csvField(l.text)}`).join("\n")];
  // With no commas in the IDs, a header row exercises header detection too.
  const header = "id,text";
  writeFileSync(path, `${header}\n${lines.join("\n")}\n`, "utf8");
};

mkdirSync(FIXTURES_DIR, { recursive: true });
const { left, right } = buildAudio();
writeWav(join(FIXTURES_DIR, "test_session.wav"), left, right);
writeCsv(join(FIXTURES_DIR, "test_script.csv"));

console.log(
  `Generated ${SCRIPT.length} lines / ${(left.length / SAMPLE_RATE).toFixed(1)}s of audio in ${FIXTURES_DIR}`,
);
