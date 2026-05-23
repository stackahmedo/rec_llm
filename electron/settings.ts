import { ipcMain } from 'electron';
import { getAllApiKeys, setAllApiKeys } from './credential-store';

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
    // API keys are stored in secure credential store, not electron-store
    if (key === 'apiKeys') {
      const keys = getAllApiKeys();
      const summary = Object.entries(keys).map(([k, v]) => `${k}: ${v ? `${v.length} chars` : 'empty'}`).join(', ');
      console.log(`[settings:get] apiKeys → ${summary}`);
      return keys;
    }
    const s = await getStore();
    const value = s.get(key) ?? null;
    console.log(`[settings:get] ${key} → ${value !== null ? 'exists' : 'null'}`);
    return value;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    // API keys go to secure credential store
    if (key === 'apiKeys' && value && typeof value === 'object') {
      setAllApiKeys(value as Record<string, string>);
      const keys = value as Record<string, string>;
      const summary = Object.entries(keys).map(([k, v]) => `${k}: ${v ? `${v.length} chars` : 'empty'}`).join(', ');
      console.log(`[settings:set] apiKeys saved securely → ${summary}`);
      return true;
    }
    const s = await getStore();
    s.set(key, value);
    console.log(`[settings:set] ${key} saved`);
    return true;
  });

  ipcMain.handle('settings:delete', async (_event, key: string) => {
    const s = await getStore();
    s.delete(key);
    console.log(`[settings:delete] ${key} removed`);
    return true;
  });
}
