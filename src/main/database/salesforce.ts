import { DatabaseAdapter } from './connection-manager';
import { ConnectionConfig, QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../../shared/types';

// jsforce types (simplified)
interface JSForceConnection {
  login(username: string, password: string, callback: (err: Error | null, userInfo: any) => void): void;
  logout(callback: (err: Error | null) => void): void;
  query(soql: string, callback: (err: Error | null, result: any) => void): void;
  describeGlobal(callback: (err: Error | null, result: any) => void): void;
  sobject(name: string): {
    describe(callback: (err: Error | null, result: any) => void): void;
  };
}

interface JSForceModule {
  Connection: new (options: { loginUrl?: string }) => JSForceConnection;
}

let jsforce: JSForceModule | null = null;

// Lazy load jsforce since it's optional
async function getJSForce(): Promise<JSForceModule> {
  if (!jsforce) {
    try {
      // @ts-ignore - jsforce is an optional dependency without type declarations
      jsforce = await import('jsforce') as unknown as JSForceModule;
    } catch {
      throw new Error('jsforce not installed. Run: npm install jsforce');
    }
  }
  return jsforce!;
}

export class SalesforceAdapter implements DatabaseAdapter {
  private connection: JSForceConnection | null = null;

  async connect(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const sf = await getJSForce();
      const loginUrl = config.loginUrl || 'https://login.salesforce.com';
      const conn = new sf.Connection({ loginUrl });
      const password = config.password + (config.securityToken || '');

      return new Promise((resolve) => {
        conn.login(config.username, password, (err) => {
          if (err) {
            resolve({
              success: false,
              error: err.message || 'Failed to connect to Salesforce',
            });
          } else {
            this.connection = conn;
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
        this.connection!.logout((err) => {
          if (err) {
            console.error('Error disconnecting from Salesforce:', err);
          }
          this.connection = null;
          resolve();
        });
      });
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const sf = await getJSForce();
      const loginUrl = config.loginUrl || 'https://login.salesforce.com';
      const conn = new sf.Connection({ loginUrl });
      const password = config.password + (config.securityToken || '');

      return new Promise((resolve) => {
        conn.login(config.username, password, (err) => {
          if (err) {
            resolve({
              success: false,
              error: err.message || 'Connection test failed',
            });
          } else {
            conn.logout(() => {});
            resolve({ success: true });
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
      this.connection!.query(query, (err, result) => {
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

        const records: Record<string, unknown>[] = (result.records || []).map((record: any) => {
          // Strip the 'attributes' metadata that Salesforce adds to every record
          const { attributes, ...fields } = record;
          return fields;
        });

        // Infer columns from the first row
        const columns: ColumnInfo[] = records.length > 0
          ? Object.keys(records[0]).map((key) => ({
              name: key,
              type: typeof records[0][key] === 'number' ? 'number' : 'string',
              nullable: true,
            }))
          : [];

        resolve({
          columns,
          rows: records,
          rowCount: result.totalSize || records.length,
          executionTime,
        });
      });
    });
  }

  async cancelQuery(): Promise<void> {
    // jsforce doesn't support query cancellation
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    // Return a single synthetic schema "sObjects"
    const tables: TableInfo[] = [
      {
        name: '__schema_placeholder__',
        schema: 'sObjects',
        columns: [],
      },
    ];

    return { tables, views: [] };
  }

  async getTablesInSchema(_schemaName: string): Promise<{ tables: TableInfo[]; views: TableInfo[] }> {
    if (!this.connection) {
      return { tables: [], views: [] };
    }

    try {
      return new Promise((resolve) => {
        this.connection!.describeGlobal((err, result) => {
          if (err) {
            console.error('Error fetching Salesforce sObjects:', err);
            resolve({ tables: [], views: [] });
            return;
          }

          const tables: TableInfo[] = (result.sobjects || [])
            .filter((obj: any) => obj.queryable)
            .map((obj: any) => ({
              name: obj.name,
              schema: 'sObjects',
              columns: [],
            }));

          resolve({ tables, views: [] });
        });
      });
    } catch (error) {
      console.error('Error fetching Salesforce sObjects:', error);
      return { tables: [], views: [] };
    }
  }

  async getColumns(_schemaName: string, tableName: string): Promise<ColumnInfo[]> {
    if (!this.connection) {
      return [];
    }

    try {
      return new Promise((resolve) => {
        this.connection!.sobject(tableName).describe((err, result) => {
          if (err) {
            console.error(`Error describing Salesforce sObject ${tableName}:`, err);
            resolve([]);
            return;
          }

          const columns: ColumnInfo[] = (result.fields || []).map((field: any) => ({
            name: field.name,
            type: field.type || 'string',
            nullable: field.nillable ?? true,
          }));

          resolve(columns);
        });
      });
    } catch (error) {
      console.error(`Error describing Salesforce sObject ${tableName}:`, error);
      return [];
    }
  }
}
