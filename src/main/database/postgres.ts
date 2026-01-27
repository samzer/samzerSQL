import { Pool, PoolClient, types } from 'pg';
import { DatabaseAdapter } from './connection-manager';
import { ConnectionConfig, QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../../shared/types';

// Return date values as plain strings (e.g., "2024-01-15") instead of JavaScript Date objects
types.setTypeParser(1082, (val: string) => val);

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private activeClient: PoolClient | null = null;
  private backendPid: number | null = null;

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      this.pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test the connection
      const client = await this.pool.connect();
      client.release();

      return { success: true };
    } catch (error) {
      this.pool = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.activeClient) {
      this.activeClient.release();
      this.activeClient = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    const testPool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 1,
      connectionTimeoutMillis: 10000,
    });

    try {
      const client = await testPool.connect();
      await client.query('SELECT 1');
      client.release();
      await testPool.end();
      return { success: true };
    } catch (error) {
      await testPool.end();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.pool) {
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
      this.activeClient = await this.pool.connect();

      // Get the backend PID for this connection so we can cancel it later
      const pidResult = await this.activeClient.query('SELECT pg_backend_pid()');
      this.backendPid = pidResult.rows[0].pg_backend_pid;

      const result = await this.activeClient.query(query);
      const executionTime = Date.now() - startTime;
      this.backendPid = null;

      const columns: ColumnInfo[] = result.fields.map((field) => ({
        name: field.name,
        type: this.getTypeName(field.dataTypeID),
        nullable: true,
      }));

      return {
        columns,
        rows: result.rows,
        rowCount: result.rowCount || 0,
        executionTime,
      };
    } catch (error) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Query execution failed',
      };
    } finally {
      if (this.activeClient) {
        this.activeClient.release();
        this.activeClient = null;
      }
    }
  }

  async cancelQuery(): Promise<void> {
    if (this.backendPid && this.pool) {
      try {
        // Use a separate connection to cancel the running query
        const client = await this.pool.connect();
        await client.query('SELECT pg_cancel_backend($1)', [this.backendPid]);
        client.release();
        console.log(`Cancelled PostgreSQL query on backend PID: ${this.backendPid}`);
      } catch (error) {
        console.error('Error cancelling PostgreSQL query:', error);
      } finally {
        this.backendPid = null;
      }
    }
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) {
      return { tables: [], views: [] };
    }

    try {
      const client = await this.pool.connect();

      // Get all schemas
      const schemasResult = await client.query(`
        SELECT schema_name as name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `);

      client.release();

      const tables: TableInfo[] = schemasResult.rows.map(row => ({
        name: '__schema_placeholder__',
        schema: row.name,
        columns: [],
      }));

      return { tables, views: [] };
    } catch {
      return { tables: [], views: [] };
    }
  }

  async getTablesInSchema(schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }> {
    if (!this.pool) {
      return { tables: [], views: [] };
    }

    try {
      const client = await this.pool.connect();

      // Get tables
      const tablesResult = await client.query(`
        SELECT table_name as name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [schemaName]);

      const tables: TableInfo[] = tablesResult.rows.map(row => ({
        name: row.name,
        schema: schemaName,
        columns: [],
      }));

      // Get views
      const viewsResult = await client.query(`
        SELECT table_name as name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'VIEW'
        ORDER BY table_name
      `, [schemaName]);

      const views: TableInfo[] = viewsResult.rows.map(row => ({
        name: row.name,
        schema: schemaName,
        columns: [],
      }));

      client.release();
      return { tables, views };
    } catch (error) {
      console.error(`Error fetching tables in schema ${schemaName}:`, error);
      return { tables: [], views: [] };
    }
  }

  async getColumns(schemaName: string, tableName: string): Promise<ColumnInfo[]> {
    if (!this.pool) {
      return [];
    }

    try {
      const client = await this.pool.connect();

      const result = await client.query(`
        SELECT
          column_name as name,
          data_type as type,
          is_nullable as nullable
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
        ORDER BY ordinal_position
      `, [schemaName, tableName]);

      client.release();

      return result.rows.map(row => ({
        name: row.name,
        type: row.type,
        nullable: row.nullable === 'YES',
      }));
    } catch (error) {
      console.error(`Error fetching columns for ${schemaName}.${tableName}:`, error);
      return [];
    }
  }

  private getTypeName(typeId: number): string {
    const types: Record<number, string> = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'real',
      701: 'double precision',
      1043: 'varchar',
      1082: 'date',
      1083: 'time',
      1114: 'timestamp',
      1184: 'timestamptz',
      1700: 'numeric',
      2950: 'uuid',
      3802: 'jsonb',
      114: 'json',
    };
    return types[typeId] || 'unknown';
  }
}
