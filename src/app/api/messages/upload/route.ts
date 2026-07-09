import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) return errorResponse('Файлы обязательны', 422);
    if (files.length > 10) return errorResponse('Максимум 10 файлов', 422);

    const maxSize = 10 * 1024 * 1024; // 10MB per file
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'messages');
    await mkdir(uploadDir, { recursive: true });

    const results: { url: string; type: string }[] = [];

    for (const file of files) {
      if (file.size > maxSize) return errorResponse(`Файл ${file.name} слишком большой (макс. 10MB)`, 413);

      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
      const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
      const type = isImage ? 'image' : isVideo ? 'video' : 'file';
      const filename = `${uuid()}.${ext}`;

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);

      results.push({ url: `/uploads/messages/${filename}`, type });
    }

    return successResponse(results, 'Загружено', 201);
  } catch {
    return errorResponse('Ошибка загрузки', 500);
  }
});
