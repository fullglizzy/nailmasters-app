import { NextRequest } from 'next/server';
import { searchMasters } from '@/lib/search';
import { successResponse, errorResponse } from '@/lib/response';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const searchMastersSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  specialty: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = searchMastersSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

    const { q: query, city, specialty, minRating, page, limit } = parsed.data;
    const result = await searchMasters({ query, city, specialty, minRating, page, limit });
    return successResponse(result);
  } catch (error) {
    logger.error(error, 'GET /api/masters/search error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
}
