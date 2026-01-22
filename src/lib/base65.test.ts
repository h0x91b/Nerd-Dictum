import { describe, expect, test } from 'bun:test';
import { encode, decode } from './base65';

describe('base65', () => {
  describe('encode/decode roundtrip', () => {
    test('simple ASCII string', () => {
      const input = 'hello';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('empty string', () => {
      const input = '';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('single character', () => {
      const input = 'a';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('numbers', () => {
      const input = '12345';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('special characters', () => {
      const input = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('GitHub token format', () => {
      const input = 'github_pat_xxxxxxxxxxxxxxxxxxxx';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('long string', () => {
      const input = 'a'.repeat(1000);
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('unicode string', () => {
      const input = 'Hello, мир! 你好世界';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('string with newlines', () => {
      const input = 'line1\nline2\r\nline3';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('string with null bytes', () => {
      const input = 'hello\x00world';
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });

    test('all printable ASCII characters', () => {
      let input = '';
      for (let i = 32; i < 127; i++) {
        input += String.fromCharCode(i);
      }
      const encoded = encode(input);
      const decoded = decode(encoded);
      expect(decoded).toBe(input);
    });
  });

  describe('encode', () => {
    test('produces only Cyrillic characters and underscore', () => {
      const input = 'github_pat_test123';
      const encoded = encode(input);
      // Should only contain Cyrillic letters and underscore
      expect(encoded).toMatch(/^[А-Яа-яЁё_]+$/);
    });

    test('does not contain original string', () => {
      const input = 'github_pat_SECRET';
      const encoded = encode(input);
      expect(encoded).not.toContain('github');
      expect(encoded).not.toContain('pat');
      expect(encoded).not.toContain('SECRET');
    });

    test('different inputs produce different outputs', () => {
      const encoded1 = encode('hello');
      const encoded2 = encode('world');
      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe('decode', () => {
    test('throws on invalid character', () => {
      expect(() => decode('hello')).toThrow('Invalid character');
    });

    test('throws on mixed valid/invalid', () => {
      expect(() => decode('АБВxyz')).toThrow('Invalid character');
    });
  });

  describe('real token test', () => {
    test('actual GitHub PAT format roundtrip', () => {
      // Test with realistic token patterns
      const patterns = [
        'github_pat_11AAGFYGY0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      ];

      for (const pattern of patterns) {
        const encoded = encode(pattern);
        const decoded = decode(encoded);
        expect(decoded).toBe(pattern);
        // Verify encoded doesn't leak original
        expect(encoded).not.toContain('github');
        expect(encoded).not.toContain('ghp');
        expect(encoded).not.toContain('gho');
      }
    });
  });
});
