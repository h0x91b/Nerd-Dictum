/**
 * WAV encoding utility for converting raw PCM audio data to WAV format
 * Supports 16-bit, mono, 16kHz format as specified for Gemini API
 */

export interface WavEncoderOptions {
  sampleRate?: number;
  numChannels?: number;
  bitsPerSample?: number;
}

const DEFAULT_OPTIONS: Required<WavEncoderOptions> = {
  sampleRate: 16000,
  numChannels: 1,
  bitsPerSample: 16,
};

/**
 * Encodes raw PCM audio data to WAV format with proper headers
 * @param pcmData - Raw PCM audio data (Int16Array or ArrayBuffer)
 * @param options - Encoding options (sampleRate, numChannels, bitsPerSample)
 * @returns ArrayBuffer containing the complete WAV file
 */
export function encodeWav(
  pcmData: Int16Array | ArrayBuffer,
  options: WavEncoderOptions = {}
): ArrayBuffer {
  const { sampleRate, numChannels, bitsPerSample } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // Convert to Int16Array if ArrayBuffer
  const samples =
    pcmData instanceof Int16Array ? pcmData : new Int16Array(pcmData);

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true); // File size minus RIFF header
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples (16-bit little-endian)
  const dataOffset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(dataOffset + i * 2, samples[i], true);
  }

  return buffer;
}

/**
 * Encodes raw PCM audio data to WAV format and returns base64 string
 * @param pcmData - Raw PCM audio data (Int16Array or ArrayBuffer)
 * @param options - Encoding options (sampleRate, numChannels, bitsPerSample)
 * @returns Base64-encoded WAV file ready for API submission
 */
export function encodeWavToBase64(
  pcmData: Int16Array | ArrayBuffer,
  options: WavEncoderOptions = {}
): string {
  const wavBuffer = encodeWav(pcmData, options);
  return arrayBufferToBase64(wavBuffer);
}

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Writes an ASCII string to a DataView at the specified offset
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
