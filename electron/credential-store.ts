/**
 * Secure Credential Store
 *
 * Uses Electron's safeStorage API to encrypt/decrypt API keys via the OS keychain.
 * Falls back to obfuscated storage if safeStorage is unavailable.
 */

import { safeStorage, app } from 'electron';
import path from 'path';
import fs from 'fs';

const CREDENTIALS_FILE = 'credentials.enc.json';

function getCredentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

interface StoredCredentials {
  [key: string]: string; // key name -> base64-encoded encrypted value
}

function readCredentialsFile(): StoredCredentials {
  const filePath = getCredentialsPath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {}
  return {};
}

function writeCredentialsFile(data: StoredCredentials): void {
  const filePath = getCredentialsPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Encrypt and store a credential.
 */
export function setCredential(key: string, value: string): void {
  const creds = readCredentialsFile();
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value);
    creds[key] = encrypted.toString('base64');
  } else {
    // Fallback: base64 encode (not secure, but better than plaintext)
    creds[key] = Buffer.from(value).toString('base64');
  }
  writeCredentialsFile(creds);
}

/**
 * Retrieve and decrypt a credential.
 */
export function getCredential(key: string): string | null {
  const creds = readCredentialsFile();
  const stored = creds[key];
  if (!stored) return null;

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(stored, 'base64');
      return safeStorage.decryptString(buffer);
    } else {
      // Fallback: base64 decode
      return Buffer.from(stored, 'base64').toString('utf-8');
    }
  } catch {
    // If decryption fails (e.g., migrated from old format), return null
    return null;
  }
}

/**
 * Delete a credential.
 */
export function deleteCredential(key: string): void {
  const creds = readCredentialsFile();
  delete creds[key];
  writeCredentialsFile(creds);
}

/**
 * Get all credential keys (not values).
 */
export function listCredentialKeys(): string[] {
  const creds = readCredentialsFile();
  return Object.keys(creds);
}

/**
 * Migrate API keys from electron-store (old static encryption) to safeStorage.
 * Called once on startup. Safe to call multiple times — skips if already migrated.
 */
export async function migrateFromElectronStore(): Promise<void> {
  const migrationFlag = path.join(app.getPath('userData'), '.credentials-migrated');
  if (fs.existsSync(migrationFlag)) return;

  try {
    const { default: Store } = await import('electron-store');
    const oldStore: any = new Store({ name: 'recllm-settings', encryptionKey: 'recllm-local-encryption-key' });
    const apiKeys = oldStore.get('apiKeys') as Record<string, string> | undefined;

    if (apiKeys) {
      for (const [provider, key] of Object.entries(apiKeys)) {
        if (key && key.trim().length > 0) {
          setCredential(`apikey.${provider}`, key.trim());
        }
      }
      console.log(`[credential-store] Migrated ${Object.keys(apiKeys).length} API keys to safeStorage`);
    }
  } catch (err) {
    console.error('[credential-store] Migration failed (non-fatal):', (err as Error).message);
  }

  // Mark migration complete regardless of outcome
  try {
    fs.writeFileSync(migrationFlag, new Date().toISOString());
  } catch {}
}

/**
 * Get all API keys as a record (for backward compatibility with settings:get 'apiKeys').
 */
export function getAllApiKeys(): Record<string, string> {
  const creds = readCredentialsFile();
  const keys: Record<string, string> = {};
  for (const credKey of Object.keys(creds)) {
    if (credKey.startsWith('apikey.')) {
      const provider = credKey.slice(7); // Remove 'apikey.' prefix
      const value = getCredential(credKey);
      if (value) keys[provider] = value;
    }
  }
  return keys;
}

/**
 * Set all API keys from a record (for backward compatibility with settings:set 'apiKeys').
 */
export function setAllApiKeys(keys: Record<string, string>): void {
  for (const [provider, key] of Object.entries(keys)) {
    if (key && key.trim().length > 0) {
      setCredential(`apikey.${provider}`, key.trim());
    } else {
      deleteCredential(`apikey.${provider}`);
    }
  }
}
