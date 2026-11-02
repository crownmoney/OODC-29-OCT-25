import { openDB, IDBPDatabase } from 'idb';
import { AppState } from '../types';

// Scenarios and folders are saved on this device only (IndexedDB).
// There is no cloud saving and no user accounts.

const DB_NAME = 'OutOfDebtDB';
const STORE_SCENARIOS = 'scenarios';
const STORE_FOLDERS = 'folders';

export interface Scenario {
  id: string;
  name: string;
  data: AppState;
  tags: string[];
  folderId: string | null;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  ownerUid?: string;
  sharedWith?: string[];
  isFavorite?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  ownerUid?: string;
  createdAt: string;
}

class StorageService {
  private idb: Promise<IDBPDatabase>;

  constructor() {
    this.idb = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_SCENARIOS, { keyPath: 'id' });
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
      },
    });
  }

  // --- Scenarios ---

  async saveScenario(scenario: Scenario) {
    const db = await this.idb;
    await db.put(STORE_SCENARIOS, { ...scenario, updatedAt: new Date().toISOString() });
  }

  async getScenarios(): Promise<Scenario[]> {
    const db = await this.idb;
    return db.getAll(STORE_SCENARIOS);
  }

  async deleteScenario(id: string, permanent = false) {
    const db = await this.idb;
    if (permanent) {
      await db.delete(STORE_SCENARIOS, id);
      return;
    }
    const scenario = await db.get(STORE_SCENARIOS, id);
    if (scenario) {
      scenario.isDeleted = true;
      scenario.deletedAt = new Date().toISOString();
      await db.put(STORE_SCENARIOS, scenario);
    }
  }

  async restoreScenario(id: string) {
    const db = await this.idb;
    const scenario = await db.get(STORE_SCENARIOS, id);
    if (scenario) {
      scenario.isDeleted = false;
      scenario.deletedAt = undefined;
      await db.put(STORE_SCENARIOS, scenario);
    }
  }

  // --- Folders ---

  async saveFolder(folder: Folder) {
    const db = await this.idb;
    await db.put(STORE_FOLDERS, folder);
  }

  async getFolders(): Promise<Folder[]> {
    const db = await this.idb;
    return db.getAll(STORE_FOLDERS);
  }

  async deleteFolder(id: string) {
    const db = await this.idb;
    await db.delete(STORE_FOLDERS, id);
  }
}

export const storageService = new StorageService();
