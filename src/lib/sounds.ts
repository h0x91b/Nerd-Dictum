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
 * Play an error sound - short descending tone
 */
export function playErrorSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';

    // Two-note descending tone
    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.setValueAtTime(300, now + 0.15);

    // Quick fade in/out envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gainNode.gain.setValueAtTime(0.3, now + 0.15);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.3);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  } catch (error) {
    console.error('[Sound] Failed to play error sound:', error);
  }
}
