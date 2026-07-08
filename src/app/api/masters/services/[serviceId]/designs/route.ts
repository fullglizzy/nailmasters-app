import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

// GET — получить дизайны, привязанные к услуге
export const GET = withAuth(async (_req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) => {
  const { serviceId } = await params;
  const designs = await db.select().from(schema.masterServiceDesigns)
    .where(and(eq(schema.masterServiceDesigns.masterServiceId, serviceId), eq(schema.masterServiceDesigns.isActive, true)));
  return successResponse(designs);
});
