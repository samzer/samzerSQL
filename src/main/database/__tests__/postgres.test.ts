import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRelease, mockClientQuery, mockConnect, mockEnd } = vi.hoisted(() => ({
  mockRelease: vi.fn(),
  mockClientQuery: vi.fn(),
  mockConnect: vi.fn(),
  mockEnd: vi.fn(),
}));

vi.mock('pg', () => {
  class MockPool {
    connect = mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    end = mockEnd.mockResolvedValue(undefined);
  }
  return {
    Pool: MockPool,
    types: {
      setTypeParser: vi.fn(),
    },
  };
});

import { PostgresAdapter } from '../postgres';
import { ConnectionConfig } from '../../../shared/types';

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'pg-1',
    name: 'PG Test',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    username: 'user',
    password: 'pass',
    ...overrides,
  };
}

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PostgresAdapter();
    // Reset default mock behavior
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    mockEnd.mockResolvedValue(undefined);
  });

  describe('connect', () => {
    it('creates pool and tests connection', async () => {
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(true);
      expect(mockConnect).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('handles failure gracefully', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('disconnect', () => {
    it('ends pool', async () => {
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

    it('gets backend PID, runs query, maps columns', async () => {
      await adapter.connect(makeConfig());

      mockClientQuery
        .mockResolvedValueOnce({ rows: [{ pg_backend_pid: 42 }] })
        .mockResolvedValueOnce({
          fields: [
            { name: 'id', dataTypeID: 23 },
            { name: 'name', dataTypeID: 25 },
          ],
          rows: [{ id: 1, name: 'test' }],
          rowCount: 1,
        });

      const result = await adapter.executeQuery('SELECT * FROM t');
      expect(result.error).toBeUndefined();
      expect(result.columns).toEqual([
        { name: 'id', type: 'integer', nullable: true },
        { name: 'name', type: 'text', nullable: true },
      ]);
      expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
      expect(result.rowCount).toBe(1);
    });

    it('handles query errors', async () => {
      await adapter.connect(makeConfig());
      mockClientQuery
        .mockResolvedValueOnce({ rows: [{ pg_backend_pid: 42 }] })
        .mockRejectedValueOnce(new Error('syntax error'));

      const result = await adapter.executeQuery('BAD SQL');
      expect(result.error).toBe('syntax error');
    });
  });

  describe('cancelQuery', () => {
    it('calls pg_cancel_backend with correct PID', async () => {
      await adapter.connect(makeConfig());

      mockClientQuery
        .mockResolvedValueOnce({ rows: [{ pg_backend_pid: 99 }] })
        .mockImplementationOnce(() => new Promise(() => {}));

      const queryPromise = adapter.executeQuery('SELECT pg_sleep(100)');

      await new Promise((r) => setTimeout(r, 10));

      mockClientQuery.mockResolvedValueOnce(undefined);
      await adapter.cancelQuery();

      expect(mockClientQuery).toHaveBeenCalledWith('SELECT pg_cancel_backend($1)', [99]);
    });
  });

  describe('getSchema', () => {
    it('queries information_schema, excludes system schemas', async () => {
      await adapter.connect(makeConfig());
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ name: 'public' }, { name: 'myschema' }],
      });

      const result = await adapter.getSchema();
      expect(result.tables).toHaveLength(2);
      expect(result.tables[0].schema).toBe('public');
      expect(result.tables[1].schema).toBe('myschema');
    });
  });

  describe('getTablesInSchema', () => {
    it('returns tables and views separately', async () => {
      await adapter.connect(makeConfig());
      mockClientQuery
        .mockResolvedValueOnce({ rows: [{ name: 'users' }, { name: 'orders' }] })
        .mockResolvedValueOnce({ rows: [{ name: 'active_users' }] });

      const result = await adapter.getTablesInSchema('public');
      expect(result.tables).toHaveLength(2);
      expect(result.views).toHaveLength(1);
      expect(result.tables[0].name).toBe('users');
      expect(result.views[0].name).toBe('active_users');
    });
  });

  describe('getColumns', () => {
    it('maps nullable correctly', async () => {
      await adapter.connect(makeConfig());
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          { name: 'id', type: 'integer', nullable: 'NO' },
          { name: 'email', type: 'varchar', nullable: 'YES' },
        ],
      });

      const columns = await adapter.getColumns('public', 'users');
      expect(columns[0]).toEqual({ name: 'id', type: 'integer', nullable: false });
      expect(columns[1]).toEqual({ name: 'email', type: 'varchar', nullable: true });
    });
  });

  describe('testConnection', () => {
    it('creates separate pool, tests, cleans up', async () => {
      mockClientQuery.mockResolvedValueOnce(undefined);
      const result = await adapter.testConnection(makeConfig());
      expect(result.success).toBe(true);
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
