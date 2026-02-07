import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionConfig } from '../../../shared/types';

const { __mockLogin, __mockLogout, __mockQuery, __mockDescribeGlobal, __mockDescribe } = vi.hoisted(() => ({
  __mockLogin: vi.fn(),
  __mockLogout: vi.fn(),
  __mockQuery: vi.fn(),
  __mockDescribeGlobal: vi.fn(),
  __mockDescribe: vi.fn(),
}));

vi.mock('jsforce', () => ({
  Connection: class MockConnection {
    login = __mockLogin;
    logout = __mockLogout;
    query = __mockQuery;
    describeGlobal = __mockDescribeGlobal;
    sobject = vi.fn(() => ({
      describe: __mockDescribe,
    }));
  },
}));

import { SalesforceAdapter } from '../salesforce';

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'sf-1',
    name: 'SF Test',
    type: 'salesforce',
    host: '',
    port: 0,
    database: '',
    username: 'user@test.com',
    password: 'pass123',
    securityToken: 'TOKEN',
    ...overrides,
  };
}

describe('SalesforceAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: login succeeds
    __mockLogin.mockImplementation((_user: string, _pass: string, cb: (err: any, info: any) => void) => {
      cb(null, { id: 'user-id' });
    });
  });

  describe('connect', () => {
    it('appends security token to password', async () => {
      const adapter = new SalesforceAdapter();
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(true);
      expect(__mockLogin).toHaveBeenCalledWith(
        'user@test.com',
        'pass123TOKEN',
        expect.any(Function)
      );
    });

    it('handles login failure', async () => {
      __mockLogin.mockImplementationOnce((_u: string, _p: string, cb: (err: any) => void) => {
        cb(new Error('INVALID_LOGIN'));
      });

      const adapter = new SalesforceAdapter();
      const result = await adapter.connect(makeConfig());
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_LOGIN');
    });
  });

  describe('disconnect', () => {
    it('calls logout', async () => {
      const adapter = new SalesforceAdapter();
      await adapter.connect(makeConfig());
      __mockLogout.mockImplementation((cb: (err: any) => void) => cb(null));
      await adapter.disconnect();
      expect(__mockLogout).toHaveBeenCalled();
    });
  });

  describe('executeQuery', () => {
    it('returns error when not connected', async () => {
      const adapter = new SalesforceAdapter();
      const result = await adapter.executeQuery('SELECT Id FROM Account');
      expect(result.error).toBe('Not connected');
    });

    it('strips attributes metadata from records', async () => {
      const adapter = new SalesforceAdapter();
      await adapter.connect(makeConfig());

      __mockQuery.mockImplementation((_soql: string, cb: (err: any, result: any) => void) => {
        cb(null, {
          totalSize: 2,
          records: [
            { attributes: { type: 'Account', url: '/a' }, Id: '001', Name: 'Acme' },
            { attributes: { type: 'Account', url: '/b' }, Id: '002', Name: 'Beta' },
          ],
        });
      });

      const result = await adapter.executeQuery('SELECT Id, Name FROM Account');
      expect(result.rows).toEqual([
        { Id: '001', Name: 'Acme' },
        { Id: '002', Name: 'Beta' },
      ]);
      expect(result.rows[0]).not.toHaveProperty('attributes');
    });

    it('infers column types from first row', async () => {
      const adapter = new SalesforceAdapter();
      await adapter.connect(makeConfig());

      __mockQuery.mockImplementation((_soql: string, cb: (err: any, result: any) => void) => {
        cb(null, {
          totalSize: 1,
          records: [
            { attributes: { type: 'Opp' }, Amount: 100, Name: 'Deal' },
          ],
        });
      });

      const result = await adapter.executeQuery('SELECT Amount, Name FROM Opportunity');
      expect(result.columns.find((c: any) => c.name === 'Amount')?.type).toBe('number');
      expect(result.columns.find((c: any) => c.name === 'Name')?.type).toBe('string');
    });
  });

  describe('cancelQuery', () => {
    it('is a no-op', async () => {
      const adapter = new SalesforceAdapter();
      await adapter.connect(makeConfig());
      await expect(adapter.cancelQuery()).resolves.toBeUndefined();
    });
  });

  describe('getSchema', () => {
    it('returns synthetic sObjects schema', async () => {
      const adapter = new SalesforceAdapter();
      await adapter.connect(makeConfig());
      const result = await adapter.getSchema();
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].schema).toBe('sObjects');
    });
  });

  describe('getTablesInSchema', () => {
    it('filters to queryable sObjects', async () => {
      const adapter = new SalesforceAdapter();
      await adapter.connect(makeConfig());
      __mockDescribeGlobal.mockImplementation((cb: (err: any, result: any) => void) => {
        cb(null, {
          sobjects: [
            { name: 'Account', queryable: true },
            { name: 'CustomMeta__mdt', queryable: false },
            { name: 'Contact', queryable: true },
          ],
        });
      });

      const result = await adapter.getTablesInSchema('sObjects');
      expect(result.tables).toHaveLength(2);
      expect(result.tables.map((t: any) => t.name)).toEqual(['Account', 'Contact']);
    });
  });

  describe('getColumns', () => {
    it('maps nillable to nullable', async () => {
      const adapter = new SalesforceAdapter();
      await adapter.connect(makeConfig());
      __mockDescribe.mockImplementation((cb: (err: any, result: any) => void) => {
        cb(null, {
          fields: [
            { name: 'Id', type: 'id', nillable: false },
            { name: 'Email', type: 'email', nillable: true },
          ],
        });
      });

      const columns = await adapter.getColumns('sObjects', 'Contact');
      expect(columns[0]).toEqual({ name: 'Id', type: 'id', nullable: false });
      expect(columns[1]).toEqual({ name: 'Email', type: 'email', nullable: true });
    });
  });
});
