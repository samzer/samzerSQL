import * as mysql from 'mysql2/promise';
import { DatabaseAdapter } from './connection-manager';
import { ConnectionConfig, QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../../shared/types';

export class MySQLAdapter implements DatabaseAdapter {
  private connection: mysql.Connection | null = null;
  private threadId: number | null = null;

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      this.connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 10000,
      });

      return { success: true };
    } catch (error) {
      this.connection = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    let testConnection: mysql.Connection | null = null;

    try {
      testConnection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 10000,
      });

      await testConnection.query('SELECT 1');
      await testConnection.end();
      return { success: true };
    } catch (error) {
      if (testConnection) {
        await testConnection.end();
      }
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
      // Store the thread ID for potential cancellation
      this.threadId = this.connection.threadId ?? null;

      const [rows, fields] = await this.connection.query(query);
      const executionTime = Date.now() - startTime;
      this.threadId = null;

      if (!Array.isArray(rows)) {
        // INSERT, UPDATE, DELETE, etc.
        const result = rows as mysql.ResultSetHeader;
        return {
          columns: [],
          rows: [],
          rowCount: result.affectedRows,
          executionTime,
        };
      }

      const columns: ColumnInfo[] = (fields as mysql.FieldPacket[]).map((field) => ({
        name: field.name,
        type: this.getTypeName(field.type),
        nullable: typeof field.flags === 'number' ? (field.flags & 1) === 0 : true, // NOT_NULL_FLAG is 1
      }));

      return {
        columns,
        rows: rows as Record<string, unknown>[],
        rowCount: rows.length,
        executionTime,
      };
    } catch (error) {
      this.threadId = null;
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
    if (this.threadId && this.connection) {
      try {
        // Use KILL QUERY to cancel the running query without disconnecting
        await this.connection.query(`KILL QUERY ${this.threadId}`);
        console.log(`Cancelled MySQL query on thread ID: ${this.threadId}`);
      } catch (error) {
        console.error('Error cancelling MySQL query:', error);
      } finally {
        this.threadId = null;
      }
    }
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    try {
      // Get all accessible databases/schemas
      const [rows] = await this.connection.query(`
        SELECT SCHEMA_NAME as name
        FROM information_schema.SCHEMATA
        WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
        ORDER BY SCHEMA_NAME
      `);

      const tables: TableInfo[] = [];
      for (const row of rows as any[]) {
        // Create placeholder entries for each schema
        tables.push({
          name: '__schema_placeholder__',
          schema: row.name,
          columns: [],
        });
      }

      return { tables, views: [] };
    } catch {
      return { tables: [], views: [] };
    }
  }

  async getTablesInSchema(schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }> {
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    try {
      // Get tables
      const [tablesRows] = await this.connection.query(`
        SELECT TABLE_NAME as name
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `, [schemaName]);

      const tables: TableInfo[] = (tablesRows as any[]).map(row => ({
        name: row.name,
        schema: schemaName,
        columns: [],
      }));

      // Get views
      const [viewsRows] = await this.connection.query(`
        SELECT TABLE_NAME as name
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_TYPE = 'VIEW'
        ORDER BY TABLE_NAME
      `, [schemaName]);

      const views: TableInfo[] = (viewsRows as any[]).map(row => ({
        name: row.name,
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
      const [rows] = await this.connection.query(`
        SELECT
          COLUMN_NAME as name,
          DATA_TYPE as type,
          IS_NULLABLE as nullable
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [schemaName, tableName]);

      return (rows as any[]).map(row => ({
        name: row.name,
        type: row.type,
        nullable: row.nullable === 'YES',
      }));
    } catch (error) {
      console.error(`Error fetching columns for ${schemaName}.${tableName}:`, error);
      return [];
    }
  }

  private getTypeName(typeId: number | undefined): string {
    if (typeId === undefined) return 'unknown';

    const types: Record<number, string> = {
      0: 'decimal',
      1: 'tinyint',
      2: 'smallint',
      3: 'int',
      4: 'float',
      5: 'double',
      7: 'timestamp',
      8: 'bigint',
      9: 'mediumint',
      10: 'date',
      11: 'time',
      12: 'datetime',
      13: 'year',
      15: 'varchar',
      245: 'json',
      246: 'decimal',
      252: 'blob',
      253: 'varchar',
      254: 'char',
    };
    return types[typeId] || 'unknown';
  }
}
