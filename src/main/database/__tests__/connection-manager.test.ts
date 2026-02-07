import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockAdapter() {
  return {
    connect: vi.fn().mockResolvedValue({ success: true }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    executeQuery: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0, executionTime: 10 }),
    cancelQuery: vi.fn().mockResolvedValue(undefined),
    getSchema: vi.fn().mockResolvedValue({ tables: [], views: [] }),
    testConnection: vi.fn().mockResolvedValue({ success: true }),
    getTablesInSchema: vi.fn().mockResolvedValue({ tables: [], views: [] }),
    getColumns: vi.fn().mockResolvedValue([]),
  };
}

// Mock all adapter modules with classes
vi.mock('../postgres', () => {
  return { PostgresAdapter: class { constructor() { return createMockAdapter(); } } };
});
vi.mock('../mysql', () => {
  return { MySQLAdapter: class { constructor() { return createMockAdapter(); } } };
});
vi.mock('../snowflake', () => {
  return { SnowflakeAdapter: class { constructor() { return createMockAdapter(); } } };
});
vi.mock('../salesforce', () => {
  return { SalesforceAdapter: class { constructor() { return createMockAdapter(); } } };
});
vi.mock('../sqlite', () => {
  return { SQLiteAdapter: class { constructor() { return createMockAdapter(); } } };
});
vi.mock('../motherduck', () => {
  return { MotherDuckAdapter: class { constructor() { return createMockAdapter(); } } };
});

import { ConnectionManager } from '../connection-manager';
import { ConnectionConfig } from '../../../shared/types';

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'test-1',
    name: 'Test',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    username: 'user',
    password: 'pass',
    ...overrides,
  };
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ConnectionManager();
  });

  describe('createAdapter (via connect)', () => {
    it('creates correct adapter for each database type', async () => {
      for (const type of ['postgresql', 'mysql', 'snowflake', 'salesforce', 'sqlite', 'motherduck'] as const) {
        const m = new ConnectionManager();
        const result = await m.connect(makeConfig({ id: `${type}-1`, type }));
        expect(result.success).toBe(true);
      }
    });

    it('returns error for unsupported type', async () => {
      const result = await manager.connect(makeConfig({ type: 'oracle' as any }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported database type');
    });
  });

  describe('connect', () => {
    it('stores adapter on success', async () => {
      const result = await manager.connect(makeConfig());
      expect(result.success).toBe(true);
      expect(manager.isConnected('test-1')).toBe(true);
    });

    it('does not store adapter on failure', async () => {
      // Create a manager and connect with a config whose adapter will fail
      const m = new ConnectionManager();
      // We need to make connect fail. Since we're using the mock class that always succeeds,
      // we test the error path by using an unsupported type
      const result = await m.connect(makeConfig({ type: 'oracle' as any }));
      expect(result.success).toBe(false);
      expect(m.isConnected('test-1')).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('removes adapter from map', async () => {
      await manager.connect(makeConfig());
      expect(manager.isConnected('test-1')).toBe(true);
      await manager.disconnect('test-1');
      expect(manager.isConnected('test-1')).toBe(false);
    });

    it('handles disconnect of non-existent connection gracefully', async () => {
      await expect(manager.disconnect('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('disconnectAll', () => {
    it('disconnects all connections', async () => {
      await manager.connect(makeConfig({ id: 'c1' }));
      await manager.connect(makeConfig({ id: 'c2', type: 'mysql' }));
      expect(manager.isConnected('c1')).toBe(true);
      expect(manager.isConnected('c2')).toBe(true);
      await manager.disconnectAll();
      expect(manager.isConnected('c1')).toBe(false);
      expect(manager.isConnected('c2')).toBe(false);
    });
  });

  describe('executeQuery', () => {
    it('returns error when connection not found', async () => {
      const result = await manager.executeQuery('nonexistent', 'SELECT 1');
      expect(result.error).toBe('Connection not found');
    });

    it('delegates to adapter', async () => {
      await manager.connect(makeConfig());
      const result = await manager.executeQuery('test-1', 'SELECT 1');
      expect(result.executionTime).toBe(10);
    });
  });

  describe('cancelQuery', () => {
    it('does nothing when no active query', async () => {
      await manager.connect(makeConfig());
      await expect(manager.cancelQuery('test-1')).resolves.toBeUndefined();
    });
  });

  describe('getSchema', () => {
    it('returns empty defaults when not connected', async () => {
      const result = await manager.getSchema('nonexistent');
      expect(result).toEqual({ tables: [], views: [] });
    });

    it('delegates to adapter when connected', async () => {
      await manager.connect(makeConfig());
      const result = await manager.getSchema('test-1');
      expect(result).toEqual({ tables: [], views: [] });
    });
  });

  describe('getTablesInSchema', () => {
    it('returns empty defaults when not connected', async () => {
      const result = await manager.getTablesInSchema('nonexistent', 'public');
      expect(result).toEqual({ tables: [], views: [] });
    });
  });

  describe('getColumns', () => {
    it('returns empty array when not connected', async () => {
      const result = await manager.getColumns('nonexistent', 'public', 'users');
      expect(result).toEqual([]);
    });
  });

  describe('isConnected', () => {
    it('returns false for unknown id', () => {
      expect(manager.isConnected('nope')).toBe(false);
    });

    it('returns true after successful connect', async () => {
      await manager.connect(makeConfig());
      expect(manager.isConnected('test-1')).toBe(true);
    });
  });
});
