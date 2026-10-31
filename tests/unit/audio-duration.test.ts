/**
 * tests/unit/audio-duration.test.ts
 *
 * Header-only audio duration estimation (lib/upload/audio.ts): WAV exact,
 * M4A mvhd exact, MP3 (ID3 + CBR) estimate, unknown → null.
 */

import { describe, it, expect } from "vitest";
import { estimateAudioDuration } from "@/lib/upload/audio";

const putAscii = (b: Uint8Array, o: number, s: string) => {
  for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i);
};
function setU32be(b: Uint8Array, o: number, v: number) {
  new DataView(b.buffer).setUint32(o, v, false);
}

describe("estimateAudioDuration", () => {
  it("computes exact WAV duration from fmt byte-rate and data length", () => {
    // minimal RIFF/WAVE: 16_000 data bytes @ 16_000 bytes/sec = 1 s
    const b = new Uint8Array(44 + 16_000);
    const d = new DataView(b.buffer);
    putAscii(b, 0, "RIFF");
    putAscii(b, 8, "WAVE");
    putAscii(b, 12, "fmt ");
    putAscii(b, 36, "data");
    d.setUint32(4, 36 + 16_000, true);
    d.setUint32(16, 16, true); // fmt chunk length
    d.setUint32(24, 8_000, true); // sample rate, Hz
    d.setUint32(28, 16_000, true); // byte rate: 8000 samples/s * 2 B
    d.setUint32(40, 16_000, true); // data length

    expect(estimateAudioDuration(b)).toBeCloseTo(1.0, 5);
  });

  it("computes M4A duration from mvhd timescale/duration", () => {
    const b = new Uint8Array(1024);
    putAscii(b, 4, "ftyp");
    const mvhd = 200;
    putAscii(b, mvhd, "mvhd");
    b[mvhd + 4] = 0; // version 0
    setU32be(b, mvhd + 16, 1_000); // timescale
    setU32be(b, mvhd + 20, 90_000); // duration = 90 s

    expect(estimateAudioDuration(b)).toBeCloseTo(90, 5);
  });

  it("estimates CBR MP3 duration, skipping an ID3v2 header", () => {
    const start = 110; // 10-byte ID3v2 header claims 100 payload bytes
    const b = new Uint8Array(start + 120_000);
    putAscii(b, 0, "ID3");
    b[6] = 0; b[7] = 0; b[8] = 0; b[9] = 100; // syncsafe size
    // MPEG1 layer III header: sync ff fb; bitrate index 9 = 128 kbps; 44.1 kHz
    b[start] = 0xff;
    b[start + 1] = 0xfb;
    b[start + 2] = 0x90;

    const dur = estimateAudioDuration(b);
    // (120000 bytes * 8) / 128000 bps = 7.5 s
    expect(dur).not.toBeNull();
    expect(dur).toBeCloseTo(7.5, 1);
  });

  it("returns null for formats it cannot probe (webm) instead of guessing", () => {
    const b = new Uint8Array(256);
    for (const [i, c] of [0x1a, 0x45, 0xdf, 0xa3].entries()) b[i] = c;
    expect(estimateAudioDuration(b)).toBeNull();
    expect(estimateAudioDuration(new Uint8Array(10))).toBeNull();
  });
});
