import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { saveOptimizedImage, validateImageUpload } from '@/lib/upload';
import { withRateLimit } from '@/lib/api-middleware';

// POST /api/designs/upload-image — загрузка одного изображения (10MB)
export const POST = withAuth(withRateLimit('upload')(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) return errorResponse('Файл не предоставлен', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const validationError = validateImageUpload(buffer, file.type, 10);
    if (validationError) return errorResponse(validationError, 422);

    const result = await saveOptimizedImage(buffer, file.name, 'designs');
    return successResponse({ url: result.url, filename: result.filename }, 'Изображение загружено', 201);
  } catch {
    return errorResponse('Ошибка загрузки изображения', 500);
  }
}));
