import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectionConfig, Folder, QueryFile, QueryHistoryEntry } from '../../shared/types';

interface StorageData {
  connections: ConnectionConfig[];
  folders: Folder[];
  queries: QueryFile[];
  history: QueryHistoryEntry[];
}

export class QueryStorage {
  private storagePath: string;
  private data: StorageData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.storagePath = path.join(userDataPath, 'sql-client-data.json');
    this.data = this.loadData();
  }

  private loadData(): StorageData {
    try {
      if (fs.existsSync(this.storagePath)) {
        const content = fs.readFileSync(this.storagePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading storage data:', error);
    }

    // Return default data with root folder
    return {
      connections: [],
      folders: [
        {
          id: 'root',
          name: 'Queries',
          parentId: null,
          expanded: true,
          createdAt: new Date().toISOString(),
        },
      ],
      queries: [],
      history: [],
    };
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving storage data:', error);
    }
  }

  // Connection methods
  getConnections(): ConnectionConfig[] {
    return this.data.connections;
  }

  saveConnection(config: ConnectionConfig): void {
    const index = this.data.connections.findIndex((c) => c.id === config.id);
    if (index >= 0) {
      this.data.connections[index] = config;
    } else {
      this.data.connections.push(config);
    }
    this.saveData();
  }

  deleteConnection(id: string): void {
    this.data.connections = this.data.connections.filter((c) => c.id !== id);
    this.saveData();
  }

  // Folder methods
  getFolders(): Folder[] {
    return this.data.folders;
  }

  saveFolder(folder: Folder): void {
    const index = this.data.folders.findIndex((f) => f.id === folder.id);
    if (index >= 0) {
      this.data.folders[index] = folder;
    } else {
      this.data.folders.push(folder);
    }
    this.saveData();
  }

  deleteFolder(id: string): void {
    // Also delete all queries in this folder and subfolders
    const folderIds = this.getAllSubfolderIds(id);
    folderIds.push(id);

    this.data.folders = this.data.folders.filter((f) => !folderIds.includes(f.id));
    this.data.queries = this.data.queries.filter((q) => !folderIds.includes(q.folderId));
    this.saveData();
  }

  private getAllSubfolderIds(parentId: string): string[] {
    const subfolders = this.data.folders.filter((f) => f.parentId === parentId);
    const ids: string[] = [];

    for (const subfolder of subfolders) {
      ids.push(subfolder.id);
      ids.push(...this.getAllSubfolderIds(subfolder.id));
    }

    return ids;
  }

  // Query methods
  getQueries(): QueryFile[] {
    return this.data.queries;
  }

  saveQuery(query: QueryFile): void {
    const index = this.data.queries.findIndex((q) => q.id === query.id);
    if (index >= 0) {
      this.data.queries[index] = query;
    } else {
      this.data.queries.push(query);
    }
    this.saveData();
  }

  deleteQuery(id: string): void {
    this.data.queries = this.data.queries.filter((q) => q.id !== id);
    this.saveData();
  }

  // History methods
  getHistory(): QueryHistoryEntry[] {
    return this.data.history.slice().reverse(); // Most recent first
  }

  addHistory(entry: QueryHistoryEntry): void {
    this.data.history.push(entry);
    // Keep only the last 1000 entries
    if (this.data.history.length > 1000) {
      this.data.history = this.data.history.slice(-1000);
    }
    this.saveData();
  }

  clearHistory(): void {
    this.data.history = [];
    this.saveData();
  }
}
