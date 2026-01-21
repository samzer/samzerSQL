import { create } from 'zustand';
import type { Connection, ConnectionConfig, SchemaInfo, TableInfo, ColumnInfo } from '../../shared/types';

interface ConnectionState {
  connections: Connection[];
  activeConnectionId: string | null;
  schemas: Map<string, SchemaInfo>;
  // Cache for lazily loaded schema data: connectionId -> schemaName -> { tables, views }
  schemaTables: Map<string, Map<string, { tables: TableInfo[]; views: TableInfo[] }>>;
  // Cache for lazily loaded columns: connectionId -> "schema.table" -> columns
  tableColumns: Map<string, Map<string, ColumnInfo[]>>;

  // Actions
  loadConnections: () => Promise<void>;
  addConnection: (config: ConnectionConfig) => Promise<void>;
  updateConnection: (config: ConnectionConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  connect: (id: string) => Promise<{ success: boolean; error?: string }>;
  disconnect: (id: string) => Promise<void>;
  testConnection: (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
  setActiveConnection: (id: string | null) => void;
  getSchema: (connectionId: string) => Promise<SchemaInfo | undefined>;
  getTablesInSchema: (connectionId: string, schemaName: string) => Promise<{ tables: TableInfo[]; views: TableInfo[] }>;
  getColumns: (connectionId: string, schemaName: string, tableName: string) => Promise<ColumnInfo[]>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  schemas: new Map(),
  schemaTables: new Map(),
  tableColumns: new Map(),

  loadConnections: async () => {
    try {
      const configs = await window.electron.storage.getConnections();
      const connections: Connection[] = configs.map((config) => ({
        id: config.id,
        config,
        status: 'disconnected',
      }));
      set({ connections });
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  },

  addConnection: async (config) => {
    try {
      await window.electron.storage.saveConnection(config);
      const connection: Connection = {
        id: config.id,
        config,
        status: 'disconnected',
      };
      set((state) => ({
        connections: [...state.connections, connection],
      }));
    } catch (error) {
      console.error('Failed to add connection:', error);
    }
  },

  updateConnection: async (config) => {
    try {
      await window.electron.storage.saveConnection(config);
      set((state) => ({
        connections: state.connections.map((conn) =>
          conn.id === config.id ? { ...conn, config } : conn
        ),
      }));
    } catch (error) {
      console.error('Failed to update connection:', error);
    }
  },

  deleteConnection: async (id) => {
    try {
      const { connections, activeConnectionId } = get();
      const conn = connections.find((c) => c.id === id);

      if (conn?.status === 'connected') {
        await window.electron.db.disconnect(id);
      }

      await window.electron.storage.deleteConnection(id);

      set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        activeConnectionId: activeConnectionId === id ? null : activeConnectionId,
      }));
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  },

  connect: async (id) => {
    const { connections } = get();
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, status: 'connecting', error: undefined } : c
      ),
    }));

    try {
      const result = await window.electron.db.connect(connection.config);

      set((state) => ({
        connections: state.connections.map((c) =>
          c.id === id
            ? {
                ...c,
                status: result.success ? 'connected' : 'error',
                error: result.error,
              }
            : c
        ),
        activeConnectionId: result.success ? id : state.activeConnectionId,
      }));

      // Load schema after successful connection
      if (result.success) {
        get().getSchema(id);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      set((state) => ({
        connections: state.connections.map((c) =>
          c.id === id ? { ...c, status: 'error', error: errorMessage } : c
        ),
      }));
      return { success: false, error: errorMessage };
    }
  },

  disconnect: async (id) => {
    try {
      await window.electron.db.disconnect(id);

      set((state) => ({
        connections: state.connections.map((c) =>
          c.id === id ? { ...c, status: 'disconnected', error: undefined } : c
        ),
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
      }));

      // Clear cached schema
      const { schemas } = get();
      schemas.delete(id);
      set({ schemas: new Map(schemas) });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  },

  testConnection: async (config) => {
    return window.electron.db.testConnection(config);
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id });
  },

  getSchema: async (connectionId) => {
    const { schemas } = get();

    if (schemas.has(connectionId)) {
      return schemas.get(connectionId);
    }

    try {
      const schema = await window.electron.db.getSchema(connectionId);
      schemas.set(connectionId, schema);
      set({ schemas: new Map(schemas) });
      return schema;
    } catch (error) {
      console.error('Failed to get schema:', error);
      return undefined;
    }
  },

  getTablesInSchema: async (connectionId, schemaName) => {
    const { schemaTables } = get();

    // Check cache first
    const connCache = schemaTables.get(connectionId);
    if (connCache?.has(schemaName)) {
      return connCache.get(schemaName)!;
    }

    try {
      const result = await window.electron.db.getTablesInSchema(connectionId, schemaName);

      // Update cache
      const newConnCache = connCache || new Map();
      newConnCache.set(schemaName, result);
      schemaTables.set(connectionId, newConnCache);
      set({ schemaTables: new Map(schemaTables) });

      return result;
    } catch (error) {
      console.error(`Failed to get tables in schema ${schemaName}:`, error);
      return { tables: [], views: [] };
    }
  },

  getColumns: async (connectionId, schemaName, tableName) => {
    const { tableColumns } = get();
    const key = `${schemaName}.${tableName}`;

    // Check cache first
    const connCache = tableColumns.get(connectionId);
    if (connCache?.has(key)) {
      return connCache.get(key)!;
    }

    try {
      const columns = await window.electron.db.getColumns(connectionId, schemaName, tableName);

      // Update cache
      const newConnCache = connCache || new Map();
      newConnCache.set(key, columns);
      tableColumns.set(connectionId, newConnCache);
      set({ tableColumns: new Map(tableColumns) });

      return columns;
    } catch (error) {
      console.error(`Failed to get columns for ${key}:`, error);
      return [];
    }
  },
}));
