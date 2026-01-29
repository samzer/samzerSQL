import { ConnectionConfig, QueryResult, SchemaInfo, TableInfo, ColumnInfo } from '../../shared/types';
import { PostgresAdapter } from './postgres';
import { MySQLAdapter } from './mysql';
import { SnowflakeAdapter } from './snowflake';
import { SalesforceAdapter } from './salesforce';
import { SQLiteAdapter } from './sqlite';

export interface DatabaseAdapter {
  connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }>;
  disconnect(): Promise<void>;
  executeQuery(query: string): Promise<QueryResult>;
  cancelQuery(): Promise<void>;
  getSchema(): Promise<SchemaInfo>;
  testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }>;
  // Optional lazy-loading methods
  getTablesInSchema?(schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }>;
  getColumns?(schemaName: string, tableName: string): Promise<ColumnInfo[]>;
}

export class ConnectionManager {
  private connections: Map<string, DatabaseAdapter> = new Map();
  private activeQueries: Map<string, boolean> = new Map();

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const adapter = this.createAdapter(config.type);
      const result = await adapter.connect(config);

      if (result.success) {
        this.connections.set(config.id, adapter);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const adapter = this.connections.get(connectionId);
    if (adapter) {
      await adapter.disconnect();
      this.connections.delete(connectionId);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [id] of this.connections) {
      await this.disconnect(id);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    const adapter = this.createAdapter(config.type);
    return adapter.testConnection(config);
  }

  async executeQuery(connectionId: string, query: string): Promise<QueryResult> {
    const adapter = this.connections.get(connectionId);
    if (!adapter) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: 'Connection not found',
      };
    }

    this.activeQueries.set(connectionId, true);

    try {
      const result = await adapter.executeQuery(query);
      return result;
    } finally {
      this.activeQueries.delete(connectionId);
    }
  }

  async cancelQuery(connectionId: string): Promise<void> {
    const adapter = this.connections.get(connectionId);
    if (adapter && this.activeQueries.get(connectionId)) {
      await adapter.cancelQuery();
      this.activeQueries.delete(connectionId);
    }
  }

  async getSchema(connectionId: string): Promise<SchemaInfo> {
    const adapter = this.connections.get(connectionId);
    if (!adapter) {
      return { tables: [], views: [] };
    }
    return adapter.getSchema();
  }

  async getTablesInSchema(connectionId: string, schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }> {
    const adapter = this.connections.get(connectionId);
    if (!adapter || !adapter.getTablesInSchema) {
      return { tables: [], views: [] };
    }
    return adapter.getTablesInSchema(schemaName);
  }

  async getColumns(connectionId: string, schemaName: string, tableName: string): Promise<ColumnInfo[]> {
    const adapter = this.connections.get(connectionId);
    if (!adapter || !adapter.getColumns) {
      return [];
    }
    return adapter.getColumns(schemaName, tableName);
  }

  private createAdapter(type: ConnectionConfig['type']): DatabaseAdapter {
    switch (type) {
      case 'postgresql':
        return new PostgresAdapter();
      case 'mysql':
        return new MySQLAdapter();
      case 'snowflake':
        return new SnowflakeAdapter();
      case 'salesforce':
        return new SalesforceAdapter();
      case 'sqlite':
        return new SQLiteAdapter();
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  isConnected(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }
}
