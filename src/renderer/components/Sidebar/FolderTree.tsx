import { useState } from 'react';
import { useQueryStore } from '../../stores/queryStore';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import type { Folder, QueryFile } from '../../../shared/types';

export default function FolderTree() {
  const { folders, queries, createFolder } = useQueryStore();
  const { addToast } = useUIStore();
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const rootFolders = folders.filter((f) => f.parentId === null);

  const handleCreateRootFolder = async () => {
    if (!newFolderName.trim()) {
      setIsCreatingRoot(false);
      return;
    }
    try {
      await createFolder(newFolderName.trim(), null);
      setNewFolderName('');
      setIsCreatingRoot(false);
      addToast({ type: 'success', message: 'Folder created' });
    } catch {
      addToast({ type: 'error', message: 'Failed to create folder' });
    }
  };

  return (
    <div className="px-2 py-1">
      {/* Add folder button */}
      <button
        onClick={() => setIsCreatingRoot(true)}
        className="w-full flex items-center justify-center gap-2 px-2 py-2 mb-2 text-sm font-medium text-pastel-accent-purple-text bg-pastel-accent-purple hover:bg-pastel-accent-purple-hover rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Folder
      </button>

      {/* New folder input */}
      {isCreatingRoot && (
        <div className="flex items-center gap-1 mb-2 pl-1">
          <svg className="w-4 h-4 text-pastel-accent-yellow-text" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={handleCreateRootFolder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateRootFolder();
              if (e.key === 'Escape') {
                setIsCreatingRoot(false);
                setNewFolderName('');
              }
            }}
            placeholder="Folder name"
            className="flex-1 text-sm bg-white border border-pastel-border-medium rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pastel-accent-blue"
            autoFocus
          />
        </div>
      )}

      {rootFolders.length === 0 && !isCreatingRoot ? (
        <p className="text-xs text-pastel-text-muted text-center py-2">
          No folders yet
        </p>
      ) : (
        rootFolders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            folders={folders}
            queries={queries}
            level={0}
          />
        ))
      )}
    </div>
  );
}

interface FolderItemProps {
  folder: Folder;
  folders: Folder[];
  queries: QueryFile[];
  level: number;
}

function FolderItem({ folder, folders, queries, level }: FolderItemProps) {
  const { toggleFolderExpanded, createQuery, deleteFolder, updateFolder, createFolder } = useQueryStore();
  const { addToast } = useUIStore();
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');

  const childFolders = folders.filter((f) => f.parentId === folder.id);
  const childQueries = queries.filter((q) => q.folderId === folder.id);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleNewQuery = async () => {
    closeContextMenu();
    try {
      const query = await createQuery('New Query', folder.id);
      useEditorStore.getState().createTab({
        queryFileId: query.id,
        name: query.name,
        content: query.content,
      });
    } catch {
      addToast({ type: 'error', message: 'Failed to create query' });
    }
  };

  const handleNewFolder = () => {
    closeContextMenu();
    setIsCreatingSubfolder(true);
    if (!folder.expanded) {
      toggleFolderExpanded(folder.id);
    }
  };

  const handleCreateSubfolder = async () => {
    if (!newSubfolderName.trim()) {
      setIsCreatingSubfolder(false);
      return;
    }
    try {
      await createFolder(newSubfolderName.trim(), folder.id);
      setNewSubfolderName('');
      setIsCreatingSubfolder(false);
      addToast({ type: 'success', message: 'Folder created' });
    } catch {
      addToast({ type: 'error', message: 'Failed to create folder' });
    }
  };

  const handleRename = () => {
    closeContextMenu();
    setIsRenaming(true);
    setNewName(folder.name);
  };

  const submitRename = async () => {
    if (newName.trim() && newName !== folder.name) {
      await updateFolder({ ...folder, name: newName.trim() });
      addToast({ type: 'success', message: 'Folder renamed' });
    }
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    closeContextMenu();
    if (confirm(`Delete folder "${folder.name}" and all its contents?`)) {
      await deleteFolder(folder.id);
      addToast({ type: 'success', message: 'Folder deleted' });
    }
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1 py-1 rounded-md hover:bg-pastel-bg-hover cursor-pointer"
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => toggleFolderExpanded(folder.id)}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleRename();
        }}
      >
        {/* Expand/collapse icon */}
        <svg
          className={`w-3.5 h-3.5 text-pastel-text-muted transition-transform ${
            folder.expanded ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Folder icon */}
        <svg
          className={`w-4 h-4 ${folder.expanded ? 'text-pastel-accent-yellow-text' : 'text-pastel-text-muted'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          {folder.expanded ? (
            <path
              fillRule="evenodd"
              d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H2V6z"
              clipRule="evenodd"
            />
          ) : (
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          )}
          {folder.expanded && <path d="M2 9h16v5a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" />}
        </svg>

        {/* Folder name */}
        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm bg-white border border-pastel-border-medium rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-pastel-accent-blue"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm text-pastel-text-primary truncate">
            {folder.name}
          </span>
        )}

        {/* Add button */}
        {isHovered && !isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNewQuery();
            }}
            className="p-0.5 rounded hover:bg-pastel-bg-active text-pastel-text-muted hover:text-pastel-text-primary"
            title="New Query"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={[
            { label: 'New Query', onClick: handleNewQuery },
            { label: 'New Subfolder', onClick: handleNewFolder },
            { label: 'Rename', onClick: handleRename },
            { label: 'Delete', onClick: handleDelete, danger: true },
          ]}
        />
      )}

      {/* Children */}
      {folder.expanded && (
        <>
          {/* New subfolder input */}
          {isCreatingSubfolder && (
            <div
              className="flex items-center gap-1 py-1"
              style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }}
            >
              <svg className="w-4 h-4 text-pastel-accent-yellow-text" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <input
                type="text"
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                onBlur={handleCreateSubfolder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubfolder();
                  if (e.key === 'Escape') {
                    setIsCreatingSubfolder(false);
                    setNewSubfolderName('');
                  }
                }}
                placeholder="Folder name"
                className="flex-1 text-sm bg-white border border-pastel-border-medium rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-pastel-accent-blue"
                autoFocus
              />
            </div>
          )}

          {childFolders.map((childFolder) => (
            <FolderItem
              key={childFolder.id}
              folder={childFolder}
              folders={folders}
              queries={queries}
              level={level + 1}
            />
          ))}
          {childQueries.map((query) => (
            <QueryItem key={query.id} query={query} level={level + 1} />
          ))}
        </>
      )}
    </div>
  );
}

