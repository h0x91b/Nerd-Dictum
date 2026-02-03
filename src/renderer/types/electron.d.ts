import type { AppSettings, HoldToRecordKey } from '../../shared/types';
export type { AppSettings, HoldToRecordKey };

export type MicrophonePermissionStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';

export interface ElectronAPI {
  copyToClipboard: (text: string) => Promise<boolean>;
  getApiKey: () => Promise<string>;
  getModel: () => Promise<string>;
  onToggleRecording: (callback: () => void) => () => void;
  onStartRecording: (callback: () => void) => () => void;
  onStopRecording: (callback: () => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  openSettingsWindow: () => Promise<boolean>;
  closeSettingsWindow: () => Promise<boolean>;
  openInfoWindow: () => Promise<boolean>;
  openHideWindow: () => Promise<boolean>;
  closeHideWindow: () => Promise<boolean>;
  getMicrophonePermissionStatus: () => Promise<MicrophonePermissionStatus>;
  requestMicrophonePermission: () => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  getRecentTranscripts: () => Promise<string[]>;
  hideForDuration: (durationMs: number) => Promise<boolean>;
  trackEvent: (name: string, params?: Record<string, string | number>) => Promise<void>;
  pauseMedia: () => Promise<void>;
  resumeMedia: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
