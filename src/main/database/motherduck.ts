import { DatabaseAdapter } from './connection-manager';
import { ConnectionConfig, QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../../shared/types';

// DuckDB API types (simplified for lazy-loading)
interface DuckDBResultReader {
  columnNames(): string[];
  columnTypes(): { toString(): string }[];
  getRowObjectsJson(): Record<string, unknown>[];
}

interface DuckDBResult {
  rowsChanged?: number;
}

interface DuckDBConnection {
  run(sql: string): Promise<DuckDBResult>;
  runAndReadAll(sql: string): Promise<DuckDBResultReader>;
  interrupt(): void;
  closeSync(): void;
}

interface DuckDBInstance {
  connect(): Promise<DuckDBConnection>;
  closeSync(): void;
}

interface DuckDBModule {
  DuckDBInstance: {
    create(path?: string, options?: Record<string, string>): Promise<DuckDBInstance>;
  };
}

const INTERNAL_DATABASES = new Set([
  'system', 'temp', 'memory', 'localmemdb',
  'md_information_schema', 'md_results', 'mem_db_for_profiling_queries',
]);

let duckdb: DuckDBModule | null = null;

async function getDuckDB(): Promise<DuckDBModule> {
  if (!duckdb) {
    try {
      // @ts-ignore - @duckdb/node-api is an optional dependency
      duckdb = await import('@duckdb/node-api') as unknown as DuckDBModule;
    } catch {
      throw new Error('@duckdb/node-api not installed. Run: npm install @duckdb/node-api');
    }
  }
  return duckdb;
}

export class MotherDuckAdapter implements DatabaseAdapter {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const mod = await getDuckDB();

      const { token, database } = this.resolveConfig(config);
      const path = token ? (database ? `md:${database}` : 'md:') : (config.filePath || ':memory:');
      const options: Record<string, string> = {};
      if (token) {
        options.motherduck_token = token;
      }

      console.log('[MotherDuck] Connecting with path:', path, 'hasToken:', !!token);

      this.instance = await mod.DuckDBInstance.create(path, options);
      this.connection = await this.instance.connect();

      return { success: true };
    } catch (error) {
      this.instance = null;
      this.connection = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.closeSync();
      this.connection = null;
    }
    if (this.instance) {
      this.instance.closeSync();
      this.instance = null;
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    let testInstance: DuckDBInstance | null = null;
    let testConnection: DuckDBConnection | null = null;

    try {
      const mod = await getDuckDB();

      const { token, database } = this.resolveConfig(config);
      const path = token ? (database ? `md:${database}` : 'md:') : (config.filePath || ':memory:');
      const options: Record<string, string> = {};
      if (token) {
        options.motherduck_token = token;
      }

      testInstance = await mod.DuckDBInstance.create(path, options);
      testConnection = await testInstance.connect();
      await testConnection.run('SELECT 1');

      testConnection.closeSync();
      testInstance.closeSync();
      return { success: true };
    } catch (error) {
      if (testConnection) testConnection.closeSync();
      if (testInstance) testInstance.closeSync();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.connection) {
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
      const trimmed = query.trim().toUpperCase();
      const isSelect = trimmed.startsWith('SELECT') ||
                       trimmed.startsWith('WITH') ||
                       trimmed.startsWith('SHOW') ||
                       trimmed.startsWith('DESCRIBE') ||
                       trimmed.startsWith('EXPLAIN');

      if (isSelect) {
        const reader = await this.connection.runAndReadAll(query);

        const columnNames = reader.columnNames();
        const columnTypes = reader.columnTypes();
        const columns: ColumnInfo[] = columnNames.map((name, i) => ({
          name,
          type: columnTypes[i]?.toString() || 'unknown',
          nullable: true,
        }));

        const rows = reader.getRowObjectsJson();

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTime: Date.now() - startTime,
        };
      } else {
        const result = await this.connection.run(query);

        const rowsChanged = result.rowsChanged ?? 0;

        return {
          columns: [{ name: 'result', type: 'text', nullable: false }],
          rows: [{ result: `Query executed successfully. ${rowsChanged} row(s) affected.` }],
          rowCount: rowsChanged,
          executionTime: Date.now() - startTime,
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
    if (this.connection) {
      try {
        this.connection.interrupt();
      } catch (error) {
        console.error('Error cancelling DuckDB query:', error);
      }
    }
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    try {
      // Use duckdb_schemas() to discover all databases + schemas in one query
      const reader = await this.connection.runAndReadAll(
        `SELECT database_name, schema_name FROM duckdb_schemas()`
      );

      const allSchemas = reader.getRowObjectsJson()
        .filter((r) => {
          const db = r.database_name as string;
          const schema = r.schema_name as string;
          return !INTERNAL_DATABASES.has(db) &&
            schema !== 'pg_catalog' && schema !== 'information_schema';
        })
        .map((r) => ({
          database: r.database_name as string,
          schema: r.schema_name as string,
        }));

      const tables: TableInfo[] = allSchemas.map(({ database, schema }) => ({
        name: '__schema_placeholder__',
        schema: `${database}.${schema}`,
        columns: [],
      }));

      return { tables, views: [] };
    } catch (error) {
      console.error('Error fetching schemas:', error);
      return { tables: [], views: [] };
    }
  }

  async getTablesInSchema(schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }> {
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    try {
      const { database, schema } = this.parseCompoundSchema(schemaName);
      const dbFilter = database
        ? `database_name = '${database.replace(/'/g, "''")}' AND `
        : '';
      const schemaFilter = `schema_name = '${schema.replace(/'/g, "''")}'`;

      // duckdb_tables() returns base tables only, duckdb_views() returns views only
      const tableReader = await this.connection.runAndReadAll(`
        SELECT table_name FROM duckdb_tables()
        WHERE ${dbFilter}${schemaFilter}
        ORDER BY table_name
      `);

      const viewReader = await this.connection.runAndReadAll(`
        SELECT view_name FROM duckdb_views()
        WHERE ${dbFilter}${schemaFilter}
        ORDER BY view_name
      `);

      const tables: TableInfo[] = tableReader.getRowObjectsJson().map((row) => ({
        name: row.table_name as string,
        schema: schemaName,
        columns: [],
      }));

      const views: TableInfo[] = viewReader.getRowObjectsJson().map((row) => ({
        name: row.view_name as string,
        schema: schemaName,
        columns: [],
      }));

      return { tables, views };
    } catch (error) {
      console.error(`Error fetching tables in schema ${schemaName}:`, error);
      return { tables: [], views: [] };
    }
  }

  async getColumns(schemaName: string, tableName: string): Promise<ColumnInfo[]> {
    if (!this.connection) {
      return [];
    }

    try {
      const { database, schema } = this.parseCompoundSchema(schemaName);
      const dbFilter = database
        ? `database_name = '${database.replace(/'/g, "''")}' AND `
        : '';

      const reader = await this.connection.runAndReadAll(`
        SELECT column_name, data_type, is_nullable
        FROM duckdb_columns()
        WHERE ${dbFilter}schema_name = '${schema.replace(/'/g, "''")}'
          AND table_name = '${tableName.replace(/'/g, "''")}'
        ORDER BY column_index
      `);

      return reader.getRowObjectsJson().map((row) => ({
        name: row.column_name as string,
        type: row.data_type as string,
        nullable: row.is_nullable === true,
      }));
    } catch (error) {
      console.error(`Error fetching columns for ${schemaName}.${tableName}:`, error);
      return [];
    }
  }

  private parseCompoundSchema(name: string): { database: string; schema: string } {
    const dotIndex = name.indexOf('.');
    if (dotIndex === -1) {
      return { database: '', schema: name };
    }
    return { database: name.substring(0, dotIndex), schema: name.substring(dotIndex + 1) };
  }

  /** Resolve the effective token and database — auto-detects JWT in the database field. */
  private resolveConfig(config: ConnectionConfig): { token: string; database: string } {
    if (config.motherduckToken) {
      return { token: config.motherduckToken, database: config.database || '' };
    }
    // Auto-detect: user may paste JWT token into the database field
    if (config.database && config.database.startsWith('ey')) {
      return { token: config.database, database: '' };
    }
    return { token: '', database: config.database || '' };
  }
}
