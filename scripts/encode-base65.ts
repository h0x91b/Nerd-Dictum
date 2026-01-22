#!/usr/bin/env bun
import { encode, decode } from '../src/lib/base65';

const input = process.argv[2];

if (!input) {
  console.error('Usage: bun scripts/encode-base65.ts <string>');
  process.exit(1);
}

const encoded = encode(input);
const decoded = decode(encoded);

console.log('Input:', input);
console.log('Input length:', input.length);
console.log('');
console.log('Encoded:', encoded);
console.log('Encoded length:', encoded.length);
console.log('');
console.log('Decoded:', decoded);
console.log('Decoded length:', decoded.length);
console.log('');
console.log('Match:', input === decoded ? '✅ OK' : '❌ MISMATCH');
