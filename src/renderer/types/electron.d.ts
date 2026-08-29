import type { AppSettings, HoldToRecordKey, StatsWithDerived, DailyStats } from '../../shared/types';
export type { AppSettings, HoldToRecordKey, StatsWithDerived, DailyStats };

export type MicrophonePermissionStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';

export interface ErrorDetail {
  message: string;
  statusCode?: number;
  responseBody?: string;
  /** Absolute path to the saved recording that failed, when it could be saved */
  audioFilePath?: string;
  audioFileName?: string;
  audioSizeBytes?: number;
}

export interface SavedRecording {
  filePath: string;
  fileName: string;
  sizeBytes: number;
}

export interface ElectronAPI {
  copyToClipboard: (text: string, autoPaste?: boolean) => Promise<boolean>;
  requestAccessibilityPermission?: (ask?: boolean) => Promise<boolean>;
  listGeminiModels?: () => Promise<
    | { ok: true; models: Array<{ id: string; displayName: string; description: string }> }
    | { ok: false; error: string; models: [] }
  >;
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
  // Stats
  openStatsWindow: () => Promise<boolean>;
  closeStatsWindow: () => Promise<boolean>;
  getStats: () => Promise<StatsWithDerived>;
  resetStats: () => Promise<boolean>;
  recordTranscriptionStats: (transcript: string, recordingDurationMs: number) => Promise<boolean>;
  // Error detail
  openErrorDetailWindow: (detail: ErrorDetail) => Promise<boolean>;
  getErrorDetail: () => Promise<ErrorDetail>;
  // Failed recordings
  saveFailedRecording: (audioBase64: string, mimeType?: string) => Promise<SavedRecording | null>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
  retryFailedRecording: (filePath: string) => Promise<boolean>;
  onRetryTranscription: (callback: (filePath: string) => void) => () => void;
  // File operations
  getPathForFile: (file: File) => string;
  readFileAsBase64: (filePath: string) => Promise<string>;
  // Diagnostic logging (renderer → main → main.log)
  log?: (message: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
