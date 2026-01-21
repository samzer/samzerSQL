import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface UIState {
  // Panel sizes
  sidebarWidth: number;
  resultsPanelHeight: number;

  // Modal states
  isConnectionModalOpen: boolean;
  editingConnectionId: string | null;
  isNewFolderModalOpen: boolean;
  newFolderParentId: string | null;
  isPasswordPromptOpen: boolean;
  passwordPromptConnectionId: string | null;

  // Toasts
  toasts: Toast[];

  // Results panel tab
  resultsTab: 'results' | 'messages' | 'history';

  // Actions
  setSidebarWidth: (width: number) => void;
  setResultsPanelHeight: (height: number) => void;
  openConnectionModal: (connectionId?: string) => void;
  closeConnectionModal: () => void;
  openNewFolderModal: (parentId: string | null) => void;
  closeNewFolderModal: () => void;
  openPasswordPrompt: (connectionId: string) => void;
  closePasswordPrompt: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setResultsTab: (tab: 'results' | 'messages' | 'history') => void;
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 240,
  resultsPanelHeight: 300,
  isConnectionModalOpen: false,
  editingConnectionId: null,
  isNewFolderModalOpen: false,
  newFolderParentId: null,
  isPasswordPromptOpen: false,
  passwordPromptConnectionId: null,
  toasts: [],
  resultsTab: 'results',

  setSidebarWidth: (width) => {
    set({ sidebarWidth: Math.max(180, Math.min(400, width)) });
  },

  setResultsPanelHeight: (height) => {
    set({ resultsPanelHeight: Math.max(150, Math.min(600, height)) });
  },

  openConnectionModal: (connectionId) => {
    set({
      isConnectionModalOpen: true,
      editingConnectionId: connectionId || null,
    });
  },

  closeConnectionModal: () => {
    set({
      isConnectionModalOpen: false,
      editingConnectionId: null,
    });
  },

  openNewFolderModal: (parentId) => {
    set({
      isNewFolderModalOpen: true,
      newFolderParentId: parentId,
    });
  },

  closeNewFolderModal: () => {
    set({
      isNewFolderModalOpen: false,
      newFolderParentId: null,
    });
  },

  openPasswordPrompt: (connectionId) => {
    set({
      isPasswordPromptOpen: true,
      passwordPromptConnectionId: connectionId,
    });
  },

  closePasswordPrompt: () => {
    set({
      isPasswordPromptOpen: false,
      passwordPromptConnectionId: null,
    });
  },

  addToast: (toast) => {
    const id = `toast-${++toastId}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-remove after duration
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setResultsTab: (tab) => {
    set({ resultsTab: tab });
  },
}));
