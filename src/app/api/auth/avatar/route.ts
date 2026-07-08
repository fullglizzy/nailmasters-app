import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { saveOptimizedImage, validateImageUpload } from '@/lib/upload';
import { logger } from '@/lib/logger';

export const PUT = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const formData = await req.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return errorResponse('Файл аватара не предоставлен', 400);
    }

    // Валидация
    const buffer = Buffer.from(await file.arrayBuffer());
    const validationError = validateImageUpload(buffer, file.type, 5); // 5MB для аватара
    if (validationError) {
      return errorResponse(validationError, 422);
    }

    // Сохранение с оптимизацией
    const result = await saveOptimizedImage(buffer, file.name, 'avatars');

    // Обновление URL аватара в БД
    await db
      .update(schema.users)
      .set({ avatarUrl: result.url })
      .where(eq(schema.users.id, user.userId));

    logger.info({ userId: user.userId }, 'Avatar updated');

    return successResponse({ avatarUrl: result.url }, 'Аватар обновлен');
  } catch (error) {
    logger.error(error, 'Avatar upload error');
    return errorResponse('Ошибка загрузки аватара', 500);
  }
});
