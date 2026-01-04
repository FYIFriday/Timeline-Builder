import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // Enable spell checker
  mainWindow.webContents.session.setSpellCheckerLanguages(['en-US']);

  // Handle context menu for spell checking
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { misspelledWord, dictionarySuggestions, isEditable } = params;

    // Only show spell check menu when in editable content with misspelled word
    if (isEditable && misspelledWord) {
      const menuTemplate: any[] = [];

      // Add spelling suggestions
      if (dictionarySuggestions.length > 0) {
        dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
          menuTemplate.push({
            label: suggestion,
            click: () => mainWindow?.webContents.replaceMisspelling(suggestion),
          });
        });
        menuTemplate.push({ type: 'separator' });
      }

      // Add "Add to dictionary" option
      menuTemplate.push({
        label: 'Add to Dictionary',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(misspelledWord),
      });

      const contextMenu = Menu.buildFromTemplate(menuTemplate);
      contextMenu.popup();
    }
  });

  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template: any = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new');
          },
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              filters: [{ name: 'Timeline Files', extensions: ['timeline'] }],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              const content = fs.readFileSync(filePath, 'utf-8');
              currentFilePath = filePath;
              mainWindow?.webContents.send('file-opened', content);
            }
          },
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu-save');
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu-save-as');
          },
        },
        { type: 'separator' },
        {
          label: 'Export to PNG',
          click: () => {
            mainWindow?.webContents.send('menu-export-png');
          },
        },
        {
          label: 'Export to PDF',
          click: () => {
            mainWindow?.webContents.send('menu-export-pdf');
          },
        },
        {
          label: 'Export to JSON',
          click: () => {
            mainWindow?.webContents.send('menu-export-json');
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        {
          label: 'Find and Replace...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow?.webContents.send('menu-search');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    // Bring existing window to front
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
});

// IPC handlers
ipcMain.handle('save-file', async (_, data: string) => {
  if (currentFilePath) {
    fs.writeFileSync(currentFilePath, data, 'utf-8');
    return currentFilePath;
  } else {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Timeline Files', extensions: ['timeline'] }],
      defaultPath: 'untitled.timeline',
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, data, 'utf-8');
      currentFilePath = result.filePath;
      return result.filePath;
    }
  }
  return null;
});

ipcMain.handle('save-file-as', async (_, data: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'Timeline Files', extensions: ['timeline'] }],
    defaultPath: 'untitled.timeline',
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data, 'utf-8');
    currentFilePath = result.filePath;
    return result.filePath;
  }
  return null;
});

ipcMain.handle('save-backup', async (_, data: string) => {
  const backupPath = path.join(app.getPath('userData'), '.chronicle.backup');
  fs.writeFileSync(backupPath, data, 'utf-8');
  return backupPath;
});

ipcMain.handle('export-png', async (_, dataUrl: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
    defaultPath: 'timeline.png',
  });
  if (!result.canceled && result.filePath) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(result.filePath, base64Data, 'base64');
    return result.filePath;
  }
  return null;
});

ipcMain.handle('export-json', async (_, data: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'JSON File', extensions: ['json'] }],
    defaultPath: 'timeline.json',
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data, 'utf-8');
    return result.filePath;
  }
  return null;
});

ipcMain.handle('export-pdf', async (_, dataUrl: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    defaultPath: 'timeline.pdf',
  });
  if (!result.canceled && result.filePath) {
    // Convert base64 PNG to PDF by rendering in a hidden window and printing
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
      },
    });

    await pdfWindow.loadURL(`data:text/html,<img src="${dataUrl}" style="width:100%"/>`);

    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    fs.writeFileSync(result.filePath, pdfData);
    pdfWindow.close();
    return result.filePath;
  }
  return null;
});

ipcMain.handle('set-window-title', async (_, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

ipcMain.handle('get-current-filename', async () => {
  return currentFilePath ? path.basename(currentFilePath) : null;
});

ipcMain.handle('load-backup', async () => {
  const backupPath = path.join(app.getPath('userData'), '.chronicle.backup');
  if (fs.existsSync(backupPath)) {
    const content = fs.readFileSync(backupPath, 'utf-8');
    return content;
  }
  return null;
});
