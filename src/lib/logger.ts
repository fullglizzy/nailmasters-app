// Простой логгер без pino — избегаем краха worker-тредов в Next.js.
// Уровень читается из LOG_LEVEL (по умолчанию debug в dev, info в prod).
// В production выводим структурированный JSON, в dev — читаемый текст.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isDev = process.env.NODE_ENV === 'development';
const envLevel = (process.env.LOG_LEVEL as LogLevel | undefined);
const minLevel: LogLevel = envLevel && envLevel in LEVEL_WEIGHT ? envLevel : (isDev ? 'debug' : 'info');

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[minLevel];
}

function emit(level: LogLevel, obj: unknown, msg?: string) {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();

  if (isDev) {
    const payload = typeof obj === 'object' ? JSON.stringify(obj) : obj;
    const line = `[${timestamp}] [${level.toUpperCase()}] ${msg || ''}`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(line, payload);
    return;
  }

  // production — структурированный JSON
  const record: Record<string, unknown> = { timestamp, level, msg: msg || undefined };
  if (obj instanceof Error) {
    record.error = { name: obj.name, message: obj.message, stack: obj.stack };
  } else if (typeof obj === 'object' && obj !== null) {
    Object.assign(record, obj);
  } else if (obj !== undefined) {
    record.detail = obj;
  }
  const out = JSON.stringify(record);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export const logger = {
  info: (obj: unknown, msg?: string) => emit('info', obj, msg),
  error: (obj: unknown, msg?: string) => emit('error', obj, msg),
  warn: (obj: unknown, msg?: string) => emit('warn', obj, msg),
  debug: (obj: unknown, msg?: string) => emit('debug', obj, msg),
};

export function httpLogger(method: string, url: string, statusCode: number, ms: number) {
  logger.info({ method, url, statusCode, responseTime: ms }, 'HTTP request');
}
