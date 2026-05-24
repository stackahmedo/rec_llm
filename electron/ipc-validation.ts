/**
 * IPC Input Validation Utilities
 *
 * Lightweight validators for data coming from the renderer process.
 * Prevents path traversal, injection, and malformed payloads.
 */

import path from 'path';
import { app } from 'electron';

/**
 * Validate that a file path is absolute and does not contain traversal patterns.
 * Returns the normalized path or throws.
 */
export function validateFilePath(filePath: unknown): string {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new Error('Invalid file path: must be a non-empty string.');
  }

  const normalized = path.normalize(filePath);

  // Must be absolute
  if (!path.isAbsolute(normalized)) {
    throw new Error('Invalid file path: must be absolute.');
  }

  // Reject null bytes (path traversal via null byte injection)
  if (normalized.includes('\0')) {
    throw new Error('Invalid file path: contains null bytes.');
  }

  return normalized;
}

/**
 * Validate that a path is within the app's userData directory.
 * Used for paths the app controls (history, documents, etc.)
 */
export function validateAppDataPath(filePath: string): string {
  const normalized = path.normalize(filePath);
  const userData = app.getPath('userData');
  if (!normalized.startsWith(userData)) {
    throw new Error('Path is outside app data directory.');
  }
  return normalized;
}

/**
 * Validate a string parameter (non-empty, bounded length).
 */
export function validateString(value: unknown, name: string, maxLength: number = 10000): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${name}: must be a string.`);
  }
  if (value.length === 0) {
    throw new Error(`Invalid ${name}: must not be empty.`);
  }
  if (value.length > maxLength) {
    throw new Error(`Invalid ${name}: exceeds maximum length.`);
  }
  return value;
}

/**
 * Validate a settings key — alphanumeric, dots, dashes, underscores only.
 */
export function validateSettingsKey(key: unknown): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
    throw new Error('Invalid settings key.');
  }
  if (!/^[a-zA-Z0-9._\-]+$/.test(key)) {
    throw new Error('Invalid settings key: contains disallowed characters.');
  }
  return key;
}

/**
 * Sanitize an ID for use in file paths — same as history.ts sanitizeId.
 */
export function sanitizeId(id: unknown): string {
  if (typeof id !== 'string') {
    throw new Error('Invalid ID: must be a string.');
  }
  const sanitized = id.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!sanitized || sanitized.startsWith('.')) {
    throw new Error(`Invalid ID: "${id}"`);
  }
  return sanitized;
}
