// Custom Base65 encoding using Cyrillic characters for obfuscation
// This is NOT cryptographic security - just makes tokens harder to find via simple string search

// 65 characters: 33 Cyrillic uppercase + 32 Cyrillic lowercase (excluding some confusing ones)
const ALPHABET = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя_';

const BASE = ALPHABET.length; // 65

/**
 * Encode a string to base65 with Cyrillic alphabet
 */
export function encode(input: string): string {
  // Handle empty input
  if (input === '') {
    return '';
  }

  // Convert string to bytes
  const bytes = new TextEncoder().encode(input);

  // Convert bytes to a big integer
  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }

  // Handle input that was all zeros
  if (num === 0n && bytes.length > 0) {
    let result = ALPHABET[0];
    for (let i = 1; i < bytes.length; i++) {
      result += ALPHABET[0];
    }
    return result;
  }

  // Convert to base65
  let result = '';
  while (num > 0n) {
    const remainder = Number(num % BigInt(BASE));
    result = ALPHABET[remainder] + result;
    num = num / BigInt(BASE);
  }

  // Preserve leading zero bytes
  for (const byte of bytes) {
    if (byte === 0) {
      result = ALPHABET[0] + result;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Decode a base65 Cyrillic string back to original
 */
export function decode(input: string): string {
  if (!input) {
    return '';
  }

  // Count leading "zeros" (first character of alphabet)
  let leadingZeros = 0;
  for (const char of input) {
    if (char === ALPHABET[0]) {
      leadingZeros++;
    } else {
      break;
    }
  }

  // Convert from base65 to big integer
  let num = 0n;
  for (const char of input) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid character in base65 string: ${char}`);
    }
    num = num * BigInt(BASE) + BigInt(index);
  }

  // Convert big integer to bytes
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }

  // Add leading zero bytes
  for (let i = 0; i < leadingZeros; i++) {
    bytes.unshift(0);
  }

  // Convert bytes back to string
  return new TextDecoder().decode(new Uint8Array(bytes));
}
