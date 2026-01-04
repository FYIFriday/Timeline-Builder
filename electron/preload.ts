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
  onMenuNew: (callback: () => void) => ipcRenderer.on('menu-new', callback),
  onMenuSave: (callback: () => void) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback: () => void) => ipcRenderer.on('menu-save-as', callback),
  onMenuExportPng: (callback: () => void) => ipcRenderer.on('menu-export-png', callback),
  onMenuExportPdf: (callback: () => void) => ipcRenderer.on('menu-export-pdf', callback),
  onMenuExportJson: (callback: () => void) => ipcRenderer.on('menu-export-json', callback),
  onMenuSearch: (callback: () => void) => ipcRenderer.on('menu-search', callback),
  onFileOpened: (callback: (data: string) => void) => ipcRenderer.on('file-opened', (_, data) => callback(data)),
});
