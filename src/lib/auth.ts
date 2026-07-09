import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from '@/db/schema/users';

// JWT конфигурация
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-jwt-secret-change-me');
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export interface TokenPayload {
  userId: string;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  isGuest: boolean;
  fullName?: string | null;
  phone?: string | null;
  avatar?: string | null;
}

// Генерация access token
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

// Генерация refresh token
export async function generateRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_REFRESH_EXPIRY)
    .sign(JWT_REFRESH_SECRET);
}

// Верификация access token
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// Верификация refresh token
export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return (payload as { userId: string }).userId || null;
  } catch {
    return null;
  }
}

// Извлечение токена из заголовка Authorization
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// Установка refresh token в httpOnly cookie
export async function setRefreshTokenCookie(refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 дней
  });
}

// Получение refresh token из cookie
export async function getRefreshTokenCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('refreshToken')?.value;
}

// Удаление refresh token cookie
export async function clearRefreshTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('refreshToken');
}

// Упрощенный хеш пароля с использованием Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 12);
}

// Проверка пароля
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Пропускаем уже bcrypt-hashed строки (начинающиеся с $2a$ или $2b$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }
  return false;
}
