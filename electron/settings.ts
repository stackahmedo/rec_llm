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
    return s.get(key) ?? null;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    const s = await getStore();
    s.set(key, value);
    return true;
  });

  ipcMain.handle('settings:delete', async (_event, key: string) => {
    const s = await getStore();
    s.delete(key);
    return true;
  });
}
