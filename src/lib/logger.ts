const isDev = process.env.NODE_ENV === 'development';

// Simple logger without pino — avoids worker thread crashes in Next.js
export const logger = {
  info: (obj: unknown, msg?: string) => {
    if (isDev) console.log(`[INFO] ${msg || ''}`, typeof obj === 'object' ? JSON.stringify(obj) : obj);
  },
  error: (obj: unknown, msg?: string) => {
    console.error(`[ERROR] ${msg || ''}`, typeof obj === 'object' ? JSON.stringify(obj) : obj);
  },
  warn: (obj: unknown, msg?: string) => {
    console.warn(`[WARN] ${msg || ''}`, typeof obj === 'object' ? JSON.stringify(obj) : obj);
  },
  debug: (obj: unknown, msg?: string) => {
    if (isDev) console.debug(`[DEBUG] ${msg || ''}`, typeof obj === 'object' ? JSON.stringify(obj) : obj);
  },
};

export function httpLogger(method: string, url: string, statusCode: number, ms: number) {
  logger.info({ method, url, statusCode, responseTime: ms }, 'HTTP request');
}
