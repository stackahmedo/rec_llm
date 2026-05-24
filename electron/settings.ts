import { ipcMain } from 'electron';
import { getAllApiKeys, setAllApiKeys } from './credential-store';
import { validateSettingsKey } from './ipc-validation';

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
  ipcMain.handle('settings:get', async (_event, key: string) => {
    try {
      validateSettingsKey(key);
    } catch {
      return null;
    }
    // API keys are stored in secure credential store, not electron-store
    if (key === 'apiKeys') {
      return getAllApiKeys();
    }
    const s = await getStore();
    return s.get(key) ?? null;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    try {
      validateSettingsKey(key);
    } catch {
      return false;
    }
    // API keys go to secure credential store
    if (key === 'apiKeys' && value && typeof value === 'object') {
      setAllApiKeys(value as Record<string, string>);
      return true;
    }
    const s = await getStore();
    s.set(key, value);
    return true;
  });

  ipcMain.handle('settings:delete', async (_event, key: string) => {
    try {
      validateSettingsKey(key);
    } catch {
      return false;
    }
    const s = await getStore();
    s.delete(key);
    return true;
  });
}
