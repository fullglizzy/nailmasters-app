import { redis } from './redis';
import { TooManyRequestsError } from './errors';
import { envInt, envBool } from './env';

// Rate limiting через Redis (скользящее окно)
// Использует sorted set для точного sliding window

interface RateLimitConfig {
  windowMs: number;    // окно в миллисекундах
  maxRequests: number; // макс. запросов в окне
  keyPrefix: string;   // префикс ключа в Redis
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { windowMs: 60_000, maxRequests: 100, keyPrefix: 'rl:default' },
  auth: { windowMs: 60_000, maxRequests: 5, keyPrefix: 'rl:auth' },
  upload: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:upload' },
  search: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:search' },
};

/**
 * Настройки лимитов через env:
 *   RATE_LIMIT_<TYPE>_MAX          — максимум запросов (0 = без лимита)
 *   RATE_LIMIT_<TYPE>_WINDOW_SEC   — окно в секундах
 *   RATE_LIMIT_DISABLED            — полностью выключить все лимиты
 *   RATE_LIMIT_AUTH_DISABLED       — выключить только auth-лимиты
 */
function configFromEnv(prefix: string, defaults: RateLimitConfig): RateLimitConfig {
  return {
    windowMs: envInt(`RATE_LIMIT_${prefix}_WINDOW_SEC`, defaults.windowMs / 1000) * 1000,
    maxRequests: envInt(`RATE_LIMIT_${prefix}_MAX`, defaults.maxRequests),
    keyPrefix: defaults.keyPrefix,
  };
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: configFromEnv('DEFAULT', DEFAULT_RATE_LIMITS.default),
  auth: configFromEnv('AUTH', DEFAULT_RATE_LIMITS.auth),
  upload: configFromEnv('UPLOAD', DEFAULT_RATE_LIMITS.upload),
  search: configFromEnv('SEARCH', DEFAULT_RATE_LIMITS.search),
};

const RATE_LIMIT_DISABLED = envBool('RATE_LIMIT_DISABLED');
const RATE_LIMIT_AUTH_DISABLED = envBool('RATE_LIMIT_AUTH_DISABLED');

export async function rateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS = 'default',
): Promise<void> {
  if (RATE_LIMIT_DISABLED) return;
  if (type === 'auth' && RATE_LIMIT_AUTH_DISABLED) return;

  const config = RATE_LIMITS[type];
  // 0 (или отрицательное) — лимит для этого типа отключён
  if (config.maxRequests <= 0 || config.windowMs <= 0) return;

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `${config.keyPrefix}:${identifier}`;

  try {
    // Удаляем старые записи за пределами окна
    await redis.zremrangebyscore(key, 0, windowStart);

    // Считаем количество запросов в текущем окне
    const requestCount = await redis.zcard(key);

    if (requestCount >= config.maxRequests) {
      throw new TooManyRequestsError('Слишком много запросов. Попробуйте позже.');
    }

    // Добавляем текущий запрос
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    // Устанавливаем TTL на ключ
    await redis.expire(key, Math.ceil(config.windowMs / 1000) + 1);
  } catch (error) {
    if (error instanceof TooManyRequestsError) throw error;
    // Если Redis недоступен, пропускаем rate limiting (graceful degradation)
    console.warn('Rate limit check failed (Redis may be down):', error);
  }
}

// Получение IP-адреса из запроса
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}
