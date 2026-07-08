import { redis } from './redis';
import { TooManyRequestsError } from './errors';

// Rate limiting через Redis (скользящее окно)
// Использует sorted set для точного sliding window

interface RateLimitConfig {
  windowMs: number;    // окно в миллисекундах
  maxRequests: number; // макс. запросов в окне
  keyPrefix: string;   // префикс ключа в Redis
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { windowMs: 60_000, maxRequests: 100, keyPrefix: 'rl:default' },
  auth: { windowMs: 60_000, maxRequests: 5, keyPrefix: 'rl:auth' },
  upload: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:upload' },
  search: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:search' },
};

export async function rateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS = 'default',
): Promise<void> {
  const config = RATE_LIMITS[type];
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
