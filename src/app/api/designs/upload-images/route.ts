import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { saveOptimizedImage, validateImageUpload } from '@/lib/upload';

// POST /api/designs/upload-images — множественная загрузка (до 10 файлов)
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];

    if (!files.length) return errorResponse('Файлы не предоставлены', 400);
    if (files.length > 10) return errorResponse('Максимум 10 файлов', 400);

    const results = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const validationError = validateImageUpload(buffer, file.type, 10);
        if (validationError) throw new Error(validationError);
        return saveOptimizedImage(buffer, file.name, 'designs');
      })
    );

    return successResponse({ files: results }, `Загружено файлов: ${results.length}`, 201);
  } catch {
    return errorResponse('Ошибка загрузки изображений', 500);
  }
});
