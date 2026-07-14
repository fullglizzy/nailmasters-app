import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, desc, or, sql, inArray } from 'drizzle-orm';
import { createDesignSchemaRefined, designFiltersSchema } from '@/lib/validators';
import { successResponse, paginatedResponse, errorResponse } from '@/lib/response';
import { withAuth, withOptionalAuth, withRateLimit, type AuthenticatedRequest } from '@/lib/api-middleware';
import { cacheGet, cacheSet, cacheDeletePattern } from '@/lib/redis';
import { logger } from '@/lib/logger';

// GET /api/designs — список дизайнов с фильтрацией и пагинацией
export const GET = withOptionalAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);

    // Support ?ids=id1,id2,id3 for fetching specific designs (guest likes, etc.)
    const idsParam = url.searchParams.get('ids');
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        const designs = await db.select().from(schema.nailDesigns).where(inArray(schema.nailDesigns.id, ids));
        return successResponse(designs);
      }
      return successResponse([]);
    }

    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = designFiltersSchema.safeParse(rawParams);

    if (!parsed.success) {
      return errorResponse('Невалидные параметры фильтрации', 422);
    }

    const filters = parsed.data;
    const cacheKey = `designs:list:${JSON.stringify(filters)}`;

    // Пробуем кеш
    if (filters.page === 1) {
      const cached = await cacheGet<{ designs: unknown[]; pagination: unknown }>(cacheKey);
      if (cached) {
        return successResponse(cached.designs, undefined, 200);
      }
    }

    const { page, limit, type, source, color, length, shape, season, sort, search, includeOwn } = filters;
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.nailDesigns.isActive, true)];

    // Фильтр по загрузившему пользователю (для вкладки «Загрузки» в ЛК)
    const uploadedBy = url.searchParams.get('uploadedBy');
    if (uploadedBy) {
      conditions.push(
        or(
          eq(schema.nailDesigns.uploadedByClientId, uploadedBy),
          eq(schema.nailDesigns.uploadedByMasterId, uploadedBy),
        )!,
      );
    }

    // Модерированные или свои
    if (!includeOwn) {
      conditions.push(eq(schema.nailDesigns.isModerated, true));
    }

    if (type) conditions.push(eq(schema.nailDesigns.type, type));
    if (source) conditions.push(eq(schema.nailDesigns.source, source));
    if (color) conditions.push(eq(schema.nailDesigns.color, color));
    if (length) conditions.push(eq(schema.nailDesigns.length, length));
    if (shape) conditions.push(eq(schema.nailDesigns.shape, shape));
    if (season) conditions.push(eq(schema.nailDesigns.season, season));

    // Поиск
    if (search) {
      const likeSafe = search.replace(/[%_]/g, '\\$&');
      conditions.push(
        or(
          sql`${schema.nailDesigns.title} ILIKE ${`%${likeSafe}%`}`,
          sql`${schema.nailDesigns.description} ILIKE ${`%${likeSafe}%`}`,
        )!,
      );
    }

    // Сортировка
    const orderBy = sort === 'likes'
      ? desc(schema.nailDesigns.likesCount)
      : sort === 'popular'
        ? desc(schema.nailDesigns.ordersCount)
        : desc(schema.nailDesigns.createdAt);

    const [designs, totalResult] = await Promise.all([
      db
        .select()
        .from(schema.nailDesigns)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(schema.nailDesigns)
        .where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count ?? 0;

    // Кешируем первую страницу
    if (page === 1) {
      await cacheSet(cacheKey, { designs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }, 60);
    }

    return paginatedResponse(designs, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error(error, 'Get designs error');
    return errorResponse('Ошибка получения дизайнов', 500);
  }
});

// POST /api/designs — создание дизайна (авторизованный)
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const body = await req.json();
    const parsed = createDesignSchemaRefined.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }

    const data = parsed.data;

    // Определяем источник
    const source = user.role === 'nailmaster' ? 'master' : 'client';

    const [design] = await db
      .insert(schema.nailDesigns)
      .values({
        title: data.title,
        description: data.description || null,
        images: data.images,
        videoUrl: data.videoUrl || null,
        type: data.type || 'basic',
        source,
        tags: data.tags || null,
        color: data.color || null,
        colors: data.colors || null,
        techniques: data.techniques || null,
        length: data.length || null,
        shape: data.shape || null,
        occasionTags: data.occasionTags || null,
        moodTags: data.moodTags || null,
        materials: data.materials || null,
        decorTags: data.decorTags || null,
        durationMinutes: data.durationMinutes || null,
        season: data.season || null,
        trendTags: data.trendTags || null,
        serviceFormat: data.serviceFormat || null,
        isModerated: true, // авто-одобрение как в оригинале
        uploadedByClientId: user.role === 'client' ? user.userId : null,
        uploadedByMasterId: user.role === 'nailmaster' ? user.userId : null,
      })
      .returning();

    // Инвалидируем кеш списка
    await cacheDeletePattern('designs:list:*');

    logger.info({ designId: design.id, userId: user.userId }, 'Design created');

    return successResponse(design, 'Дизайн создан', 201);
  } catch (error) {
    logger.error(error, 'Create design error');
    return errorResponse('Ошибка создания дизайна', 500);
  }
});
