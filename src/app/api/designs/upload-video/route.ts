import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, withRateLimit, type AuthenticatedRequest } from '@/lib/api-middleware';
import { saveUploadedFile, validateVideoUpload } from '@/lib/upload';

export const POST = withAuth(withRateLimit('upload')(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    if (!file) return errorResponse('Файл не предоставлен', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const validationError = validateVideoUpload(buffer, file.type, 100);
    if (validationError) return errorResponse(validationError, 422);

    const result = await saveUploadedFile(buffer, file.name, 'videos');
    return successResponse({ url: result.url, filename: result.filename }, 'Видео загружено', 201);
  } catch {
    return errorResponse('Ошибка загрузки видео', 500);
  }
}));
