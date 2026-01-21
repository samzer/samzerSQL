import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Folder, QueryFile } from '../../shared/types';

interface QueryState {
  folders: Folder[];
  queries: QueryFile[];

  // Actions
  loadFolders: () => Promise<void>;
  loadQueries: () => Promise<void>;
  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  updateFolder: (folder: Folder) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolderExpanded: (id: string) => void;
  createQuery: (name: string, folderId: string, content?: string) => Promise<QueryFile>;
  updateQuery: (query: QueryFile) => Promise<void>;
  deleteQuery: (id: string) => Promise<void>;
  getQueryById: (id: string) => QueryFile | undefined;
  getFolderById: (id: string) => Folder | undefined;
}

export const useQueryStore = create<QueryState>((set, get) => ({
  folders: [],
  queries: [],

  loadFolders: async () => {
    try {
      const folders = await window.electron.storage.getFolders();
      set({ folders });
    } catch (error) {
      console.error('Failed to load folders:', error);
      // Create default root folder if none exist
      set({
        folders: [
          {
            id: 'root',
            name: 'Queries',
            parentId: null,
            expanded: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }
  },

  loadQueries: async () => {
    try {
      const queries = await window.electron.storage.getQueries();
      set({ queries });
    } catch (error) {
      console.error('Failed to load queries:', error);
    }
  },

  createFolder: async (name, parentId) => {
    const folder: Folder = {
      id: uuidv4(),
      name,
      parentId,
      expanded: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await window.electron.storage.saveFolder(folder);
      set((state) => ({ folders: [...state.folders, folder] }));
      return folder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  },

  updateFolder: async (folder) => {
    try {
      await window.electron.storage.saveFolder(folder);
      set((state) => ({
        folders: state.folders.map((f) => (f.id === folder.id ? folder : f)),
      }));
    } catch (error) {
      console.error('Failed to update folder:', error);
    }
  },

  deleteFolder: async (id) => {
    try {
      await window.electron.storage.deleteFolder(id);
      set((state) => ({
        folders: state.folders.filter((f) => f.id !== id),
        queries: state.queries.filter((q) => q.folderId !== id),
      }));
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  },

  toggleFolderExpanded: (id) => {
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === id ? { ...f, expanded: !f.expanded } : f
      ),
    }));

    // Persist the expanded state
    const folder = get().folders.find((f) => f.id === id);
    if (folder) {
      window.electron.storage.saveFolder(folder).catch(console.error);
    }
  },

  createQuery: async (name, folderId, content = '') => {
    const query: QueryFile = {
      id: uuidv4(),
      name,
      content,
      folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await window.electron.storage.saveQuery(query);
      set((state) => ({ queries: [...state.queries, query] }));
      return query;
    } catch (error) {
      console.error('Failed to create query:', error);
      throw error;
    }
  },

  updateQuery: async (query) => {
    const updatedQuery = {
      ...query,
      updatedAt: new Date().toISOString(),
    };

    try {
      await window.electron.storage.saveQuery(updatedQuery);
      set((state) => ({
        queries: state.queries.map((q) => (q.id === query.id ? updatedQuery : q)),
      }));
    } catch (error) {
      console.error('Failed to update query:', error);
    }
  },

  deleteQuery: async (id) => {
    try {
      await window.electron.storage.deleteQuery(id);
      set((state) => ({
        queries: state.queries.filter((q) => q.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete query:', error);
    }
  },

  getQueryById: (id) => {
    return get().queries.find((q) => q.id === id);
  },

  getFolderById: (id) => {
    return get().folders.find((f) => f.id === id);
  },
}));
