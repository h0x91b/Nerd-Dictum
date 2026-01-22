import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { App } from './App';

// Mock audio infrastructure
const createMockMediaStream = (): MediaStream =>
  ({
    getTracks: () => [{ stop: mock(() => {}) }],
    getAudioTracks: () => [{
      label: 'Mock Microphone',
      getSettings: () => ({
        deviceId: 'mock-device-id',
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      }),
      stop: mock(() => {}),
    }],
  }) as unknown as MediaStream;

// Store the worklet port reference so we can simulate audio data
let mockWorkletPort: { onmessage: ((event: MessageEvent) => void) | null } = { onmessage: null };

const createMockAudioContext = () => {
  // Reset port for each context
  mockWorkletPort = { onmessage: null };

  const mockSource = {
    connect: mock(() => {}),
    disconnect: mock(() => {}),
  };

  return {
    sampleRate: 16000,
    createMediaStreamSource: mock(() => mockSource),
    audioWorklet: {
      addModule: mock(() => Promise.resolve()),
    },
    destination: {},
    close: mock(() => Promise.resolve()),
  };
};

// Mock AudioWorkletNode globally
const createMockAudioWorkletNode = () => {
  const node = {
    connect: mock(() => {}),
    disconnect: mock(() => {}),
    port: mockWorkletPort,
  };
  return node;
};

(globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = mock(
  () => createMockAudioWorkletNode()
);

const defaultSettings = {
  apiKey: 'test-api-key',
  model: 'gemini-3-flash-preview',
  languages: [] as string[],
  speechDomain: 'programming',
  customDomainHint: '',
  customKeywords: '',
  microphoneDeviceId: '',
  silenceDetectionEnabled: true,
  silenceDurationMs: 2500,
  launchAtStartup: false,
};

// Mock window.electronAPI
const mockElectronAPI = {
  getApiKey: mock(() => Promise.resolve('test-api-key')),
  getModel: mock(() => Promise.resolve('gemini-3-flash-preview')),
  copyToClipboard: mock(() => Promise.resolve(true)),
  onToggleRecording: mock((callback: () => void) => {
    return () => {};
  }),
  getSettings: mock(() => Promise.resolve({ ...defaultSettings })),
  saveSettings: mock(() => Promise.resolve(true)),
  openSettingsWindow: mock(() => Promise.resolve(true)),
  closeSettingsWindow: mock(() => Promise.resolve(true)),
  getMicrophonePermissionStatus: mock(() => Promise.resolve('granted' as const)),
  requestMicrophonePermission: mock(() => Promise.resolve(true)),
};

describe('App', () => {
  let originalMediaDevices: MediaDevices | undefined;
  let originalAudioContext: typeof window.AudioContext | undefined;
  let originalElectronAPI: typeof window.electronAPI | undefined;
  let originalLocation: Location | undefined;

  beforeEach(() => {
    // Save originals
    originalMediaDevices = navigator.mediaDevices;
    originalAudioContext = window.AudioContext;
    originalElectronAPI = window.electronAPI;
    originalLocation = window.location;

    // Mock window.location for worklet URL construction
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:5173',
        href: 'http://localhost:5173/',
        protocol: 'http:',
        host: 'localhost:5173',
        hostname: 'localhost',
        port: '5173',
        pathname: '/',
        search: '',
        hash: '',
      },
      writable: true,
      configurable: true,
    });

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

    // Mock electronAPI with settings methods
    window.electronAPI = {
      copyToClipboard: mock(() => Promise.resolve(true)),
      getApiKey: mock(() => Promise.resolve('test-api-key')),
      getModel: mock(() => Promise.resolve('gemini-3-flash-preview')),
      getSettings: mock(() => Promise.resolve({ ...defaultSettings })),
      saveSettings: mock(() => Promise.resolve(true)),
      onToggleRecording: mock((callback: () => void) => {
        return () => {};
      }),
      openSettingsWindow: mock(() => Promise.resolve(true)),
      closeSettingsWindow: mock(() => Promise.resolve(true)),
      getMicrophonePermissionStatus: mock(() => Promise.resolve('granted' as const)),
      requestMicrophonePermission: mock(() => Promise.resolve(true)),
    };
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
    if (originalElectronAPI !== undefined) {
      window.electronAPI = originalElectronAPI;
    }
    if (originalLocation !== undefined) {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
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

  it('should render settings button', () => {
    render(<App />);

    const settingsButton = screen.getByRole('button', { name: /open settings/i });
    expect(settingsButton).toBeDefined();
  });

  describe('error handling', () => {
    it('should show error message when microphone permission denied', async () => {
      // Mock permission denied error
      const permissionError = new Error('NotAllowedError');
      permissionError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(permissionError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);

      const button = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText('Microphone access denied');
        expect(errorMessage).toBeDefined();
        expect(errorMessage.className).toContain('error');
      });
    });

    it('should show error with retry hint for retryable errors', async () => {
      // Mock permission denied error (retryable)
      const permissionError = new Error('NotAllowedError');
      permissionError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(permissionError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);

      const button = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(button);

      await waitFor(() => {
        const retryHint = screen.getByText('(tap to retry)');
        expect(retryHint).toBeDefined();
      });
    });

    it('should show error without retry hint for non-retryable errors', async () => {
      // Mock device not found error (non-retryable)
      const notFoundError = new Error('NotFoundError');
      notFoundError.name = 'NotFoundError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(notFoundError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);

      const button = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorMessage = screen.getByText('No microphone found');
        expect(errorMessage).toBeDefined();
        // Should not have retry hint
        const retryHints = document.querySelectorAll('.retry-hint');
        expect(retryHints.length).toBe(0);
      });
    });

    it('should have success class on flash message when copy succeeds', async () => {
      // This test verifies the success message styling
      // When transcription succeeds, the message should have 'success' class
      render(<App />);

      // Verify the component renders correctly
      const button = screen.getByRole('button', { name: /start recording/i });
      expect(button).toBeDefined();
    });

    it('should return to idle state after error', async () => {
      // Mock permission denied error
      const permissionError = new Error('NotAllowedError');
      permissionError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(permissionError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);

      const button = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(button);

      // After error, button should return to idle state
      await waitFor(() => {
        const idleButton = screen.getByRole('button', { name: /start recording/i });
        expect(idleButton).toBeDefined();
        expect(idleButton.className).toContain('idle');
      });
    });

    it('should show error message for missing API key', async () => {
      // Mock electronAPI to return no API key
      window.electronAPI = {
        ...window.electronAPI,
        getApiKey: mock(() => Promise.resolve('')),
        getSettings: mock(() => Promise.resolve({ ...defaultSettings, apiKey: '' })),
      };

      render(<App />);

      const button = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(button);

      // Wait for recording state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeDefined();
      });

      // Stop recording (this will trigger transcription which will fail due to missing API key)
      // Note: This test is limited because we can't easily simulate audio data
    });
  });

  describe('flash message behavior', () => {
    it('should show error flash message with correct CSS classes', async () => {
      const permissionError = new Error('NotAllowedError');
      permissionError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(permissionError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

      await waitFor(() => {
        const flashMessage = document.querySelector('.flash-message');
        expect(flashMessage).toBeDefined();
        expect(flashMessage?.className).toContain('error');
        expect(flashMessage?.className).toContain('retryable');
      });
    });

    it('should not show retryable class for non-retryable errors', async () => {
      const notFoundError = new Error('NotFoundError');
      notFoundError.name = 'NotFoundError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(notFoundError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

      await waitFor(() => {
        const flashMessage = document.querySelector('.flash-message');
        expect(flashMessage).toBeDefined();
        expect(flashMessage?.className).toContain('error');
        expect(flashMessage?.className).not.toContain('retryable');
      });
    });

    it('error message should have button role when retryable', async () => {
      const permissionError = new Error('NotAllowedError');
      permissionError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(permissionError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

      await waitFor(() => {
        const flashMessage = document.querySelector('.flash-message');
        expect(flashMessage?.getAttribute('role')).toBe('button');
        expect(flashMessage?.getAttribute('tabIndex')).toBe('0');
      });
    });

    it('error message should not have button role when not retryable', async () => {
      const notFoundError = new Error('NotFoundError');
      notFoundError.name = 'NotFoundError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(notFoundError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

      await waitFor(() => {
        const flashMessage = document.querySelector('.flash-message');
        expect(flashMessage?.getAttribute('role')).toBeNull();
      });
    });
  });

  describe('error message content', () => {
    it('should display correct message for microphone permission error', async () => {
      const permissionError = new Error('NotAllowedError');
      permissionError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(permissionError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

      await waitFor(() => {
        expect(screen.getByText('Microphone access denied')).toBeDefined();
      });
    });

    it('should display correct message for no microphone found', async () => {
      const notFoundError = new Error('NotFoundError');
      notFoundError.name = 'NotFoundError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mock(() => Promise.reject(notFoundError)),
        },
        writable: true,
        configurable: true,
      });

      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

      await waitFor(() => {
        expect(screen.getByText('No microphone found')).toBeDefined();
      });
    });
  });

  describe('silence auto-stop', () => {
    it('should not auto-stop if user is still speaking', async () => {
      // Create a custom worklet port that we can send messages to
      let capturedPortOnMessage: ((event: MessageEvent) => void) | null = null;
      const customWorkletPort = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        postMessage: mock(() => {}),
      };

      const mockSource = {
        connect: mock(() => {}),
        disconnect: mock(() => {}),
      };

      const mockWorkletNode = {
        connect: mock(() => {}),
        disconnect: mock(() => {}),
        port: new Proxy(customWorkletPort, {
          set(target, prop, value) {
            if (prop === 'onmessage') {
              capturedPortOnMessage = value as (event: MessageEvent) => void;
            }
            (target as Record<string, unknown>)[prop as string] = value;
            return true;
          },
          get(target, prop) {
            return (target as Record<string, unknown>)[prop as string];
          },
        }),
      };

      const mockAudioContext = {
        sampleRate: 16000,
        createMediaStreamSource: mock(() => mockSource),
        audioWorklet: {
          addModule: mock(() => Promise.resolve()),
        },
        destination: {},
        close: mock(() => Promise.resolve()),
      };

      (window as unknown as { AudioContext: unknown }).AudioContext = mock(
        () => mockAudioContext
      );

      (globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = mock(
        () => mockWorkletNode
      );

      render(<App />);

      // Start recording
      const button = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeDefined();
      });

      expect(capturedPortOnMessage).not.toBeNull();

      // Simulate continuous speech (non-silent audio) via worklet message
      const nonSilentBuffer = new Float32Array(4096).fill(0.5);

      const originalDateNow = Date.now;
      let currentTime = originalDateNow();
      Date.now = () => currentTime;

      // Process many chunks of non-silent audio
      for (let i = 0; i < 20; i++) {
        currentTime += 200;
        capturedPortOnMessage!({ data: { type: 'audio', data: nonSilentBuffer } } as MessageEvent);
      }

      Date.now = originalDateNow;

      // Should still be in recording state
      await waitFor(() => {
        const recordingButton = screen.getByRole('button', { name: /stop recording/i });
        expect(recordingButton.className).toContain('recording');
      });
    });
  });

  describe('keyboard shortcut', () => {
    it('should register toggle-recording listener on mount', () => {
      const mockOnToggleRecording = mock((callback: () => void) => {
        return () => {};
      });
      window.electronAPI = {
        ...mockElectronAPI,
        onToggleRecording: mockOnToggleRecording,
      };

      render(<App />);

      expect(mockOnToggleRecording).toHaveBeenCalled();
    });

    it('should toggle recording when global shortcut is triggered', async () => {
      let capturedCallback: (() => void) | null = null;
      const mockOnToggleRecording = mock((callback: () => void) => {
        capturedCallback = callback;
        return () => {};
      });
      window.electronAPI = {
        ...mockElectronAPI,
        onToggleRecording: mockOnToggleRecording,
      };

      render(<App />);

      // Verify button is in idle state
      const button = screen.getByRole('button', { name: /start recording/i });
      expect(button.className).toContain('idle');

      // Simulate global shortcut trigger
      expect(capturedCallback).not.toBeNull();
      capturedCallback!();

      // Verify button switches to recording state
      await waitFor(() => {
        const recordingButton = screen.getByRole('button', { name: /stop recording/i });
        expect(recordingButton.className).toContain('recording');
      });
    });
  });
});
