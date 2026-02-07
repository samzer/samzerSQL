import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionConfig } from '../../../shared/types';

const { __mockConnect, __mockExecute, __mockDestroy } = vi.hoisted(() => ({
  __mockConnect: vi.fn(),
  __mockExecute: vi.fn(),
  __mockDestroy: vi.fn(),
}));

vi.mock('snowflake-sdk', () => ({
  createConnection: vi.fn(() => ({
    connect: __mockConnect,
    execute: __mockExecute,
    destroy: __mockDestroy,
  })),
}));

import { SnowflakeAdapter } from '../snowflake';

let mockCancel: ReturnType<typeof vi.fn>;

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'sf-1',
    name: 'Snowflake Test',
    type: 'snowflake',
    host: '',
    port: 443,
    database: 'TESTDB',
    username: 'user',
    password: 'pass',
    account: 'abc123',
    warehouse: 'COMPUTE_WH',
    ...overrides,
  };
}

describe('SnowflakeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancel = vi.fn();

    // Default: connect succeeds
    __mockConnect.mockImplementation((cb: (err: any, conn: any) => void) => {
      cb(undefined, { execute: __mockExecute, destroy: __mockDestroy });
    });
  });

  describe('connect', () => {
    it('uses callback-based API correctly', async () => {
      const adapter = new SnowflakeAdapter();
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(true);
      expect(__mockConnect).toHaveBeenCalledTimes(1);
    });

    it('handles connection failure', async () => {
      __mockConnect.mockImplementationOnce((cb: (err: any) => void) => {
        cb(new Error('Invalid account'));
      });

      const adapter = new SnowflakeAdapter();
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid account');
    });
  });

  describe('disconnect', () => {
    it('calls destroy()', async () => {
      const adapter = new SnowflakeAdapter();
      await adapter.connect(makeConfig());
      __mockDestroy.mockImplementation((cb: (err: any) => void) => cb(undefined));
      await adapter.disconnect();
      expect(__mockDestroy).toHaveBeenCalled();
    });
  });

  describe('executeQuery', () => {
    it('returns error when not connected', async () => {
      const adapter = new SnowflakeAdapter();
      const result = await adapter.executeQuery('SELECT 1');
      expect(result.error).toBe('Not connected');
    });

    it('maps statement metadata to columns', async () => {
      const adapter = new SnowflakeAdapter();
      await adapter.connect(makeConfig());

      const mockStmt = {
        getColumns: () => [
          { getName: () => 'ID', getType: () => 'NUMBER', isNullable: () => false },
          { getName: () => 'NAME', getType: () => 'VARCHAR', isNullable: () => true },
        ],
      };

      __mockExecute.mockImplementationOnce((opts: any) => {
        opts.complete(undefined, mockStmt, [{ ID: 1, NAME: 'test' }]);
        return { cancel: mockCancel };
      });

      const result = await adapter.executeQuery('SELECT * FROM t');
      expect(result.error).toBeUndefined();
      expect(result.columns).toEqual([
        { name: 'ID', type: 'NUMBER', nullable: false },
        { name: 'NAME', type: 'VARCHAR', nullable: true },
      ]);
      expect(result.rows).toEqual([{ ID: 1, NAME: 'test' }]);
    });

    it('handles query errors', async () => {
      const adapter = new SnowflakeAdapter();
      await adapter.connect(makeConfig());
      __mockExecute.mockImplementationOnce((opts: any) => {
        opts.complete(new Error('SQL compilation error'), null, []);
        return { cancel: mockCancel };
      });

      const result = await adapter.executeQuery('BAD SQL');
      expect(result.error).toBe('SQL compilation error');
    });
  });

  describe('cancelQuery', () => {
    it('calls statement.cancel()', async () => {
      const adapter = new SnowflakeAdapter();
      await adapter.connect(makeConfig());

      __mockExecute.mockImplementationOnce(() => {
        return { cancel: mockCancel.mockImplementation((cb: (err: any) => void) => cb(undefined)) };
      });

      const queryPromise = adapter.executeQuery('SELECT 1');
      await new Promise((r) => setTimeout(r, 10));

      await adapter.cancelQuery();
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('getSchema', () => {
    it('runs SHOW SCHEMAS and filters INFORMATION_SCHEMA', async () => {
      const adapter = new SnowflakeAdapter();
      await adapter.connect(makeConfig());

      const mockStmt = {
        getColumns: () => [
          { getName: () => 'name', getType: () => 'VARCHAR', isNullable: () => true },
        ],
      };

      __mockExecute.mockImplementationOnce((opts: any) => {
        opts.complete(undefined, mockStmt, [
          { name: 'PUBLIC' },
          { name: 'INFORMATION_SCHEMA' },
          { name: 'MYSCHEMA' },
        ]);
        return { cancel: mockCancel };
      });

      const result = await adapter.getSchema();
      expect(result.tables).toHaveLength(2);
      expect(result.tables.map((t: any) => t.schema)).toEqual(['PUBLIC', 'MYSCHEMA']);
    });
  });

  describe('getTablesInSchema', () => {
    it('runs SHOW TABLES + SHOW VIEWS', async () => {
      const adapter = new SnowflakeAdapter();
      await adapter.connect(makeConfig());

      const mockStmt = {
        getColumns: () => [
          { getName: () => 'name', getType: () => 'VARCHAR', isNullable: () => true },
        ],
      };

      __mockExecute
        .mockImplementationOnce((opts: any) => {
          opts.complete(undefined, mockStmt, [{ name: 'USERS' }, { name: 'ORDERS' }]);
          return { cancel: mockCancel };
        })
        .mockImplementationOnce((opts: any) => {
          opts.complete(undefined, mockStmt, [{ name: 'V_ACTIVE' }]);
          return { cancel: mockCancel };
        });

      const result = await adapter.getTablesInSchema('PUBLIC');
      expect(result.tables).toHaveLength(2);
      expect(result.views).toHaveLength(1);
    });
  });

  describe('getColumns', () => {
    it('parses JSON data_type with precision/scale', async () => {
      const adapter = new SnowflakeAdapter();
      await adapter.connect(makeConfig());

      const mockStmt = {
        getColumns: () => [
          { getName: () => 'column_name', getType: () => 'VARCHAR', isNullable: () => true },
          { getName: () => 'data_type', getType: () => 'VARCHAR', isNullable: () => true },
          { getName: () => 'null', getType: () => 'VARCHAR', isNullable: () => true },
        ],
      };

      __mockExecute.mockImplementationOnce((opts: any) => {
        opts.complete(undefined, mockStmt, [
          {
            column_name: 'AMOUNT',
            data_type: '{"type":"NUMBER","precision":10,"scale":2}',
            null: 'Y',
          },
          {
            column_name: 'NAME',
            data_type: '{"type":"TEXT","length":255}',
            null: 'N',
          },
        ]);
        return { cancel: mockCancel };
      });

      const columns = await adapter.getColumns('PUBLIC', 'ORDERS');
      expect(columns[0]).toEqual({ name: 'AMOUNT', type: 'NUMBER(10,2)', nullable: true });
      expect(columns[1]).toEqual({ name: 'NAME', type: 'VARCHAR(255)', nullable: false });
    });
  });
});
