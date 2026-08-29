import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogg: 'video/ogg',
};

// Загрузки пишутся в рантайме (после сборки), поэтому Next-индекс public/
// их не знает — отдаём сами из UPLOAD_DIR, как на проде: /var/lib/nailmasters/uploads
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  if (!segments?.length) return new NextResponse('Not Found', { status: 404 });

  const root = path.resolve(
    process.env.UPLOAD_DIR ||
      path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'uploads'),
  );
  const filePath = path.resolve(root, ...segments);
  // Защита от выхода за пределы каталога загрузок (../, абсолютные сегменты)
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new NextResponse('Not Found', { status: 404 });
    size = info.size;
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': String(size),
      // Имена файлов уникальны (uuid/nanoid) — содержимое неизменяемо
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
