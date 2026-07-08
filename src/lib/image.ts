// Оптимизация изображений через sharp
// При загрузке: проверка, ресайз, конвертация в WebP

const SHARP_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 400, height: 400 },
  medium: { width: 800, height: 800 },
  large: { width: 1920, height: 1920 },
} as const;

export type ImageSize = keyof typeof SHARP_SIZES;

// Оптимизация изображения до заданного размера
export async function optimizeImage(
  buffer: Buffer,
  size: ImageSize = 'medium',
): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    const dimensions = SHARP_SIZES[size];

    return sharp(buffer)
      .resize(dimensions.width, dimensions.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    // Если sharp не удалось, возвращаем оригинал
    return buffer;
  }
}

// Оптимизация с несколькими размерами
export async function optimizeImageMultiple(
  buffer: Buffer,
): Promise<Record<ImageSize, Buffer | null>> {
  try {
    const results = await Promise.allSettled(
      Object.keys(SHARP_SIZES).map(async (size) => {
        const result = await optimizeImage(buffer, size as ImageSize);
        return { size, buffer: result };
      }),
    );

    const sizes: Record<string, Buffer | null> = {};
    results.forEach((r, i) => {
      const size = Object.keys(SHARP_SIZES)[i];
      sizes[size] = r.status === 'fulfilled' ? r.value.buffer : null;
    });

    return sizes as Record<ImageSize, Buffer | null>;
  } catch {
    return { thumbnail: buffer, small: buffer, medium: buffer, large: buffer };
  }
}

// Получение метаданных изображения
export async function getImageMetadata(buffer: Buffer): Promise<{
  width?: number;
  height?: number;
  format?: string;
}> {
  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    };
  } catch {
    return {};
  }
}
