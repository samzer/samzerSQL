import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery, mockEnd } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnd: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('mysql2/promise', () => ({
  createConnection: vi.fn().mockResolvedValue({
    query: mockQuery,
    end: mockEnd,
    threadId: 42,
  }),
}));

import { MySQLAdapter } from '../mysql';
import { ConnectionConfig } from '../../../shared/types';

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'mysql-1',
    name: 'MySQL Test',
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'testdb',
    username: 'root',
    password: 'pass',
    ...overrides,
  };
}

describe('MySQLAdapter', () => {
  let adapter: MySQLAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MySQLAdapter();
  });

  describe('connect', () => {
    it('creates connection with correct config', async () => {
      const mysql = await import('mysql2/promise');
      const result = await adapter.connect(makeConfig({ ssl: true }));
      expect(result.success).toBe(true);
      expect(mysql.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 3306,
          dateStrings: ['DATE'],
          ssl: { rejectUnauthorized: false },
        })
      );
    });
  });

  describe('disconnect', () => {
    it('ends connection', async () => {
      await adapter.connect(makeConfig());
      await adapter.disconnect();
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('executeQuery', () => {
    it('returns error when not connected', async () => {
      const result = await adapter.executeQuery('SELECT 1');
      expect(result.error).toBe('Not connected');
    });

    it('handles SELECT (returns rows + columns)', async () => {
      await adapter.connect(makeConfig());
      mockQuery.mockResolvedValueOnce([
        [{ id: 1, name: 'test' }],
        [
          { name: 'id', type: 3, flags: 1 },
          { name: 'name', type: 253, flags: 0 },
        ],
      ]);

      const result = await adapter.executeQuery('SELECT * FROM t');
      expect(result.error).toBeUndefined();
      expect(result.columns).toEqual([
        { name: 'id', type: 'int', nullable: false },
        { name: 'name', type: 'varchar', nullable: true },
      ]);
      expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
    });

    it('handles INSERT/UPDATE (returns ResultSetHeader)', async () => {
      await adapter.connect(makeConfig());
      mockQuery.mockResolvedValueOnce([
        { affectedRows: 3, insertId: 10 },
        undefined,
      ]);

      const result = await adapter.executeQuery('INSERT INTO t VALUES (1)');
      expect(result.rowCount).toBe(3);
    });

    it('handles query errors', async () => {
      await adapter.connect(makeConfig());
      mockQuery.mockRejectedValueOnce(new Error('table not found'));
      const result = await adapter.executeQuery('SELECT * FROM missing');
      expect(result.error).toBe('table not found');
    });
  });

  describe('cancelQuery', () => {
    it('runs KILL QUERY with thread ID', async () => {
      await adapter.connect(makeConfig());

      // Start a long-running query that never resolves
      mockQuery.mockImplementationOnce(() => new Promise(() => {}));
      const queryPromise = adapter.executeQuery('SELECT SLEEP(100)');

      await new Promise((r) => setTimeout(r, 10));

      mockQuery.mockResolvedValueOnce(undefined);
      await adapter.cancelQuery();

      expect(mockQuery).toHaveBeenCalledWith('KILL QUERY 42');
    });
  });

  describe('getSchema', () => {
    it('excludes system schemas', async () => {
      await adapter.connect(makeConfig());
      mockQuery.mockResolvedValueOnce([
        [{ name: 'mydb' }, { name: 'other_db' }],
        undefined,
      ]);

      const result = await adapter.getSchema();
      expect(result.tables).toHaveLength(2);
      expect(result.tables[0].schema).toBe('mydb');
    });
  });

  describe('getTablesInSchema', () => {
    it('returns tables and views', async () => {
      await adapter.connect(makeConfig());
      mockQuery
        .mockResolvedValueOnce([[{ name: 'users' }], undefined])
        .mockResolvedValueOnce([[{ name: 'v_active' }], undefined]);

      const result = await adapter.getTablesInSchema('mydb');
      expect(result.tables).toHaveLength(1);
      expect(result.views).toHaveLength(1);
    });
  });

  describe('getColumns', () => {
    it('maps nullable correctly', async () => {
      await adapter.connect(makeConfig());
      mockQuery.mockResolvedValueOnce([
        [
          { name: 'id', type: 'int', nullable: 'NO' },
          { name: 'email', type: 'varchar', nullable: 'YES' },
        ],
        undefined,
      ]);

      const columns = await adapter.getColumns('mydb', 'users');
      expect(columns[0]).toEqual({ name: 'id', type: 'int', nullable: false });
      expect(columns[1]).toEqual({ name: 'email', type: 'varchar', nullable: true });
    });
  });

  describe('getTypeName', () => {
    it('maps known type IDs', async () => {
      await adapter.connect(makeConfig());
      mockQuery.mockResolvedValueOnce([
        [{ val: 1 }],
        [{ name: 'val', type: 8, flags: 0 }],
      ]);
      const result = await adapter.executeQuery('SELECT 1');
      expect(result.columns[0].type).toBe('bigint');
    });

    it('returns unknown for unmapped type', async () => {
      await adapter.connect(makeConfig());
      mockQuery.mockResolvedValueOnce([
        [{ val: 1 }],
        [{ name: 'val', type: 999, flags: 0 }],
      ]);
      const result = await adapter.executeQuery('SELECT 1');
      expect(result.columns[0].type).toBe('unknown');
    });
  });
});
