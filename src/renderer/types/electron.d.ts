export interface AppSettings {
  apiKey: string;
  model: string;
}

export interface ElectronAPI {
  copyToClipboard: (text: string) => Promise<boolean>;
  getApiKey: () => Promise<string>;
  getModel: () => Promise<string>;
  onToggleRecording: (callback: () => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  openSettingsWindow: () => Promise<boolean>;
  closeSettingsWindow: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
