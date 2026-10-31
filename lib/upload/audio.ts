/**
 * Cheap, header-only audio duration estimation — used to enforce the audio
 * duration limit BEFORE a recording is uploaded to Gemini (the byte buffers
 * are already read; probing runs without any extra decode libraries).
 *
 * Formats covered:
 *  - WAV (RIFF): exact — from fmt byte-rate and the data chunk length.
 *  - M4A/MP4 (ftyp): exact — from the mvhd timescale/duration.
 *  - MP3 (incl. ID3v2): estimate — first frame's bitrate, assumed constant.
 * Everything else (webm/ogg…) returns null; those formats are still caught
 * after transcription, where the transcript gives the exact duration.
 */

const u32 = (b: Uint8Array, o: number): number =>
  ((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0);
const ascii = (b: Uint8Array, o: number, n: number): string =>
  String.fromCharCode(...b.subarray(o, o + n));

/** Skip an ID3v2 header if present; returns the offset where audio starts. */
function skipId3(b: Uint8Array): number {
  if (ascii(b, 0, 3) !== "ID3") return 0;
  const size =
    ((b[6] ?? 0) << 21) | ((b[7] ?? 0) << 14) | ((b[8] ?? 0) << 7) | (b[9] ?? 0); // syncsafe
  return 10 + size;
}

const MP3_BITRATES_V1L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const MP3_BITRATES_V2L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
const MP3_RATES_V1 = [44_100, 48_000, 32_000];
const MP3_RATES_V2 = [22_050, 24_000, 16_000];
const MP3_RATES_V25 = [11_025, 12_000, 8_000];

function mp3Duration(b: Uint8Array, size: number): number | null {
  const start = skipId3(b);
  // Find a valid frame header (sync: 0xFF Ex/Fx).
  for (let o = start; o < Math.min(start + 16_384, b.length - 4); o++) {
    if (b[o] !== 0xff || (b[o + 1]! & 0xe0) !== 0xe0) continue;
    const versionBits = (b[o + 1]! & 0x18) >> 3;
    const layerBits = (b[o + 1]! & 0x06) >> 1;
    const bitrateIdx = (b[o + 2]! & 0xf0) >> 4;
    const rateIdx = (b[o + 2]! & 0x0c) >> 2;
    if (versionBits === 1 || layerBits !== 1) continue; // reserved / not layer III
    const v2 = versionBits === 2;
    const v25 = versionBits === 0;
    const bitrate = (v25 || v2 ? MP3_BITRATES_V2L3 : MP3_BITRATES_V1L3)[bitrateIdx]! * 1000;
    const sampleRate =
      (v25 ? MP3_RATES_V25 : v2 ? MP3_RATES_V2 : MP3_RATES_V1)[rateIdx] ?? 0;
    if (!bitrate || !sampleRate) continue;
    // Xing/Info header ⇒ exact frame count (VBR-safe). It sits shortly after
    // the frame header, after the side-info block; scan a small window.
    const window = b.subarray(o + 4, Math.min(o + 48, b.length));
    for (let w = 0; w + 8 <= window.length; w++) {
      const tag = ascii(window, w, 4);
      if (tag !== "Xing" && tag !== "Info") continue;
      const flags = u32(window, w + 4);
      if (flags & 0x01) {
        const frames = u32(window, w + 8);
        const samplesPerFrame = versionBits === 3 ? 1152 : 576 * (v25 ? 2 : 1);
        return (frames * samplesPerFrame) / sampleRate;
      }
      break; // tag present but no frame count — fall through to CBR estimate
    }
    // Constant bitrate assumption: seconds = bytes*8/bitrate.
    return ((size - start) * 8) / bitrate;
  }
  return null;
}

function wavDuration(b: Uint8Array): number | null {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WAVE") return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let byteRate = 0;
  let dataLen = 0;
  let o = 12;
  while (o + 8 <= b.length) {
    const id = ascii(b, o, 4);
    const len = view.getUint32(o + 4, true); // RIFF sizes are little-endian
    if (id === "fmt ") {
      byteRate = view.getUint32(o + 16, true); // average bytes per second
    } else if (id === "data") {
      dataLen = Math.min(len, b.length - o - 8);
      break;
    }
    o += 8 + len + (len % 2);
  }
  return byteRate > 0 && dataLen > 0 ? dataLen / byteRate : null;
}

function m4aDuration(b: Uint8Array): number | null {
  const limit = Math.min(b.length, 2 ** 20) - 24;
  for (let o = 0; o <= limit; o++) {
    if (b[o] !== 0x6d || b[o + 1] !== 0x76 || b[o + 2] !== 0x68 || b[o + 3] !== 0x64) continue; // "mvhd"
    const version = b[o + 4]!;
    if (version === 0) {
      const timescale = u32(b, o + 16);
      const duration = u32(b, o + 20);
      if (timescale > 0 && duration > 0) return duration / timescale;
    } else if (version === 1) {
      // timescale @ +24, duration @ +28 (u32 halves are enough for wall time)
      const timescale = u32(b, o + 24);
      const hi = u32(b, o + 28);
      const lo = u32(b, o + 32) / 2 ** 32;
      if (timescale > 0 && (hi > 0 || lo > 0)) return (hi + lo) / timescale;
    }
    return null;
  }
  return null;
}

/**
 * Estimated duration in seconds, or null when the format isn't probed here
 * (never a guessed number for formats we can't actually parse).
 */
export function estimateAudioDuration(bytes: Uint8Array): number | null {
  if (bytes.length < 128) return null;
  if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) {
    return mp3Duration(bytes, bytes.length);
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return wavDuration(bytes);
  if (ascii(bytes, 4, 4) === "ftyp") return m4aDuration(bytes);
  return null;
}
