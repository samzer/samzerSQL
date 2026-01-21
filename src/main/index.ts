import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ConnectionManager } from './database/connection-manager';
import { QueryStorage } from './storage/query-storage';

let mainWindow: BrowserWindow | null = null;
const connectionManager = new ConnectionManager();
const queryStorage = new QueryStorage();

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'samzerSQL',
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fafbfc',
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  connectionManager.disconnectAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Database IPC handlers
ipcMain.handle('db:connect', async (_, config) => {
  return connectionManager.connect(config);
});

ipcMain.handle('db:disconnect', async (_, connectionId) => {
  return connectionManager.disconnect(connectionId);
});

ipcMain.handle('db:test-connection', async (_, config) => {
  return connectionManager.testConnection(config);
});

ipcMain.handle('db:execute-query', async (_, connectionId, query) => {
  return connectionManager.executeQuery(connectionId, query);
});

ipcMain.handle('db:cancel-query', async (_, connectionId) => {
  return connectionManager.cancelQuery(connectionId);
});

ipcMain.handle('db:get-schema', async (_, connectionId) => {
  return connectionManager.getSchema(connectionId);
});

ipcMain.handle('db:get-tables-in-schema', async (_, connectionId, schemaName) => {
  return connectionManager.getTablesInSchema(connectionId, schemaName);
});

ipcMain.handle('db:get-columns', async (_, connectionId, schemaName, tableName) => {
  return connectionManager.getColumns(connectionId, schemaName, tableName);
});

// Storage IPC handlers
ipcMain.handle('storage:get-connections', async () => {
  return queryStorage.getConnections();
});

ipcMain.handle('storage:save-connection', async (_, config) => {
  return queryStorage.saveConnection(config);
});

ipcMain.handle('storage:delete-connection', async (_, id) => {
  return queryStorage.deleteConnection(id);
});

ipcMain.handle('storage:get-folders', async () => {
  return queryStorage.getFolders();
});

ipcMain.handle('storage:save-folder', async (_, folder) => {
  return queryStorage.saveFolder(folder);
});

ipcMain.handle('storage:delete-folder', async (_, id) => {
  return queryStorage.deleteFolder(id);
});

ipcMain.handle('storage:get-queries', async () => {
  return queryStorage.getQueries();
});

ipcMain.handle('storage:save-query', async (_, query) => {
  return queryStorage.saveQuery(query);
});

ipcMain.handle('storage:delete-query', async (_, id) => {
  return queryStorage.deleteQuery(id);
});

ipcMain.handle('storage:get-history', async () => {
  return queryStorage.getHistory();
});

ipcMain.handle('storage:add-history', async (_, entry) => {
  return queryStorage.addHistory(entry);
});

ipcMain.handle('storage:clear-history', async () => {
  return queryStorage.clearHistory();
});