interface QueryItemProps {
  query: QueryFile;
  level: number;
}

function QueryItem({ query, level }: QueryItemProps) {
  const { deleteQuery, updateQuery } = useQueryStore();
  const { tabs, createTab, setActiveTab } = useEditorStore();
  const { addToast } = useUIStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(query.name);

  const handleClick = () => {
    const existingTab = tabs.find((t) => t.queryFileId === query.id);
    if (existingTab) {
      setActiveTab(existingTab.id);
    } else {
      createTab({
        queryFileId: query.id,
        name: query.name,
        content: query.content,
        connectionId: query.connectionId,
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleDelete = async () => {
    closeContextMenu();
    if (confirm(`Delete query "${query.name}"?`)) {
      await deleteQuery(query.id);
      addToast({ type: 'success', message: 'Query deleted' });
    }
  };

  const handleRename = () => {
    closeContextMenu();
    setIsRenaming(true);
    setNewName(query.name);
  };

  const submitRename = async () => {
    if (newName.trim() && newName !== query.name) {
      await updateQuery({ ...query, name: newName.trim() });
      addToast({ type: 'success', message: 'Query renamed' });
    }
    setIsRenaming(false);
  };

  return (
    <div
      className="group flex items-center gap-2 py-1 rounded-md hover:bg-pastel-bg-hover cursor-pointer"
      style={{ paddingLeft: `${level * 12 + 20}px` }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleRename();
      }}
    >
      {/* File icon */}
      <svg className="w-4 h-4 text-pastel-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>

      {/* Query name */}
      {isRenaming ? (
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRename();
            if (e.key === 'Escape') setIsRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-sm bg-white border border-pastel-border-medium rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-pastel-accent-blue"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm text-pastel-text-primary truncate">{query.name}</span>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={[
            { label: 'Rename', onClick: handleRename },
            { label: 'Delete', onClick: handleDelete, danger: true },
          ]}
        />
      )}
    </div>
  );
}

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

function ContextMenu({ x, y, onClose, items }: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-white rounded-lg shadow-soft-lg border border-pastel-border-light py-1 min-w-[140px]"
        style={{ left: x, top: y }}
      >
        {items.map((item, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
            }}
            className={`
              w-full px-3 py-1.5 text-sm text-left
              ${item.danger ? 'text-pastel-status-error-text hover:bg-pastel-status-error' : 'text-pastel-text-primary hover:bg-pastel-bg-hover'}
            `}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
