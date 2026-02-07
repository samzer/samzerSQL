// Database connection types
export type DatabaseType = 'postgresql' | 'mysql' | 'snowflake' | 'salesforce' | 'sqlite' | 'motherduck';

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  // Snowflake-specific
  account?: string;
  warehouse?: string;
  schema?: string;
  role?: string;
  // Salesforce-specific
  loginUrl?: string;
  securityToken?: string;
  // SSL options
  ssl?: boolean;
  sslCert?: string;
  // SQLite-specific
  filePath?: string;
  // MotherDuck-specific
  motherduckToken?: string;
}

export interface Connection {
  id: string;
  config: ConnectionConfig;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

// Query types
export interface QueryFile {
  id: string;
  name: string;
  content: string;
  connectionId?: string;
  folderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  expanded: boolean;
  createdAt: string;
}

// Query execution types
export interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  error?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

// Schema types for autocomplete
export interface SchemaInfo {
  tables: TableInfo[];
  views: TableInfo[];
}

export interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
}

// Editor tab types
export interface EditorTab {
  id: string;
  queryFileId?: string;
  name: string;
  content: string;
  connectionId?: string;
  isDirty: boolean;
  isExecuting: boolean;
  result?: QueryResult;
}

// History types
export interface QueryHistoryEntry {
  id: string;
  query: string;
  connectionId: string;
  connectionName: string;
  executedAt: string;
  executionTime: number;
  rowCount: number;
  error?: string;
}

// IPC channel types
export interface IpcChannels {
  // Connection management
  'db:connect': (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
  'db:disconnect': (connectionId: string) => Promise<void>;
  'db:test-connection': (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;

  // Query execution
  'db:execute-query': (connectionId: string, query: string) => Promise<QueryResult>;
  'db:cancel-query': (connectionId: string) => Promise<void>;

  // Schema info
  'db:get-schema': (connectionId: string) => Promise<SchemaInfo>;

  // Storage
  'storage:get-connections': () => Promise<ConnectionConfig[]>;
  'storage:save-connection': (config: ConnectionConfig) => Promise<void>;
  'storage:delete-connection': (id: string) => Promise<void>;

  'storage:get-folders': () => Promise<Folder[]>;
  'storage:save-folder': (folder: Folder) => Promise<void>;
  'storage:delete-folder': (id: string) => Promise<void>;

  'storage:get-queries': () => Promise<QueryFile[]>;
  'storage:save-query': (query: QueryFile) => Promise<void>;
  'storage:delete-query': (id: string) => Promise<void>;

  'storage:get-history': () => Promise<QueryHistoryEntry[]>;
  'storage:add-history': (entry: QueryHistoryEntry) => Promise<void>;
  'storage:clear-history': () => Promise<void>;
}

// Export types
export type ExportFormat = 'csv' | 'json' | 'excel';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
  includeHeaders: boolean;
}
