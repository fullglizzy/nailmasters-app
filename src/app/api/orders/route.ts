import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, desc, or, sql, inArray } from 'drizzle-orm';
import { createOrderSchema } from '@/lib/validators';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { createDesignSnapshot } from '@/lib/design-snapshot';
import { blockTimeSlot } from '@/lib/schedule';
import { logger } from '@/lib/logger';

// GET /api/orders — заказы пользователя
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const status = url.searchParams.get('status');

    const conditions = [];

    if (user.role === 'client') {
      conditions.push(eq(schema.orders.clientId, user.userId));
    } else if (user.role === 'nailmaster') {
      conditions.push(eq(schema.orders.nailMasterId, user.userId));
    } else if (user.role !== 'admin') {
      // Админ видит все
      conditions.push(or(
        eq(schema.orders.clientId, user.userId),
        eq(schema.orders.nailMasterId, user.userId),
      )!);
    }

    if (status) {
      conditions.push(eq(schema.orders.status, status));
    }

    const where = and(...conditions);

    const [orders, totalResult] = await Promise.all([
      db.select().from(schema.orders).where(where).orderBy(desc(schema.orders.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.orders).where(where),
    ]);

    // Fetch design snapshots for all orders that have them
    const snapshotIds = orders.filter(o => o.designSnapshotId).map(o => o.designSnapshotId!);
    const designIds = orders.filter(o => o.nailDesignId && !o.designSnapshotId).map(o => o.nailDesignId!);
    const snapshots = snapshotIds.length > 0
      ? await db.select().from(schema.orderDesignSnapshots).where(inArray(schema.orderDesignSnapshots.id, snapshotIds))
      : [];
    const liveDesigns = designIds.length > 0
      ? await db.select({ id: schema.nailDesigns.id, title: schema.nailDesigns.title, images: schema.nailDesigns.images })
          .from(schema.nailDesigns).where(inArray(schema.nailDesigns.id, designIds))
      : [];

    const snapshotMap = new Map(snapshots.map(s => [s.id, s]));
    const designMap = new Map(liveDesigns.map(d => [d.id, d]));

    // Enrich with client + master names and phones
    const clientIds = [...new Set(orders.map(o => o.clientId).filter(Boolean))];
    const masterIds = [...new Set(orders.map(o => o.nailMasterId).filter(Boolean))];
    const [clients, users, masters] = await Promise.all([
      clientIds.length > 0 ? db.select({ userId: schema.clientProfiles.userId, fullName: schema.clientProfiles.fullName, phone: schema.clientProfiles.phone }).from(schema.clientProfiles).where(inArray(schema.clientProfiles.userId, clientIds as string[])) : Promise.resolve([]),
      [...clientIds, ...masterIds].length > 0 ? db.select({ id: schema.users.id, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, [...clientIds, ...masterIds] as string[])) : Promise.resolve([]),
      masterIds.length > 0 ? db.select({ userId: schema.masterProfiles.userId, fullName: schema.masterProfiles.fullName, phone: schema.masterProfiles.phone, address: schema.masterProfiles.address, city: schema.masterProfiles.city }).from(schema.masterProfiles).where(inArray(schema.masterProfiles.userId, masterIds as string[])) : Promise.resolve([]),
    ]);
    const avatarMap = new Map(users.map(u => [u.id, u.avatarUrl]));
    const clientMap = new Map(clients.map(c => [c.userId, c]));
    const masterMap = new Map(masters.map(m => [m.userId, m]));

    const enriched = orders.map(o => {
      const design = o.designSnapshotId
        ? snapshotMap.get(o.designSnapshotId)
        : o.nailDesignId ? designMap.get(o.nailDesignId) : null;
      const client = clientMap.get(o.clientId);
      const master = masterMap.get(o.nailMasterId);
      return {
        ...o,
        _design: design || null,
        _client: client ? { name: client.fullName || 'Клиент', phone: client.phone || '', avatar: avatarMap.get(o.clientId) } : null,
        _master: master ? { name: master.fullName, phone: master.phone, address: [master.address, master.city].filter(Boolean).join(', '), avatar: avatarMap.get(o.nailMasterId) } : null,
      };
    });

    const total = totalResult[0]?.count ?? 0;
    return paginatedResponse(enriched, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error(error, 'Get orders error');
    return errorResponse('Ошибка получения заказов', 500);
  }
});

// POST /api/orders — создание заказа
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'client') return errorResponse('Только клиенты могут создавать заказы', 403);
    if (user.isGuest) return errorResponse('Гости не могут создавать заказы. Зарегистрируйтесь.', 403);

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

    const { masterServiceId: legacyServiceId, masterServiceIds, nailDesignId, nailMasterId, requestedDateTime, description, clientNotes } = parsed.data;
    const serviceIds = masterServiceIds || (legacyServiceId ? [legacyServiceId] : []);

    // Fetch all selected services
    const selectedServices = await db.select().from(schema.masterServices)
      .where(inArray(schema.masterServices.id, serviceIds));

    if (!selectedServices.length) return errorResponse('Услуги не найдены', 404);

    // Calculate total price and duration from all services
    let totalPrice = selectedServices.reduce((sum, s) => sum + parseFloat(s.price.toString()), 0);
    let additionalDuration = 0;
    const firstServiceId = selectedServices[0].id;

    // If design selected, add its surcharge
    if (nailDesignId) {
      const serviceDesigns = await db.select().from(schema.masterServiceDesigns)
        .where(and(
          eq(schema.masterServiceDesigns.masterServiceId, firstServiceId),
          eq(schema.masterServiceDesigns.nailDesignId, nailDesignId),
          eq(schema.masterServiceDesigns.isActive, true),
        )).limit(1);

      if (serviceDesigns.length > 0 && serviceDesigns[0].customPrice) {
        totalPrice += parseFloat(serviceDesigns[0].customPrice.toString());
        additionalDuration = serviceDesigns[0].additionalDuration || 0;
      }
      await db.update(schema.nailDesigns)
        .set({ ordersCount: sql`${schema.nailDesigns.ordersCount} + 1` })
        .where(eq(schema.nailDesigns.id, nailDesignId));
    }

    // Create design snapshot
    let designSnapshotId: string | null = null;
    if (nailDesignId) {
      const snapshot = await createDesignSnapshot(nailDesignId);
      if (snapshot) designSnapshotId = snapshot.id;
    }

    // Create single order with all services
    const serviceNames = selectedServices.map(s => s.name).join(', ');
    const [order] = await db.insert(schema.orders).values({
      description: description || serviceNames,
      status: 'pending',
      price: String(totalPrice),
      requestedDateTime: new Date(requestedDateTime),
      clientNotes: clientNotes || null,
      additionalDuration: additionalDuration || null,
      clientId: user.userId,
      nailMasterId,
      masterServiceId: firstServiceId,
      serviceIds,
      nailDesignId: nailDesignId || null,
      designSnapshotId,
    }).returning();

    logger.info({ orderId: order.id, userId: user.userId }, 'Order created');

    // Send notification to master
    await db.insert(schema.notifications).values({
      type: 'order_created', title: 'Новый заказ',
      message: `Новая запись на ${new Date(requestedDateTime).toLocaleDateString('ru')}`,
      recipientId: nailMasterId, relatedOrderId: order.id,
    });

    return successResponse(order, 'Заказ создан', 201);
  } catch (error) {
    logger.error(error, 'Create order error');
    return errorResponse('Ошибка создания заказа', 500);
  }
});

// sql is already imported at top
