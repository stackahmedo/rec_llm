import { ipcMain } from 'electron';
import { getAllApiKeys, setAllApiKeys } from './credential-store';
import { settingsKeySchema, validateSchema } from './shared/schemas';

interface SettingsStore {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  delete: (key: string) => void;
}

let store: SettingsStore | null = null;

async function getStore(): Promise<SettingsStore> {
  if (!store) {
    const { default: Store } = await import('electron-store');
    store = new Store({ name: 'recllm-settings' }) as unknown as SettingsStore;
  }
  return store;
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, key: unknown) => {
    const v = validateSchema(settingsKeySchema, key);
    if (!v.ok) return null;
    if (v.data === 'apiKeys') {
      return getAllApiKeys();
    }
    const s = await getStore();
    return s.get(v.data) ?? null;
  });

  ipcMain.handle('settings:set', async (_event, key: unknown, value: unknown) => {
    const v = validateSchema(settingsKeySchema, key);
    if (!v.ok) return false;
    if (v.data === 'apiKeys' && value && typeof value === 'object') {
      setAllApiKeys(value as Record<string, string>);
      return true;
    }
    const s = await getStore();
    s.set(v.data, value);
    return true;
  });

  ipcMain.handle('settings:delete', async (_event, key: unknown) => {
    const v = validateSchema(settingsKeySchema, key);
    if (!v.ok) return false;
    const s = await getStore();
    s.delete(v.data);
    return true;
  });
}
