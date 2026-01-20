import { describe, it, expect } from 'bun:test';
import { encodeWav, encodeWavToBase64 } from './wav-encoder';

describe('encodeWav', () => {
  it('should create a valid WAV header with RIFF signature', () => {
    const pcmData = new Int16Array([0, 100, -100, 32767, -32768]);
    const wavBuffer = encodeWav(pcmData);
    const view = new DataView(wavBuffer);

    // Check RIFF header
    expect(String.fromCharCode(view.getUint8(0))).toBe('R');
    expect(String.fromCharCode(view.getUint8(1))).toBe('I');
    expect(String.fromCharCode(view.getUint8(2))).toBe('F');
    expect(String.fromCharCode(view.getUint8(3))).toBe('F');
  });

  it('should create a valid WAV header with WAVE format', () => {
    const pcmData = new Int16Array([0]);
    const wavBuffer = encodeWav(pcmData);
    const view = new DataView(wavBuffer);

    // Check WAVE format
    expect(String.fromCharCode(view.getUint8(8))).toBe('W');
    expect(String.fromCharCode(view.getUint8(9))).toBe('A');
    expect(String.fromCharCode(view.getUint8(10))).toBe('V');
    expect(String.fromCharCode(view.getUint8(11))).toBe('E');
  });

  it('should set correct file size in header', () => {
    const pcmData = new Int16Array([0, 100, -100]);
    const wavBuffer = encodeWav(pcmData);
    const view = new DataView(wavBuffer);

    // File size at offset 4 = total size - 8 bytes (RIFF + size field)
    const expectedFileSize = 44 + pcmData.length * 2 - 8;
    expect(view.getUint32(4, true)).toBe(expectedFileSize);
  });

  it('should set correct fmt chunk with PCM format', () => {
    const pcmData = new Int16Array([0]);
    const wavBuffer = encodeWav(pcmData);
    const view = new DataView(wavBuffer);

    // fmt chunk marker
    expect(String.fromCharCode(view.getUint8(12))).toBe('f');
    expect(String.fromCharCode(view.getUint8(13))).toBe('m');
    expect(String.fromCharCode(view.getUint8(14))).toBe('t');
    expect(String.fromCharCode(view.getUint8(15))).toBe(' ');

    // Sub-chunk size (16 for PCM)
    expect(view.getUint32(16, true)).toBe(16);

    // Audio format (1 = PCM)
    expect(view.getUint16(20, true)).toBe(1);
  });

  it('should use default options: 16kHz, mono, 16-bit', () => {
    const pcmData = new Int16Array([0]);
    const wavBuffer = encodeWav(pcmData);
    const view = new DataView(wavBuffer);

    // Number of channels (mono = 1)
    expect(view.getUint16(22, true)).toBe(1);

    // Sample rate (16000 Hz)
    expect(view.getUint32(24, true)).toBe(16000);

    // Byte rate (sampleRate * numChannels * bytesPerSample = 16000 * 1 * 2)
    expect(view.getUint32(28, true)).toBe(32000);

    // Block align (numChannels * bytesPerSample = 1 * 2)
    expect(view.getUint16(32, true)).toBe(2);

    // Bits per sample
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('should allow custom sample rate', () => {
    const pcmData = new Int16Array([0]);
    const wavBuffer = encodeWav(pcmData, { sampleRate: 44100 });
    const view = new DataView(wavBuffer);

    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(88200); // 44100 * 1 * 2
  });

  it('should set correct data chunk header', () => {
    const pcmData = new Int16Array([100, 200, 300]);
    const wavBuffer = encodeWav(pcmData);
    const view = new DataView(wavBuffer);

    // data chunk marker
    expect(String.fromCharCode(view.getUint8(36))).toBe('d');
    expect(String.fromCharCode(view.getUint8(37))).toBe('a');
    expect(String.fromCharCode(view.getUint8(38))).toBe('t');
    expect(String.fromCharCode(view.getUint8(39))).toBe('a');

    // Data size (3 samples * 2 bytes)
    expect(view.getUint32(40, true)).toBe(6);
  });

  it('should correctly encode PCM samples as 16-bit little-endian', () => {
    const pcmData = new Int16Array([0, 100, -100, 32767, -32768]);
    const wavBuffer = encodeWav(pcmData);
    const view = new DataView(wavBuffer);

    const dataOffset = 44;
    expect(view.getInt16(dataOffset + 0, true)).toBe(0);
    expect(view.getInt16(dataOffset + 2, true)).toBe(100);
    expect(view.getInt16(dataOffset + 4, true)).toBe(-100);
    expect(view.getInt16(dataOffset + 6, true)).toBe(32767);
    expect(view.getInt16(dataOffset + 8, true)).toBe(-32768);
  });

  it('should handle empty PCM data', () => {
    const pcmData = new Int16Array([]);
    const wavBuffer = encodeWav(pcmData);

    expect(wavBuffer.byteLength).toBe(44); // Header only
  });

  it('should accept ArrayBuffer as input', () => {
    const int16Array = new Int16Array([100, 200]);
    const arrayBuffer = int16Array.buffer;
    const wavBuffer = encodeWav(arrayBuffer);
    const view = new DataView(wavBuffer);

    const dataOffset = 44;
    expect(view.getInt16(dataOffset + 0, true)).toBe(100);
    expect(view.getInt16(dataOffset + 2, true)).toBe(200);
  });

  it('should calculate correct total file size', () => {
    const pcmData = new Int16Array([0, 1, 2, 3, 4]);
    const wavBuffer = encodeWav(pcmData);

    // 44 bytes header + 5 samples * 2 bytes = 54 bytes
    expect(wavBuffer.byteLength).toBe(54);
  });
});

describe('encodeWavToBase64', () => {
  it('should return a valid base64 string', () => {
    const pcmData = new Int16Array([0, 100, -100]);
    const base64 = encodeWavToBase64(pcmData);

    // Should be a valid base64 string (only contains valid base64 chars)
    expect(base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('should encode WAV correctly that can be decoded back', () => {
    const pcmData = new Int16Array([0, 100]);
    const base64 = encodeWavToBase64(pcmData);

    // Decode base64 back to binary
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Verify it's a valid WAV by checking RIFF header
    expect(String.fromCharCode(bytes[0])).toBe('R');
    expect(String.fromCharCode(bytes[1])).toBe('I');
    expect(String.fromCharCode(bytes[2])).toBe('F');
    expect(String.fromCharCode(bytes[3])).toBe('F');
  });

  it('should pass custom options through to encodeWav', () => {
    const pcmData = new Int16Array([0]);
    const base64 = encodeWavToBase64(pcmData, { sampleRate: 44100 });

    // Decode and verify sample rate
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer);

    expect(view.getUint32(24, true)).toBe(44100);
  });
});
