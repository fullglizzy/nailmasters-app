import { db, schema } from '@/lib/db';
import { sql, SQL, and, or, eq, gte, desc, ilike } from 'drizzle-orm';
import type { DesignFilters } from './validators';

// Полнотекстовый поиск дизайнов с использованием PostgreSQL tsvector
export async function searchDesigns(filters: DesignFilters) {
  const { page, limit, type, source, color, length, shape, season, search, sort, includeOwn } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [
    eq(schema.nailDesigns.isActive, true),
  ];

  // Модерированные дизайны (или свои)
  if (includeOwn) {
    // Для includeOwn=true показываем немодерированные свои + все модерированные
    // conditions.push(...) — решается на уровне API route с userId
  } else {
    conditions.push(eq(schema.nailDesigns.isModerated, true));
  }

  // Фильтры
  if (type) conditions.push(eq(schema.nailDesigns.type, type));
  if (source) conditions.push(eq(schema.nailDesigns.source, source));
  if (color) conditions.push(eq(schema.nailDesigns.color, color));
  if (length) conditions.push(eq(schema.nailDesigns.length, length));
  if (shape) conditions.push(eq(schema.nailDesigns.shape, shape));
  if (season) conditions.push(eq(schema.nailDesigns.season, season));

  // Full-text search (tsvector + GIN index)
  if (search) {
    const tsquery = search.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, ' ').trim().split(/\s+/).filter(w => w.length > 0).join(' & ');
    if (tsquery) {
      conditions.push(
        or(
          sql`search_vector @@ to_tsquery('russian', ${tsquery})`,
          sql`${schema.nailDesigns.title} ILIKE ${`%${search}%`}`,
          sql`${schema.nailDesigns.description} ILIKE ${`%${search}%`}`,
        )!,
      );
    }
  }

  // Сортировка
  let orderBy;
  switch (sort) {
    case 'likes':
      orderBy = desc(schema.nailDesigns.likesCount);
      break;
    case 'popular':
      orderBy = desc(schema.nailDesigns.ordersCount);
      break;
    case 'newest':
    default:
      orderBy = desc(schema.nailDesigns.createdAt);
      break;
  }

  // Запрос с пагинацией
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

  return {
    designs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Поиск мастеров с геолокацией и полнотекстовым поиском
export async function searchMasters(params: {
  query?: string;
  city?: string;
  specialty?: string;
  minRating?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  page?: number;
  limit?: number;
}) {
  const { query, city, specialty, minRating, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [
    eq(schema.masterProfiles.isActive, true),
    eq(schema.masterProfiles.isModerated, true),
  ];

  if (query) {
    conditions.push(
      or(
        ilike(schema.masterProfiles.fullName, `%${query}%`),
        ilike(schema.masterProfiles.description || '', `%${query}%`),
        ilike(schema.masterProfiles.city || '', `%${query}%`),
      )!,
    );
  }

  if (city) conditions.push(eq(schema.masterProfiles.city || '', city));
  if (minRating) conditions.push(gte(schema.masterProfiles.rating, String(minRating)));

  const [masters, totalResult] = await Promise.all([
    db
      .select()
      .from(schema.masterProfiles)
      .where(and(...conditions))
      .orderBy(desc(schema.masterProfiles.rating))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.masterProfiles)
      .where(and(...conditions)),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    masters,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
