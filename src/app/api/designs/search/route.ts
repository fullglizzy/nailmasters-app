import { NextRequest } from 'next/server';
import { searchDesigns } from '@/lib/search';
import { designFiltersSchema } from '@/lib/validators';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';

export const GET = withRateLimit('search')(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = designFiltersSchema.safeParse(rawParams);

    if (!parsed.success) {
      return errorResponse('Невалидные параметры поиска', 422);
    }

    const result = await searchDesigns(parsed.data);
    return successResponse(result);
  } catch (error) {
    return errorResponse('Ошибка поиска', 500);
  }
});
