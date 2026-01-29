import { DatabaseAdapter } from './connection-manager';
import { ConnectionConfig, QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../../shared/types';

// Lazy-load better-sqlite3 to avoid issues if not installed
let Database: typeof import('better-sqlite3');
function getDatabase(): typeof import('better-sqlite3') {
  if (!Database) {
    Database = require('better-sqlite3');
  }
  return Database;
}

type BetterSqlite3Database = import('better-sqlite3').Database;

export class SQLiteAdapter implements DatabaseAdapter {
  private db: BetterSqlite3Database | null = null;
  private filePath: string = '';

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (!config.filePath) {
        return { success: false, error: 'Database file path is required' };
      }

      const BetterSqlite3 = getDatabase();
      this.db = new BetterSqlite3(config.filePath);
      this.filePath = config.filePath;

      // Test the connection with a simple query
      this.db.prepare('SELECT 1').get();

      return { success: true };
    } catch (error) {
      this.db = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to SQLite database',
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (!config.filePath) {
        return { success: false, error: 'Database file path is required' };
      }

      const BetterSqlite3 = getDatabase();
      const testDb = new BetterSqlite3(config.filePath, { readonly: true });
      testDb.prepare('SELECT 1').get();
      testDb.close();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.db) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: 'Not connected',
      };
    }

    const startTime = Date.now();

    try {
      const trimmedQuery = query.trim().toUpperCase();
      const isSelect = trimmedQuery.startsWith('SELECT') ||
                       trimmedQuery.startsWith('PRAGMA') ||
                       trimmedQuery.startsWith('EXPLAIN');

      if (isSelect) {
        const stmt = this.db.prepare(query);
        const rows = stmt.all() as Record<string, unknown>[];
        const executionTime = Date.now() - startTime;

        // Get column info from the statement
        const columns: ColumnInfo[] = stmt.columns().map((col) => ({
          name: col.name,
          type: col.type || 'unknown',
          nullable: true,
        }));

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTime,
        };
      } else {
        // For INSERT, UPDATE, DELETE, CREATE, etc.
        const result = this.db.prepare(query).run();
        const executionTime = Date.now() - startTime;

        return {
          columns: [
            { name: 'changes', type: 'integer', nullable: false },
            { name: 'lastInsertRowid', type: 'integer', nullable: false },
          ],
          rows: [{ changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) }],
          rowCount: 1,
          executionTime,
        };
      }
    } catch (error) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Query execution failed',
      };
    }
  }

  async cancelQuery(): Promise<void> {
    // SQLite with better-sqlite3 is synchronous, so queries can't be cancelled
    // This is a no-op but required by the interface
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.db) {
      return { tables: [], views: [] };
    }

    try {
      // SQLite doesn't have schemas like PostgreSQL, so we use 'main' as the schema name
      // Get all tables
      const tablesResult = this.db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      const tables: TableInfo[] = tablesResult.map((row) => ({
        name: row.name,
        schema: 'main',
        columns: [],
      }));

      // Get all views
      const viewsResult = this.db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'view'
        ORDER BY name
      `).all() as { name: string }[];

      const views: TableInfo[] = viewsResult.map((row) => ({
        name: row.name,
        schema: 'main',
        columns: [],
      }));

      return { tables, views };
    } catch (error) {
      console.error('Error fetching SQLite schema:', error);
      return { tables: [], views: [] };
    }
  }

  async getTablesInSchema(_schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }> {
    // SQLite only has one schema (main), so we just return all tables/views
    return this.getSchema();
  }

  async getColumns(_schemaName: string, tableName: string): Promise<ColumnInfo[]> {
    if (!this.db) {
      return [];
    }

    try {
      // Use PRAGMA table_info to get column information
      const result = this.db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
        name: string;
        type: string;
        notnull: number;
      }[];

      return result.map((row) => ({
        name: row.name,
        type: row.type || 'unknown',
        nullable: row.notnull === 0,
      }));
    } catch (error) {
      console.error(`Error fetching columns for ${tableName}:`, error);
      return [];
    }
  }
}
