import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionConfig } from '../../../shared/types';

const { __mockCreate, __mockConnect, __mockRun, __mockRunAndReadAll, __mockCloseSync, __mockInstanceCloseSync, __mockInterrupt } = vi.hoisted(() => ({
  __mockCreate: vi.fn(),
  __mockConnect: vi.fn(),
  __mockRun: vi.fn(),
  __mockRunAndReadAll: vi.fn(),
  __mockCloseSync: vi.fn(),
  __mockInstanceCloseSync: vi.fn(),
  __mockInterrupt: vi.fn(),
}));

vi.mock('@duckdb/node-api', () => ({
  DuckDBInstance: {
    create: __mockCreate,
  },
}));

import { MotherDuckAdapter } from '../motherduck';

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'md-1',
    name: 'MotherDuck Test',
    type: 'motherduck',
    host: '',
    port: 0,
    database: 'testdb',
    username: '',
    password: '',
    ...overrides,
  };
}

function setupMockInstance() {
  const mockConnection = {
    run: __mockRun,
    runAndReadAll: __mockRunAndReadAll,
    closeSync: __mockCloseSync,
    interrupt: __mockInterrupt,
  };

  const mockInstance = {
    connect: __mockConnect.mockResolvedValue(mockConnection),
    closeSync: __mockInstanceCloseSync,
  };

  __mockCreate.mockResolvedValue(mockInstance);
  return { mockInstance, mockConnection };
}

