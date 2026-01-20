import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { App } from './App';

// Mock audio infrastructure
const createMockMediaStream = (): MediaStream =>
  ({
    getTracks: () => [{ stop: mock(() => {}) }],
  }) as unknown as MediaStream;

const createMockAudioContext = () => {
  const mockProcessor = {
    connect: mock(() => {}),
    disconnect: mock(() => {}),
    onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null,
  };

  const mockSource = {
    connect: mock(() => {}),
    disconnect: mock(() => {}),
  };

  return {
    sampleRate: 16000,
    createMediaStreamSource: mock(() => mockSource),
    createScriptProcessor: mock(() => mockProcessor),
    destination: {},
    close: mock(() => Promise.resolve()),
  };
};

describe('App', () => {
  let originalMediaDevices: MediaDevices | undefined;
  let originalAudioContext: typeof window.AudioContext | undefined;

  beforeEach(() => {
    // Save originals
    originalMediaDevices = navigator.mediaDevices;
    originalAudioContext = window.AudioContext;

    // Mock navigator.mediaDevices
    const mockGetUserMedia = mock(() => Promise.resolve(createMockMediaStream()));
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    // Mock AudioContext
    (window as unknown as { AudioContext: unknown }).AudioContext = mock(
      () => createMockAudioContext()
    );
  });

  afterEach(() => {
    cleanup();
    // Restore originals
    if (originalMediaDevices !== undefined) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        writable: true,
        configurable: true,
      });
    }
    if (originalAudioContext !== undefined) {
      (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
    }
  });

  it('should render microphone button in idle state', () => {
    render(<App />);

    const button = screen.getByRole('button', { name: /start recording/i });
    expect(button).toBeDefined();
    expect(button.className).toContain('idle');
  });

  it('should switch to recording state on click', async () => {
    render(<App />);

    const button = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(button);

    await waitFor(() => {
      const recordingButton = screen.getByRole('button', { name: /stop recording/i });
      expect(recordingButton).toBeDefined();
      expect(recordingButton.className).toContain('recording');
    });
  });

  it('should have mic-button class on button', () => {
    render(<App />);

    const button = screen.getByRole('button', { name: /start recording/i });
    expect(button.className).toContain('mic-button');
  });

  it('should have widget container for drag region', () => {
    render(<App />);

    const widget = document.querySelector('.widget');
    expect(widget).toBeDefined();
  });
});
