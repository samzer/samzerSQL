import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionConfig } from '../../../shared/types';

const { __mockExec, __mockRun, __mockClose, __mockExport, mockExistsSync, mockReadFileSync, mockWriteFileSync, mockMkdirSync } = vi.hoisted(() => ({
  __mockExec: vi.fn().mockReturnValue([]),
  __mockRun: vi.fn(),
  __mockClose: vi.fn(),
  __mockExport: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockReadFileSync: vi.fn().mockReturnValue(Buffer.from([1, 2, 3])),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
}));

vi.mock('sql.js', () => {
  class MockDatabase {
    exec = __mockExec;
    run = __mockRun;
    close = __mockClose;
    export = __mockExport;
  }
  return {
    default: vi.fn().mockResolvedValue({ Database: MockDatabase }),
  };
});

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
}));

vi.mock('path', () => ({
  dirname: vi.fn().mockReturnValue('/tmp'),
}));

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'sqlite-1',
    name: 'SQLite Test',
    type: 'sqlite',
    host: '',
    port: 0,
    database: '',
    username: '',
    password: '',
    filePath: '/tmp/test.db',
    ...overrides,
  };
}

describe('SQLiteAdapter', () => {
  let SQLiteAdapter: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Import the adapter after resetting modules
    const mod = await import('../sqlite');
    SQLiteAdapter = mod.SQLiteAdapter;

    // Default: exec returns empty for SELECT 1 test during connect
    __mockExec.mockReturnValue([]);
    mockExistsSync.mockReturnValue(false);
  });

  describe('connect', () => {
    it('requires filePath', async () => {
      const adapter = new SQLiteAdapter();
      const result = await adapter.connect(makeConfig({ filePath: undefined }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('file path is required');
    });

    it('creates new DB when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const adapter = new SQLiteAdapter();
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(true);
    });

    it('loads existing file when present', async () => {
      mockExistsSync.mockReturnValue(true);
      const adapter = new SQLiteAdapter();
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(true);
      expect(mockReadFileSync).toHaveBeenCalledWith('/tmp/test.db');
    });
  });

  describe('executeQuery', () => {
    it('returns error when not connected', async () => {
      const adapter = new SQLiteAdapter();
      const result = await adapter.executeQuery('SELECT 1');
      expect(result.error).toBe('Not connected');
    });

    it('SELECT returns mapped rows', async () => {
      const adapter = new SQLiteAdapter();
      await adapter.connect(makeConfig());

      __mockExec.mockReturnValueOnce([
        {
          columns: ['id', 'name'],
          values: [
            [1, 'Alice'],
            [2, 'Bob'],
          ],
        },
      ]);

      const result = await adapter.executeQuery('SELECT id, name FROM users');
      expect(result.rows).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
      expect(result.columns[0]).toEqual({ name: 'id', type: 'unknown', nullable: true });
    });

    it('INSERT runs changes(), saves to file', async () => {
      const adapter = new SQLiteAdapter();
      await adapter.connect(makeConfig());

      __mockExec.mockReturnValueOnce([{ values: [[1, 5]] }]);

      await adapter.executeQuery("INSERT INTO t VALUES ('a')");
      expect(__mockRun).toHaveBeenCalledWith("INSERT INTO t VALUES ('a')");
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('PRAGMA treated as SELECT', async () => {
      const adapter = new SQLiteAdapter();
      await adapter.connect(makeConfig());

      __mockExec.mockReturnValueOnce([
        {
          columns: ['cid', 'name', 'type'],
          values: [[0, 'id', 'INTEGER']],
        },
      ]);

      const result = await adapter.executeQuery('PRAGMA table_info("users")');
      expect(result.rows).toEqual([{ cid: 0, name: 'id', type: 'INTEGER' }]);
      expect(__mockRun).not.toHaveBeenCalled();
    });
  });

  describe('cancelQuery', () => {
    it('is a no-op', async () => {
      const adapter = new SQLiteAdapter();
      await adapter.connect(makeConfig());
      await expect(adapter.cancelQuery()).resolves.toBeUndefined();
    });
  });

  describe('getSchema', () => {
    it('queries sqlite_master, excludes sqlite_ internal tables', async () => {
      const adapter = new SQLiteAdapter();
      await adapter.connect(makeConfig());

      __mockExec
        .mockReturnValueOnce([{ values: [['users'], ['orders']] }])
        .mockReturnValueOnce([{ values: [['v_active']] }]);

      const result = await adapter.getSchema();
      expect(result.tables).toHaveLength(2);
      expect(result.views).toHaveLength(1);
      expect(result.tables[0].name).toBe('users');
    });
  });

  describe('getColumns', () => {
    it('uses PRAGMA table_info', async () => {
      const adapter = new SQLiteAdapter();
      await adapter.connect(makeConfig());

      __mockExec.mockReturnValueOnce([
        {
          values: [
            [0, 'id', 'INTEGER', 1, null, 1],
            [1, 'name', 'TEXT', 0, null, 0],
          ],
        },
      ]);

      const columns = await adapter.getColumns('main', 'users');
      expect(columns[0]).toEqual({ name: 'id', type: 'INTEGER', nullable: false });
      expect(columns[1]).toEqual({ name: 'name', type: 'TEXT', nullable: true });
    });
  });

  describe('disconnect', () => {
    it('saves to file then closes', async () => {
      const adapter = new SQLiteAdapter();
      await adapter.connect(makeConfig());

      await adapter.disconnect();
      expect(__mockExport).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(__mockClose).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('creates temporary DB and tests SELECT 1', async () => {
      mockExistsSync.mockReturnValue(false);
      const adapter = new SQLiteAdapter();
      const result = await adapter.testConnection(makeConfig());
      expect(result.success).toBe(true);
    });
  });
});