describe('MotherDuckAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('connects with MotherDuck token (cloud)', async () => {
      setupMockInstance();

      const adapter = new MotherDuckAdapter();
      const result = await adapter.connect(makeConfig({ motherduckToken: 'my-token' }));

      expect(result.success).toBe(true);
      expect(__mockCreate).toHaveBeenCalledWith('md:testdb', { motherduck_token: 'my-token' });
      expect(__mockConnect).toHaveBeenCalledTimes(1);
    });

    it('connects with local file path', async () => {
      setupMockInstance();

      const adapter = new MotherDuckAdapter();
      const result = await adapter.connect(makeConfig({ filePath: '/tmp/test.duckdb', database: '' }));

      expect(result.success).toBe(true);
      expect(__mockCreate).toHaveBeenCalledWith('/tmp/test.duckdb', {});
    });

    it('connects in-memory when no token or file path', async () => {
      setupMockInstance();

      const adapter = new MotherDuckAdapter();
      const result = await adapter.connect(makeConfig({ database: '' }));

      expect(result.success).toBe(true);
      expect(__mockCreate).toHaveBeenCalledWith(':memory:', {});
    });

    it('auto-detects JWT token in database field', async () => {
      setupMockInstance();

      const adapter = new MotherDuckAdapter();
      const result = await adapter.connect(makeConfig({
        motherduckToken: '',
        database: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-token',
      }));

      expect(result.success).toBe(true);
      expect(__mockCreate).toHaveBeenCalledWith('md:', {
        motherduck_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-token',
      });
    });

    it('handles connection failure', async () => {
      __mockCreate.mockRejectedValue(new Error('Connection refused'));

      const adapter = new MotherDuckAdapter();
      const result = await adapter.connect(makeConfig());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('disconnect', () => {
    it('closes connection and disposes instance', async () => {
      setupMockInstance();

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      await adapter.disconnect();

      expect(__mockCloseSync).toHaveBeenCalledTimes(1);
      expect(__mockInstanceCloseSync).toHaveBeenCalledTimes(1);
    });

    it('handles disconnect when not connected', async () => {
      const adapter = new MotherDuckAdapter();
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('executeQuery', () => {
    it('returns error when not connected', async () => {
      const adapter = new MotherDuckAdapter();
      const result = await adapter.executeQuery('SELECT 1');
      expect(result.error).toBe('Not connected');
    });

    it('SELECT returns mapped columns and rows', async () => {
      setupMockInstance();

      __mockRunAndReadAll.mockResolvedValue({
        columnNames: () => ['id', 'name'],
        columnTypes: () => [{ toString: () => 'INTEGER' }, { toString: () => 'VARCHAR' }],
        getRowObjectsJson: () => [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      });

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      const result = await adapter.executeQuery('SELECT id, name FROM users');

      expect(result.error).toBeUndefined();
      expect(result.columns).toEqual([
        { name: 'id', type: 'INTEGER', nullable: true },
        { name: 'name', type: 'VARCHAR', nullable: true },
      ]);
      expect(result.rows).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
      expect(result.rowCount).toBe(2);
    });

    it('non-SELECT returns changes', async () => {
      setupMockInstance();

      __mockRun.mockResolvedValue({ rowsChanged: 3 });

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      const result = await adapter.executeQuery('DELETE FROM users WHERE active = false');

      expect(result.error).toBeUndefined();
      expect(result.rowCount).toBe(3);
      expect(result.rows[0].result).toContain('3 row(s) affected');
    });

    it('handles query errors', async () => {
      setupMockInstance();

      __mockRunAndReadAll.mockRejectedValue(new Error('Syntax error'));

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      const result = await adapter.executeQuery('SELECT BAD SQL');

      expect(result.error).toBe('Syntax error');
    });
  });

  describe('cancelQuery', () => {
    it('calls interrupt on connection', async () => {
      setupMockInstance();

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      await adapter.cancelQuery();

      expect(__mockInterrupt).toHaveBeenCalledTimes(1);
    });

    it('does nothing when not connected', async () => {
      const adapter = new MotherDuckAdapter();
      await expect(adapter.cancelQuery()).resolves.toBeUndefined();
    });
  });

  describe('getSchema', () => {
    it('uses duckdb_schemas() and filters internal databases', async () => {
      setupMockInstance();

      // duckdb_schemas() returns all schemas across all databases
      __mockRunAndReadAll.mockResolvedValueOnce({
        getRowObjectsJson: () => [
          { database_name: 'system', schema_name: 'main' },
          { database_name: 'temp', schema_name: 'main' },
          { database_name: 'memory', schema_name: 'main' },
          { database_name: 'my_db', schema_name: 'information_schema' },
          { database_name: 'my_db', schema_name: 'main' },
          { database_name: 'sample_data', schema_name: 'information_schema' },
          { database_name: 'sample_data', schema_name: 'hn' },
          { database_name: 'sample_data', schema_name: 'nyc' },
        ],
      });

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      const result = await adapter.getSchema();

      expect(result.tables).toHaveLength(3);
      expect(result.tables.map((t) => t.schema)).toEqual([
        'my_db.main',
        'sample_data.hn',
        'sample_data.nyc',
      ]);
      expect(result.tables[0].name).toBe('__schema_placeholder__');

      // Verify duckdb_schemas() was used
      expect(__mockRunAndReadAll.mock.calls[0][0]).toContain('duckdb_schemas()');
    });
  });

  describe('getTablesInSchema', () => {
    it('uses duckdb_tables() and duckdb_views() to separate tables and views', async () => {
      setupMockInstance();

      // First call (after connect): duckdb_tables()
      __mockRunAndReadAll.mockResolvedValueOnce({
        getRowObjectsJson: () => [
          { table_name: 'users' },
          { table_name: 'orders' },
        ],
      });
      // Second call: duckdb_views()
      __mockRunAndReadAll.mockResolvedValueOnce({
        getRowObjectsJson: () => [
          { view_name: 'v_active_users' },
        ],
      });

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      const result = await adapter.getTablesInSchema('sample_data.main');

      expect(result.tables).toHaveLength(2);
      expect(result.tables[0].name).toBe('users');
      expect(result.tables[1].name).toBe('orders');
      expect(result.views).toHaveLength(1);
      expect(result.views[0].name).toBe('v_active_users');

      // Verify queries use duckdb system functions with database filter
      const tablesSql = __mockRunAndReadAll.mock.calls[0][0];
      expect(tablesSql).toContain('duckdb_tables()');
      expect(tablesSql).toContain("database_name = 'sample_data'");
      expect(tablesSql).toContain("schema_name = 'main'");

      const viewsSql = __mockRunAndReadAll.mock.calls[1][0];
      expect(viewsSql).toContain('duckdb_views()');
    });
  });

  describe('getColumns', () => {
    it('uses duckdb_columns() with database filter', async () => {
      setupMockInstance();

      __mockRunAndReadAll.mockResolvedValue({
        getRowObjectsJson: () => [
          { column_name: 'id', data_type: 'INTEGER', is_nullable: false },
          { column_name: 'email', data_type: 'VARCHAR', is_nullable: true },
        ],
      });

      const adapter = new MotherDuckAdapter();
      await adapter.connect(makeConfig());
      const columns = await adapter.getColumns('sample_data.hn', 'users');

      expect(columns).toEqual([
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'email', type: 'VARCHAR', nullable: true },
      ]);

      // Verify query uses duckdb_columns() with database filter
      const sql = __mockRunAndReadAll.mock.calls[0][0];
      expect(sql).toContain('duckdb_columns()');
      expect(sql).toContain("database_name = 'sample_data'");
      expect(sql).toContain("schema_name = 'hn'");
      expect(sql).toContain("table_name = 'users'");
    });
  });

  describe('testConnection', () => {
    it('returns success on valid connection', async () => {
      setupMockInstance();
      __mockRun.mockResolvedValue({});

      const adapter = new MotherDuckAdapter();
      const result = await adapter.testConnection(makeConfig());

      expect(result.success).toBe(true);
      // Verify cleanup happened
      expect(__mockCloseSync).toHaveBeenCalled();
      expect(__mockInstanceCloseSync).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      __mockCreate.mockRejectedValue(new Error('Invalid token'));

      const adapter = new MotherDuckAdapter();
      const result = await adapter.testConnection(makeConfig({ motherduckToken: 'bad-token' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });
});
