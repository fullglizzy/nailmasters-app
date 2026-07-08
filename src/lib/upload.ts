import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

// Разрешенные MIME-типы
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

// Проверка magic bytes для изображений
const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
  gif: [0x47, 0x49, 0x46, 0x38],
};

function checkMagicBytes(buffer: Buffer, expectedBytes: number[]): boolean {
  return expectedBytes.every((byte, i) => buffer[i] === byte);
}

// Определение типа изображения по magic bytes
function detectImageType(buffer: Buffer): string | null {
  for (const [type, bytes] of Object.entries(IMAGE_MAGIC_BYTES)) {
    if (checkMagicBytes(buffer, bytes)) return type;
  }
  return null;
}

export interface UploadResult {
  url: string;
  filename: string;
  width?: number;
  height?: number;
}

// Сохранение загруженного файла
export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string,
  category: 'designs' | 'videos' | 'avatars' | 'sterilization',
): Promise<UploadResult> {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
  const filename = `${category}_${Date.now()}_${nanoid(8)}.${ext}`;
  const dir = join(process.cwd(), UPLOAD_DIR, category);

  // Создаем директорию если не существует
  await mkdir(dir, { recursive: true });

  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);

  return {
    url: `/uploads/${category}/${filename}`,
    filename,
  };
}

// Сохранение оптимизированного изображения
export async function saveOptimizedImage(
  buffer: Buffer,
  originalName: string,
  category: 'designs' | 'avatars' | 'sterilization',
): Promise<UploadResult> {
  const { optimizeImage } = await import('./image');
  try {
    const optimized = await optimizeImage(buffer);
    return saveUploadedFile(optimized, originalName.replace(/\.[^.]+$/, '.webp'), category);
  } catch {
    // Если оптимизация не удалась, сохраняем оригинал
    return saveUploadedFile(buffer, originalName, category);
  }
}

// Валидация загружаемого файла
export function validateImageUpload(buffer: Buffer, mimeType: string, maxSizeMB: number = 10): string | null {
  // Проверка размера
  if (buffer.length > maxSizeMB * 1024 * 1024) {
    return `Размер файла превышает ${maxSizeMB}MB`;
  }

  // Проверка MIME-типа
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return 'Неподдерживаемый формат изображения. Разрешены: JPEG, PNG, WebP, GIF';
  }

  // Проверка magic bytes
  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    return 'Файл не является допустимым изображением';
  }

  return null; // OK
}

export function validateVideoUpload(buffer: Buffer, mimeType: string, maxSizeMB: number = 100): string | null {
  if (buffer.length > maxSizeMB * 1024 * 1024) {
    return `Размер видео превышает ${maxSizeMB}MB`;
  }

  if (!ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return 'Неподдерживаемый формат видео. Разрешены: MP4, WebM, OGG, MOV';
  }

  return null; // OK
}
