import type { ConnectionConfig, QueryFile, Folder, QueryHistoryEntry, QueryResult, SchemaInfo, TableInfo, ColumnInfo } from '../shared/types';

interface ElectronAPI {
  db: {
    connect: (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
    disconnect: (connectionId: string) => Promise<void>;
    testConnection: (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
    executeQuery: (connectionId: string, query: string) => Promise<QueryResult>;
    cancelQuery: (connectionId: string) => Promise<void>;
    getSchema: (connectionId: string) => Promise<SchemaInfo>;
    getTablesInSchema: (connectionId: string, schemaName: string) => Promise<{ tables: TableInfo[]; views: TableInfo[] }>;
    getColumns: (connectionId: string, schemaName: string, tableName: string) => Promise<ColumnInfo[]>;
  };
  storage: {
    getConnections: () => Promise<ConnectionConfig[]>;
    saveConnection: (config: ConnectionConfig) => Promise<void>;
    deleteConnection: (id: string) => Promise<void>;
    getFolders: () => Promise<Folder[]>;
    saveFolder: (folder: Folder) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
    getQueries: () => Promise<QueryFile[]>;
    saveQuery: (query: QueryFile) => Promise<void>;
    deleteQuery: (id: string) => Promise<void>;
    getHistory: () => Promise<QueryHistoryEntry[]>;
    addHistory: (entry: QueryHistoryEntry) => Promise<void>;
    clearHistory: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
