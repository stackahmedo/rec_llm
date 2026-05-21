import { ipcMain } from 'electron';

let store: any = null;

async function getStore() {
  if (!store) {
    const { default: Store } = await import('electron-store');
    store = new Store({
      name: 'recllm-settings',
      encryptionKey: 'recllm-local-encryption-key',
    });
  }
  return store;
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, key: string) => {
    const s = await getStore();
    const value = s.get(key) ?? null;
    // Safe debug: log key name and whether value exists, never log actual secrets
    if (key === 'apiKeys' && value) {
      const keys = value as Record<string, string>;
      const summary = Object.entries(keys).map(([k, v]) => `${k}: ${v ? `${v.length} chars` : 'empty'}`).join(', ');
      console.log(`[settings:get] apiKeys → ${summary}`);
    } else {
      console.log(`[settings:get] ${key} → ${value !== null ? 'exists' : 'null'}`);
    }
    return value;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    const s = await getStore();
    s.set(key, value);
    // Safe debug: confirm write without logging secrets
    if (key === 'apiKeys' && value && typeof value === 'object') {
      const keys = value as Record<string, string>;
      const summary = Object.entries(keys).map(([k, v]) => `${k}: ${v ? `${v.length} chars` : 'empty'}`).join(', ');
      console.log(`[settings:set] apiKeys saved → ${summary}`);
    } else {
      console.log(`[settings:set] ${key} saved`);
    }
    return true;
  });

  ipcMain.handle('settings:delete', async (_event, key: string) => {
    const s = await getStore();
    s.delete(key);
    console.log(`[settings:delete] ${key} removed`);
    return true;
  });
}
