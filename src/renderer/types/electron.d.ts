export interface ElectronAPI {
  copyToClipboard: (text: string) => Promise<boolean>;
  getApiKey: () => Promise<string>;
  getModel: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
