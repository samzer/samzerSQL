import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectionConfig, QueryFile, Folder, QueryHistoryEntry } from '../shared/types';

const electronAPI = {
  // Database operations
  db: {
    connect: (config: ConnectionConfig) => ipcRenderer.invoke('db:connect', config),
    disconnect: (connectionId: string) => ipcRenderer.invoke('db:disconnect', connectionId),
    testConnection: (config: ConnectionConfig) => ipcRenderer.invoke('db:test-connection', config),
    executeQuery: (connectionId: string, query: string) =>
      ipcRenderer.invoke('db:execute-query', connectionId, query),
    cancelQuery: (connectionId: string) => ipcRenderer.invoke('db:cancel-query', connectionId),
    getSchema: (connectionId: string) => ipcRenderer.invoke('db:get-schema', connectionId),
    getTablesInSchema: (connectionId: string, schemaName: string) =>
      ipcRenderer.invoke('db:get-tables-in-schema', connectionId, schemaName),
    getColumns: (connectionId: string, schemaName: string, tableName: string) =>
      ipcRenderer.invoke('db:get-columns', connectionId, schemaName, tableName),
  },

  // Storage operations
  storage: {
    getConnections: () => ipcRenderer.invoke('storage:get-connections'),
    saveConnection: (config: ConnectionConfig) =>
      ipcRenderer.invoke('storage:save-connection', config),
    deleteConnection: (id: string) => ipcRenderer.invoke('storage:delete-connection', id),

    getFolders: () => ipcRenderer.invoke('storage:get-folders'),
    saveFolder: (folder: Folder) => ipcRenderer.invoke('storage:save-folder', folder),
    deleteFolder: (id: string) => ipcRenderer.invoke('storage:delete-folder', id),

    getQueries: () => ipcRenderer.invoke('storage:get-queries'),
    saveQuery: (query: QueryFile) => ipcRenderer.invoke('storage:save-query', query),
    deleteQuery: (id: string) => ipcRenderer.invoke('storage:delete-query', id),

    getHistory: () => ipcRenderer.invoke('storage:get-history'),
    addHistory: (entry: QueryHistoryEntry) => ipcRenderer.invoke('storage:add-history', entry),
    clearHistory: () => ipcRenderer.invoke('storage:clear-history'),
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);

// Type declaration for the renderer
export type ElectronAPI = typeof electronAPI;
