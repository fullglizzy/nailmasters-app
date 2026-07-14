import { successResponse, errorResponse } from '@/lib/response';
import { clearRefreshTokenCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';

// POST /api/auth/logout — удаляет refreshToken httpOnly cookie
export const POST = async () => {
  try {
    await clearRefreshTokenCookie();
    return successResponse(null, 'Сессия завершена');
  } catch (error) {
    logger.error(error, 'Logout error');
    return errorResponse('Ошибка выхода', 500);
  }
};
