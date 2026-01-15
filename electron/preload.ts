import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  saveFile: (data: string) => ipcRenderer.invoke('save-file', data),
  saveFileAs: (data: string) => ipcRenderer.invoke('save-file-as', data),
  saveBackup: (data: string) => ipcRenderer.invoke('save-backup', data),
  loadBackup: () => ipcRenderer.invoke('load-backup'),
  exportPng: (dataUrl: string) => ipcRenderer.invoke('export-png', dataUrl),
  exportPdf: (dataUrl: string) => ipcRenderer.invoke('export-pdf', dataUrl),
  exportJson: (data: string) => ipcRenderer.invoke('export-json', data),
  setWindowTitle: (title: string) => ipcRenderer.invoke('set-window-title', title),
  getCurrentFilename: () => ipcRenderer.invoke('get-current-filename'),
  onMenuNew: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-new');
    ipcRenderer.on('menu-new', callback);
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-save');
    ipcRenderer.on('menu-save', callback);
  },
  onMenuSaveAs: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-save-as');
    ipcRenderer.on('menu-save-as', callback);
  },
  onMenuExportPng: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-export-png');
    ipcRenderer.on('menu-export-png', callback);
  },
  onMenuExportPdf: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-export-pdf');
    ipcRenderer.on('menu-export-pdf', callback);
  },
  onMenuExportJson: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-export-json');
    ipcRenderer.on('menu-export-json', callback);
  },
  onMenuSearch: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-search');
    ipcRenderer.on('menu-search', callback);
  },
  onMenuExportRegion: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-export-region');
    ipcRenderer.on('menu-export-region', callback);
  },
  onFileOpened: (callback: (data: string) => void) => {
    ipcRenderer.removeAllListeners('file-opened');
    ipcRenderer.on('file-opened', (_, data) => callback(data));
  },
});
