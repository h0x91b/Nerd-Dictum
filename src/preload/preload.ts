import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  getModel: () => ipcRenderer.invoke('get-model'),
});
