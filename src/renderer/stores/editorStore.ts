import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { EditorTab, QueryResult, QueryHistoryEntry } from '../../shared/types';

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  history: QueryHistoryEntry[];

  // Actions
  loadHistory: () => Promise<void>;
  createTab: (options?: { queryFileId?: string; name?: string; content?: string; connectionId?: string }) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  updateTabConnection: (id: string, connectionId: string | undefined) => void;
  setTabDirty: (id: string, isDirty: boolean) => void;
  setTabExecuting: (id: string, isExecuting: boolean) => void;
  updateTabName: (queryFileId: string, name: string) => void;
  setTabResult: (id: string, result: QueryResult | undefined) => void;
  executeQuery: (tabId: string, query: string, connectionId: string, connectionName: string) => Promise<QueryResult>;
  cancelQuery: (tabId: string, connectionId: string) => Promise<void>;
  addHistoryEntry: (entry: QueryHistoryEntry) => void;
  clearHistory: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [
    {
      id: 'default',
      name: 'Query 1',
      content: '-- Write your SQL query here\nSELECT 1;',
      isDirty: false,
      isExecuting: false,
    },
  ],
  activeTabId: 'default',
  history: [],

  loadHistory: async () => {
    try {
      const history = await window.electron.storage.getHistory();
      set({ history });
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  },

  createTab: (options = {}) => {
    const id = uuidv4();
    const { tabs } = get();
    const tabNumber = tabs.length + 1;

    const newTab: EditorTab = {
      id,
      queryFileId: options.queryFileId,
      name: options.name || `Query ${tabNumber}`,
      content: options.content || '',
      connectionId: options.connectionId,
      isDirty: false,
      isExecuting: false,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));

    return id;
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();

    if (tabs.length === 1) {
      // Don't close the last tab, just clear it
      set((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === id
            ? {
                ...tab,
                queryFileId: undefined,
                name: 'Query 1',
                content: '',
                isDirty: false,
                result: undefined,
              }
            : tab
        ),
      }));
      return;
    }

    const tabIndex = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);

    let newActiveId = activeTabId;
    if (activeTabId === id) {
      // Select the previous tab, or the next one if closing the first
      const newIndex = Math.max(0, tabIndex - 1);
      newActiveId = newTabs[newIndex]?.id || null;
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
    });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  updateTabContent: (id, content) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, content, isDirty: true } : tab
      ),
    }));
  },

  updateTabConnection: (id, connectionId) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, connectionId } : tab
      ),
    }));
  },

  setTabDirty: (id, isDirty) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, isDirty } : tab
      ),
    }));
  },

  setTabExecuting: (id, isExecuting) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, isExecuting } : tab
      ),
    }));
  },

  updateTabName: (queryFileId, name) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.queryFileId === queryFileId ? { ...tab, name } : tab
      ),
    }));
  },

  setTabResult: (id, result) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, result } : tab
      ),
    }));
  },

  executeQuery: async (tabId, query, connectionId, connectionName) => {
    const { setTabExecuting, setTabResult, addHistoryEntry } = get();

    setTabExecuting(tabId, true);
    setTabResult(tabId, undefined);

    try {
      const result = await window.electron.db.executeQuery(connectionId, query);

      setTabResult(tabId, result);

      // Add to history
      const historyEntry: QueryHistoryEntry = {
        id: uuidv4(),
        query,
        connectionId,
        connectionName,
        executedAt: new Date().toISOString(),
        executionTime: result.executionTime,
        rowCount: result.rowCount,
        error: result.error,
      };

      addHistoryEntry(historyEntry);

      return result;
    } finally {
      setTabExecuting(tabId, false);
    }
  },

  cancelQuery: async (tabId, connectionId) => {
    try {
      await window.electron.db.cancelQuery(connectionId);
      get().setTabExecuting(tabId, false);
    } catch (error) {
      console.error('Failed to cancel query:', error);
    }
  },

  addHistoryEntry: (entry) => {
    window.electron.storage.addHistory(entry).catch(console.error);
    set((state) => ({
      history: [entry, ...state.history].slice(0, 1000),
    }));
  },

  clearHistory: async () => {
    try {
      await window.electron.storage.clearHistory();
      set({ history: [] });
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  },
}));
