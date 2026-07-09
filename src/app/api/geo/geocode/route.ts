import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/response';
import { geocodeAddress } from '@/lib/geo';
import { withAuth } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// GET /api/geo/geocode?address=...
// Геокодирует адрес и возвращает координаты
export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const address = url.searchParams.get('address');

  if (!address) return errorResponse('Адрес обязателен', 400);

  try {
    const result = await geocodeAddress(address);
    if (!result) return errorResponse('Адрес не найден', 404);

    return successResponse(result);
  } catch (error) {
    logger.error(error, 'Geocode error');
    return errorResponse('Ошибка геокодинга', 500);
  }
});
