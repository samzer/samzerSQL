import { DatabaseAdapter } from './connection-manager';
import { ConnectionConfig, QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

// Lazy-load sql.js
let initSqlJs: typeof import('sql.js').default;
async function getInitSqlJs(): Promise<typeof import('sql.js').default> {
  if (!initSqlJs) {
    const sqljs = await import('sql.js');
    initSqlJs = sqljs.default;
  }
  return initSqlJs;
}

type SqlJsDatabase = import('sql.js').Database;

export class SQLiteAdapter implements DatabaseAdapter {
  private db: SqlJsDatabase | null = null;
  private filePath: string = '';

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (!config.filePath) {
        return { success: false, error: 'Database file path is required' };
      }

      const initSqlJsFn = await getInitSqlJs();
      const SQL = await initSqlJsFn();

      // Check if file exists and load it, otherwise create new database
      if (fs.existsSync(config.filePath)) {
        const fileBuffer = fs.readFileSync(config.filePath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        // Create new database
        this.db = new SQL.Database();
        // Ensure directory exists
        const dir = path.dirname(config.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      this.filePath = config.filePath;

      // Test the connection with a simple query
      this.db.exec('SELECT 1');

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
      // Save to file before closing
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }

  private saveToFile(): void {
    if (this.db && this.filePath) {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.filePath, buffer);
      } catch (error) {
        console.error('Failed to save SQLite database:', error);
      }
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (!config.filePath) {
        return { success: false, error: 'Database file path is required' };
      }

      const initSqlJsFn = await getInitSqlJs();
      const SQL = await initSqlJsFn();

      let testDb: SqlJsDatabase;
      if (fs.existsSync(config.filePath)) {
        const fileBuffer = fs.readFileSync(config.filePath);
        testDb = new SQL.Database(fileBuffer);
      } else {
        testDb = new SQL.Database();
      }

      testDb.exec('SELECT 1');
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
        const results = this.db.exec(query);
        const executionTime = Date.now() - startTime;

        if (results.length === 0) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTime,
          };
        }

        const result = results[0];
        const columns: ColumnInfo[] = result.columns.map((col: string) => ({
          name: col,
          type: 'unknown',
          nullable: true,
        }));

        const rows: Record<string, unknown>[] = result.values.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          result.columns.forEach((col: string, i: number) => {
            obj[col] = row[i];
          });
          return obj;
        });

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTime,
        };
      } else {
        // For INSERT, UPDATE, DELETE, CREATE, etc.
        this.db.run(query);
        const executionTime = Date.now() - startTime;

        // Get changes count
        const changesResult = this.db.exec('SELECT changes() as changes, last_insert_rowid() as lastId');
        const changes = changesResult.length > 0 ? changesResult[0].values[0][0] : 0;
        const lastId = changesResult.length > 0 ? changesResult[0].values[0][1] : 0;

        // Save changes to file after write operations
        this.saveToFile();

        return {
          columns: [
            { name: 'changes', type: 'integer', nullable: false },
            { name: 'lastInsertRowid', type: 'integer', nullable: false },
          ],
          rows: [{ changes, lastInsertRowid: lastId }],
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
    // sql.js runs synchronously, so queries can't be cancelled
    // This is a no-op but required by the interface
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.db) {
      return { tables: [], views: [] };
    }

    try {
      // SQLite doesn't have schemas like PostgreSQL, so we use 'main' as the schema name
      // Get all tables
      const tablesResult = this.db.exec(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      const tables: TableInfo[] = tablesResult.length > 0
        ? tablesResult[0].values.map((row: unknown[]) => ({
            name: row[0] as string,
            schema: 'main',
            columns: [],
          }))
        : [];

      // Get all views
      const viewsResult = this.db.exec(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'view'
        ORDER BY name
      `);

      const views: TableInfo[] = viewsResult.length > 0
        ? viewsResult[0].values.map((row: unknown[]) => ({
            name: row[0] as string,
            schema: 'main',
            columns: [],
          }))
        : [];

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
      const result = this.db.exec(`PRAGMA table_info("${tableName}")`);

      if (result.length === 0) {
        return [];
      }

      return result[0].values.map((row: unknown[]) => ({
        name: row[1] as string,  // name is at index 1
        type: (row[2] as string) || 'unknown',  // type is at index 2
        nullable: row[3] === 0,  // notnull is at index 3
      }));
    } catch (error) {
      console.error(`Error fetching columns for ${tableName}:`, error);
      return [];
    }
  }
}
