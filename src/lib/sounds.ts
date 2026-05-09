/**
 * Sound feedback utilities using Web Audio API
 * Generates small notification sounds without requiring audio files
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a success sound - short ascending tone
 */
export function playSuccessSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';

    // Two-note ascending chime
    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.setValueAtTime(1200, now + 0.1);

    // Quick fade in/out envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gainNode.gain.setValueAtTime(0.3, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.25);

    oscillator.start(now);
    oscillator.stop(now + 0.25);
  } catch (error) {
    console.error('[Sound] Failed to play success sound:', error);
  }
}

/**
 * Play a recording-start sound — short rising blip, distinct from success.
 */
export function playStartSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';

    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.linearRampToValueAtTime(900, now + 0.08);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.015);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.12);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    console.error('[Sound] Failed to play start sound:', error);
  }
}

/**
 * Play an error/no-speech sound — short low double-blip ("buh-buh"),
 * square wave for distinctiveness so it's clearly different from the
 * success / paste tones.
 */
export function playErrorSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';

    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(220, now);

    // First blip
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
    // Brief silence
    gainNode.gain.setValueAtTime(0, now + 0.13);
    // Second blip
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.14);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.24);

    oscillator.start(now);
    oscillator.stop(now + 0.26);
  } catch (error) {
    console.error('[Sound] Failed to play error sound:', error);
  }
}
