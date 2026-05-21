import { ipcMain, net } from 'electron';

async function getApiKey(): Promise<string | null> {
  let store: any = null;
  const { default: Store } = await import('electron-store');
  store = new Store({ name: 'recllm-settings', encryptionKey: 'recllm-local-encryption-key' });
  const keys = store.get('apiKeys') as Record<string, string> | undefined;
  return keys?.assemblyai || null;
}

export function registerAssemblyAIHandlers(): void {
  ipcMain.handle('assemblyai:validateKey', async (): Promise<{ ok: boolean; error?: string }> => {
    const apiKey = await getApiKey();
    if (!apiKey || apiKey.length < 10) {
      return { ok: false, error: 'No API key saved. Enter your key and save settings first.' };
    }

    try {
      const response = await net.fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
        },
      });

      if (response.status === 200) {
        return { ok: true };
      } else if (response.status === 401) {
        return { ok: false, error: 'Invalid API key. Check that you pasted the correct token.' };
      } else {
        return { ok: false, error: `Unexpected response (${response.status}). Try again later.` };
      }
    } catch (err: any) {
      return { ok: false, error: `Network error: ${err.message || 'Could not reach AssemblyAI.'}` };
    }
  });
}
