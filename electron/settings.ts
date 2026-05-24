import { ipcMain } from 'electron';
import { getAllApiKeys, setAllApiKeys } from './credential-store';
import { settingsKeySchema, validateSchema } from './shared/schemas';

let store: any = null;

async function getStore() {
  if (!store) {
    const { default: Store } = await import('electron-store');
    store = new Store({
      name: 'recllm-settings',
    });
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
