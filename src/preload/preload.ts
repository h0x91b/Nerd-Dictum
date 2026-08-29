import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppSettings } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  copyToClipboard: (text: string, autoPaste = false) =>
    ipcRenderer.invoke('copy-to-clipboard', text, autoPaste),
  requestAccessibilityPermission: (ask = true) =>
    ipcRenderer.invoke('request-accessibility-permission', ask),
  listGeminiModels: () => ipcRenderer.invoke('list-gemini-models'),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  getModel: () => ipcRenderer.invoke('get-model'),
  onToggleRecording: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-recording', listener);
    return () => {
      ipcRenderer.removeListener('toggle-recording', listener);
    };
  },
  onStartRecording: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('start-recording', listener);
    return () => {
      ipcRenderer.removeListener('start-recording', listener);
    };
  },
  onStopRecording: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('stop-recording', listener);
    return () => {
      ipcRenderer.removeListener('stop-recording', listener);
    };
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('save-settings', settings),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),
  openInfoWindow: () => ipcRenderer.invoke('open-info-window'),
  openHideWindow: () => ipcRenderer.invoke('open-hide-window'),
  closeHideWindow: () => ipcRenderer.invoke('close-hide-window'),
  getMicrophonePermissionStatus: () => ipcRenderer.invoke('get-microphone-permission-status'),
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getRecentTranscripts: () => ipcRenderer.invoke('get-recent-transcripts'),
  hideForDuration: (durationMs: number) => ipcRenderer.invoke('hide-for-duration', durationMs),
  trackEvent: (name: string, params?: Record<string, string | number>) =>
    ipcRenderer.invoke('track-event', name, params ?? {}),
  pauseMedia: () => ipcRenderer.invoke('pause-media'),
  resumeMedia: () => ipcRenderer.invoke('resume-media'),
  // Stats
  openStatsWindow: () => ipcRenderer.invoke('open-stats-window'),
  closeStatsWindow: () => ipcRenderer.invoke('close-stats-window'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  resetStats: () => ipcRenderer.invoke('reset-stats'),
  recordTranscriptionStats: (transcript: string, recordingDurationMs: number) =>
    ipcRenderer.invoke('record-transcription-stats', transcript, recordingDurationMs),
  // Error detail
  openErrorDetailWindow: (detail: {
    message: string;
    statusCode?: number;
    responseBody?: string;
    audioFilePath?: string;
    audioFileName?: string;
    audioSizeBytes?: number;
  }) => ipcRenderer.invoke('open-error-detail-window', detail),
  getErrorDetail: () => ipcRenderer.invoke('get-error-detail'),
  // Debug flags (SIMULATE_ERROR_RATE and friends)
  getDebugFlags: () => ipcRenderer.invoke('get-debug-flags'),
  // Failed recordings
  saveFailedRecording: (audioBase64: string, mimeType?: string) =>
    ipcRenderer.invoke('save-failed-recording', audioBase64, mimeType),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  retryFailedRecording: (filePath: string) => ipcRenderer.invoke('retry-failed-recording', filePath),
  onRetryTranscription: (callback: (filePath: string) => void) => {
    const listener = (_event: unknown, filePath: string) => callback(filePath);
    ipcRenderer.on('retry-transcription', listener);
    return () => {
      ipcRenderer.removeListener('retry-transcription', listener);
    };
  },
  // File operations
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  readFileAsBase64: (filePath: string) => ipcRenderer.invoke('read-file-as-base64', filePath),
});
