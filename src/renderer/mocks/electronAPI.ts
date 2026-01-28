/**
 * Mock implementation of electronAPI for browser development.
 * This allows the UI to be developed and tested without Electron.
 */
import type { AppSettings, MicrophonePermissionStatus } from '../types/electron';

const defaultSettings: AppSettings = {
  apiKey: '',
  model: 'gemini-2.0-flash',
  languages: ['en', 'he', 'ru'],
  speechDomain: 'general',
  customDomainHint: '',
  customKeywords: '',
  microphoneDeviceId: 'default',
  silenceDetectionEnabled: true,
  silenceDurationMs: 1500,
  launchAtStartup: false,
  clarificationEnabled: false,
  previousTranscriptContextEnabled: false,
  soundEnabled: true,
  hotkey: 'CommandOrControl+Shift+R',
};

let mockSettings = { ...defaultSettings };
let mockRecentTranscript: string | null = 'This is a mock transcript for browser development.';

const toggleRecordingCallbacks = new Set<() => void>();

export function setupElectronAPIMock() {
  if (window.electronAPI) {
    // Already has real electronAPI, don't override
    return;
  }

  console.log('[Mock] Setting up electronAPI mock for browser development');

  window.electronAPI = {
    copyToClipboard: async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
        console.log('[Mock] Copied to clipboard:', text.substring(0, 50) + '...');
        return true;
      } catch (err) {
        console.error('[Mock] Failed to copy to clipboard:', err);
        return false;
      }
    },

    getApiKey: async (): Promise<string> => {
      return mockSettings.apiKey;
    },

    getModel: async (): Promise<string> => {
      return mockSettings.model;
    },

    onToggleRecording: (callback: () => void): (() => void) => {
      toggleRecordingCallbacks.add(callback);
      console.log('[Mock] Registered toggle recording callback. Press Cmd/Ctrl+Shift+R to toggle.');
      return () => {
        toggleRecordingCallbacks.delete(callback);
      };
    },

    getSettings: async (): Promise<AppSettings> => {
      return { ...mockSettings };
    },

    saveSettings: async (settings: Partial<AppSettings>): Promise<boolean> => {
      mockSettings = { ...mockSettings, ...settings };
      console.log('[Mock] Settings saved:', settings);
      return true;
    },

    openSettingsWindow: async (): Promise<boolean> => {
      console.log('[Mock] Would open settings window');
      // In browser, we could open a new tab or modal
      window.open('/settings.html', '_blank', 'width=600,height=700');
      return true;
    },

    closeSettingsWindow: async (): Promise<boolean> => {
      console.log('[Mock] Would close settings window');
      return true;
    },

    openInfoWindow: async (): Promise<boolean> => {
      console.log('[Mock] Would open info window');
      window.open('/info.html', '_blank', 'width=400,height=500');
      return true;
    },

    getMicrophonePermissionStatus: async (): Promise<MicrophonePermissionStatus> => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') return 'granted';
        if (result.state === 'denied') return 'denied';
        return 'not-determined';
      } catch {
        return 'unknown';
      }
    },

    requestMicrophonePermission: async (): Promise<boolean> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    },

    openExternalUrl: async (url: string): Promise<boolean> => {
      window.open(url, '_blank');
      return true;
    },

    getAppVersion: async (): Promise<string> => {
      return '0.0.0-browser-dev';
    },

    getRecentTranscript: async (): Promise<string | null> => {
      return mockRecentTranscript;
    },
  };

  // Set up keyboard shortcut for toggle recording (Cmd/Ctrl+Shift+R)
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      console.log('[Mock] Toggle recording triggered via keyboard');
      toggleRecordingCallbacks.forEach(cb => cb());
    }
  });
}

// For testing: expose functions to simulate events
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__mockElectronAPI = {
    triggerToggleRecording: () => {
      toggleRecordingCallbacks.forEach(cb => cb());
    },
    setMockTranscript: (transcript: string | null) => {
      mockRecentTranscript = transcript;
    },
    setMockSettings: (settings: Partial<AppSettings>) => {
      mockSettings = { ...mockSettings, ...settings };
    },
  };
}
