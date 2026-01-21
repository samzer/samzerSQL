import { DatabaseAdapter } from './connection-manager';
import { ConnectionConfig, QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../../shared/types';

// Snowflake SDK types (simplified)
interface SnowflakeConnection {
  connect: (callback: (err: Error | undefined, conn: SnowflakeConnection) => void) => void;
  execute: (options: {
    sqlText: string;
    complete: (err: Error | undefined, stmt: any, rows: any[]) => void;
  }) => { cancel: (callback: (err: Error | undefined) => void) => void };
  destroy: (callback: (err: Error | undefined) => void) => void;
}

interface SnowflakeSDK {
  createConnection: (options: any) => SnowflakeConnection;
}

let snowflake: SnowflakeSDK | null = null;

// Lazy load snowflake-sdk since it's optional
function getSnowflakeSDK(): SnowflakeSDK {
  if (!snowflake) {
    try {
      snowflake = require('snowflake-sdk');
    } catch {
      throw new Error('Snowflake SDK not installed. Run: npm install snowflake-sdk');
    }
  }
  return snowflake!;
}

export class SnowflakeAdapter implements DatabaseAdapter {
  private connection: SnowflakeConnection | null = null;
  private currentStatement: { cancel: (callback: (err: Error | undefined) => void) => void } | null = null;

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const sdk = getSnowflakeSDK();

      this.connection = sdk.createConnection({
        account: config.account,
        username: config.username,
        password: config.password,
        warehouse: config.warehouse,
        database: config.database,
        schema: config.schema || 'PUBLIC',
        role: config.role,
      });

      return new Promise((resolve) => {
        this.connection!.connect((err) => {
          if (err) {
            this.connection = null;
            resolve({
              success: false,
              error: err.message || 'Failed to connect to Snowflake',
            });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      return new Promise((resolve) => {
        this.connection!.destroy((err) => {
          if (err) {
            console.error('Error disconnecting from Snowflake:', err);
          }
          this.connection = null;
          resolve();
        });
      });
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const sdk = getSnowflakeSDK();

      const testConn = sdk.createConnection({
        account: config.account,
        username: config.username,
        password: config.password,
        warehouse: config.warehouse,
        database: config.database,
        schema: config.schema || 'PUBLIC',
        role: config.role,
      });

      return new Promise((resolve) => {
        testConn.connect((err, conn) => {
          if (err) {
            resolve({
              success: false,
              error: err.message || 'Connection test failed',
            });
          } else {
            conn.execute({
              sqlText: 'SELECT 1',
              complete: (execErr) => {
                conn.destroy(() => {});
                if (execErr) {
                  resolve({
                    success: false,
                    error: execErr.message || 'Query test failed',
                  });
                } else {
                  resolve({ success: true });
                }
              },
            });
          }
        });
      });
    } catch (error) {
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

    return new Promise((resolve) => {
      this.currentStatement = this.connection!.execute({
        sqlText: query,
        complete: (err, stmt, rows) => {
          this.currentStatement = null;
          const executionTime = Date.now() - startTime;

          if (err) {
            resolve({
              columns: [],
              rows: [],
              rowCount: 0,
              executionTime,
              error: err.message || 'Query execution failed',
            });
            return;
          }

          // Extract columns from statement metadata
          const columns: ColumnInfo[] = stmt.getColumns().map((col: any) => ({
            name: col.getName(),
            type: col.getType(),
            nullable: col.isNullable(),
          }));

          resolve({
            columns,
            rows: rows || [],
            rowCount: rows?.length || 0,
            executionTime,
          });
        },
      });
    });
  }

  async cancelQuery(): Promise<void> {
    if (this.currentStatement) {
      return new Promise((resolve) => {
        this.currentStatement!.cancel((err) => {
          if (err) {
            console.error('Error cancelling Snowflake query:', err);
          }
          this.currentStatement = null;
          resolve();
        });
      });
    }
  }

  async getSchema(): Promise<SchemaInfo> {
    // For initial load, just return schemas as empty table placeholders
    // Tables and columns will be loaded lazily
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    try {
      const schemasResult = await this.executeQuery('SHOW SCHEMAS');
      if (schemasResult.error || !schemasResult.rows.length) {
        return { tables: [], views: [] };
      }

      const tables: TableInfo[] = [];
      const schemaNames = schemasResult.rows
        .map((row: any) => row.name || row.NAME)
        .filter((name: string) => name && !name.startsWith('INFORMATION_SCHEMA'));

      // Create a placeholder entry for each schema so the UI knows about them
      for (const schemaName of schemaNames) {
        tables.push({
          name: '__schema_placeholder__',
          schema: String(schemaName),
          columns: [],
        });
      }

      return { tables, views: [] };
    } catch (error) {
      console.error('Error fetching Snowflake schemas:', error);
      return { tables: [], views: [] };
    }
  }

  async getTablesInSchema(schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }> {
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    try {
      const tables: TableInfo[] = [];
      const views: TableInfo[] = [];

      // Get tables
      const tablesResult = await this.executeQuery(`SHOW TABLES IN SCHEMA "${schemaName}"`);
      if (!tablesResult.error && tablesResult.rows.length > 0) {
        for (const tableRow of tablesResult.rows) {
          const tableName = tableRow.name || tableRow.NAME;
          tables.push({
            name: String(tableName),
            schema: String(schemaName),
            columns: [], // Columns loaded lazily
          });
        }
      }

      // Get views
      const viewsResult = await this.executeQuery(`SHOW VIEWS IN SCHEMA "${schemaName}"`);
      if (!viewsResult.error && viewsResult.rows.length > 0) {
        for (const viewRow of viewsResult.rows) {
          const viewName = viewRow.name || viewRow.NAME;
          views.push({
            name: String(viewName),
            schema: String(schemaName),
            columns: [], // Columns loaded lazily
          });
        }
      }

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
      const columnsResult = await this.executeQuery(
        `SHOW COLUMNS IN TABLE "${schemaName}"."${tableName}"`
      );

      const columns: ColumnInfo[] = [];
      if (!columnsResult.error && columnsResult.rows.length > 0) {
        for (const colRow of columnsResult.rows as Record<string, unknown>[]) {
          const rawType = colRow.data_type || colRow.DATA_TYPE || colRow['data type'] || 'unknown';
          let typeStr = 'unknown';

          // Snowflake returns data_type as a JSON object like {"type":"TEXT","length":255,...}
          if (typeof rawType === 'string') {
            try {
              const parsed = JSON.parse(rawType);
              if (parsed && parsed.type) {
                typeStr = parsed.type;
                // Add precision/scale for numeric types
                if (parsed.precision !== undefined && parsed.scale !== undefined) {
                  typeStr = `${parsed.type}(${parsed.precision},${parsed.scale})`;
                } else if (parsed.length !== undefined && parsed.type === 'TEXT') {
                  typeStr = `VARCHAR(${parsed.length})`;
                }
              }
            } catch {
              // Not JSON, use as-is
              typeStr = String(rawType);
            }
          } else if (typeof rawType === 'object' && rawType !== null) {
            const obj = rawType as Record<string, unknown>;
            typeStr = String(obj.type || 'unknown');
          }

          columns.push({
            name: String(colRow.column_name || colRow.COLUMN_NAME || colRow['column name'] || ''),
            type: typeStr,
            nullable: String(colRow.null || colRow.NULL || colRow['null?'] || 'Y') !== 'N',
          });
        }
      }

      return columns;
    } catch (error) {
      console.error(`Error fetching columns for ${schemaName}.${tableName}:`, error);
      return [];
    }
  }
}
