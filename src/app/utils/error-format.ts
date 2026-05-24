const isDev = typeof process !== 'undefined'
  ? process.env.NODE_ENV === 'development'
  : import.meta.env?.DEV ?? false;

export function formatErrorForUser(error: unknown): string {
  if (error instanceof Error) {
    if (isDev) return error.message;
    return sanitizeMessage(error.message);
  }
  if (typeof error === 'string') {
    if (isDev) return error;
    return sanitizeMessage(error);
  }
  return 'An unexpected error occurred. Please try again.';
}

export function formatIpcError(result: { ok: boolean; error?: string }): string {
  if (result.ok) return '';
  if (!result.error) return 'Operation failed. Please try again.';
  if (isDev) return result.error;
  return sanitizeMessage(result.error);
}

function sanitizeMessage(msg: string): string {
  if (msg.includes('ENOENT') || msg.includes('EACCES')) {
    return 'File access error. Please check the file path and permissions.';
  }
  if (msg.includes('ENOSPC')) {
    return 'Disk space is full. Please free up space and try again.';
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (msg.includes('Validation failed')) {
    return 'Invalid input. Please check your data and try again.';
  }
  if (msg.length > 200) {
    return msg.slice(0, 200) + '…';
  }
  return msg;
}

export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}
