import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Создание снимка дизайна при создании заказа
export async function createDesignSnapshot(designId: string) {
  const design = await db
    .select()
    .from(schema.nailDesigns)
    .where(eq(schema.nailDesigns.id, designId))
    .limit(1);

  if (!design.length) return null;

  const d = design[0];

  // Определяем автора дизайна
  let authorName = 'Unknown';
  let authorId = '';

  if (d.uploadedByMasterId) {
    const master = await db
      .select()
      .from(schema.masterProfiles)
      .where(eq(schema.masterProfiles.userId, d.uploadedByMasterId))
      .limit(1);
    if (master.length) {
      authorName = master[0].fullName;
      authorId = master[0].userId;
    }
  } else if (d.uploadedByClientId) {
    const client = await db
      .select()
      .from(schema.clientProfiles)
      .where(eq(schema.clientProfiles.userId, d.uploadedByClientId))
      .limit(1);
    if (client.length) {
      authorName = client[0].fullName || 'Client';
      authorId = client[0].userId;
    }
  }

  const [snapshot] = await db
    .insert(schema.orderDesignSnapshots)
    .values({
      title: d.title,
      description: d.description,
      images: d.images,
      videoUrl: d.videoUrl,
      type: d.type,
      source: d.source,
      tags: d.tags,
      color: d.color,
      originalDesignId: d.id,
      authorName,
      authorId,
    })
    .returning();

  return snapshot;
}

// Получение информации о дизайне из заказа (снепшот или живой дизайн)
export async function getOrderDesignInfo(
  nailDesignId: string | null,
  designSnapshotId: string | null,
) {
  if (designSnapshotId) {
    const snapshots = await db
      .select()
      .from(schema.orderDesignSnapshots)
      .where(eq(schema.orderDesignSnapshots.id, designSnapshotId))
      .limit(1);
    return snapshots[0] || null;
  }

  if (nailDesignId) {
    const designs = await db
      .select()
      .from(schema.nailDesigns)
      .where(eq(schema.nailDesigns.id, nailDesignId))
      .limit(1);
    return designs[0] || null;
  }

  return null;
}
