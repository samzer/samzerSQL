import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExistsSync, mockReadFileSync, mockWriteFileSync, mockMkdirSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/fake/userData'),
  },
}));

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
}));

vi.mock('path', () => ({
  join: (...parts: string[]) => parts.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
}));

import { QueryStorage } from '../query-storage';

describe('QueryStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe('constructor / loadData', () => {
    it('returns defaults when file does not exist', () => {
      const storage = new QueryStorage();
      expect(storage.getConnections()).toEqual([]);
      expect(storage.getFolders()).toHaveLength(1);
      expect(storage.getFolders()[0].id).toBe('root');
      expect(storage.getQueries()).toEqual([]);
      expect(storage.getHistory()).toEqual([]);
    });

    it('loads existing data from file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          connections: [{ id: 'c1', name: 'Test' }],
          folders: [{ id: 'root', name: 'Queries', parentId: null }],
          queries: [],
          history: [],
        })
      );

      const storage = new QueryStorage();
      expect(storage.getConnections()).toHaveLength(1);
      expect(storage.getConnections()[0].id).toBe('c1');
    });
  });

  describe('connection CRUD', () => {
    it('saveConnection adds new connection', () => {
      const storage = new QueryStorage();
      storage.saveConnection({ id: 'c1', name: 'PG' } as any);
      expect(storage.getConnections()).toHaveLength(1);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('saveConnection updates existing connection', () => {
      const storage = new QueryStorage();
      storage.saveConnection({ id: 'c1', name: 'PG' } as any);
      storage.saveConnection({ id: 'c1', name: 'PG Updated' } as any);
      expect(storage.getConnections()).toHaveLength(1);
      expect(storage.getConnections()[0].name).toBe('PG Updated');
    });

    it('deleteConnection removes connection', () => {
      const storage = new QueryStorage();
      storage.saveConnection({ id: 'c1', name: 'PG' } as any);
      storage.deleteConnection('c1');
      expect(storage.getConnections()).toHaveLength(0);
    });
  });

  describe('folder CRUD', () => {
    it('saveFolder adds new folder', () => {
      const storage = new QueryStorage();
      storage.saveFolder({ id: 'f1', name: 'My Folder', parentId: 'root', expanded: true, createdAt: '' });
      expect(storage.getFolders()).toHaveLength(2); // root + f1
    });

    it('deleteFolder cascades to subfolders and their queries', () => {
      const storage = new QueryStorage();
      // Create folder hierarchy: root -> parent -> child
      storage.saveFolder({ id: 'parent', name: 'Parent', parentId: 'root', expanded: true, createdAt: '' });
      storage.saveFolder({ id: 'child', name: 'Child', parentId: 'parent', expanded: true, createdAt: '' });

      // Add queries to the folders
      storage.saveQuery({ id: 'q1', name: 'Q1', content: '', folderId: 'parent', createdAt: '', updatedAt: '' });
      storage.saveQuery({ id: 'q2', name: 'Q2', content: '', folderId: 'child', createdAt: '', updatedAt: '' });
      storage.saveQuery({ id: 'q3', name: 'Q3', content: '', folderId: 'root', createdAt: '', updatedAt: '' });

      storage.deleteFolder('parent');

      // parent and child folders should be gone
      const folderIds = storage.getFolders().map((f) => f.id);
      expect(folderIds).not.toContain('parent');
      expect(folderIds).not.toContain('child');
      expect(folderIds).toContain('root');

      // queries in parent and child should be gone, root query stays
      const queryIds = storage.getQueries().map((q) => q.id);
      expect(queryIds).not.toContain('q1');
      expect(queryIds).not.toContain('q2');
      expect(queryIds).toContain('q3');
    });
  });

  describe('query CRUD', () => {
    it('saveQuery adds and updates', () => {
      const storage = new QueryStorage();
      storage.saveQuery({ id: 'q1', name: 'Q1', content: 'SELECT 1', folderId: 'root', createdAt: '', updatedAt: '' });
      expect(storage.getQueries()).toHaveLength(1);

      storage.saveQuery({ id: 'q1', name: 'Q1 Updated', content: 'SELECT 2', folderId: 'root', createdAt: '', updatedAt: '' });
      expect(storage.getQueries()).toHaveLength(1);
      expect(storage.getQueries()[0].name).toBe('Q1 Updated');
    });

    it('deleteQuery removes query', () => {
      const storage = new QueryStorage();
      storage.saveQuery({ id: 'q1', name: 'Q1', content: '', folderId: 'root', createdAt: '', updatedAt: '' });
      storage.deleteQuery('q1');
      expect(storage.getQueries()).toHaveLength(0);
    });
  });

  describe('history', () => {
    it('addHistory adds entries and getHistory returns reversed', () => {
      const storage = new QueryStorage();
      storage.addHistory({ id: 'h1', query: 'SELECT 1', connectionId: 'c1', connectionName: 'PG', executedAt: '', executionTime: 10, rowCount: 1 });
      storage.addHistory({ id: 'h2', query: 'SELECT 2', connectionId: 'c1', connectionName: 'PG', executedAt: '', executionTime: 5, rowCount: 1 });

      const history = storage.getHistory();
      expect(history).toHaveLength(2);
      // Most recent first
      expect(history[0].id).toBe('h2');
      expect(history[1].id).toBe('h1');
    });

    it('caps at 1000 entries', () => {
      const storage = new QueryStorage();
      for (let i = 0; i < 1005; i++) {
        storage.addHistory({
          id: `h${i}`,
          query: `SELECT ${i}`,
          connectionId: 'c1',
          connectionName: 'PG',
          executedAt: '',
          executionTime: 1,
          rowCount: 0,
        });
      }

      // Internal storage should be capped at 1000
      const history = storage.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('clearHistory empties history', () => {
      const storage = new QueryStorage();
      storage.addHistory({ id: 'h1', query: 'SELECT 1', connectionId: 'c1', connectionName: 'PG', executedAt: '', executionTime: 10, rowCount: 1 });
      storage.clearHistory();
      expect(storage.getHistory()).toHaveLength(0);
    });
  });
});
