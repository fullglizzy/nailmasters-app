import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, gte } from 'drizzle-orm';
import { successResponse } from '@/lib/response';
import { format } from 'date-fns';

export async function GET(req: NextRequest, { params }: { params: Promise<{ masterId: string }> }) {
  const { masterId } = await params;
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const datesOnly = url.searchParams.get('dates') === '1';

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const conditions = [
    eq(schema.schedules.masterId, masterId),
    eq(schema.schedules.status, 'available'),
    gte(schema.schedules.workDate, todayStr),
  ];

  if (date) {
    conditions.push(eq(schema.schedules.workDate, date));
    const currentTime = format(new Date(), 'HH:mm');
    if (date === todayStr) {
      conditions.push(gte(schema.schedules.startTime, currentTime));
    }
  }

  const slots = await db.select().from(schema.schedules).where(and(...conditions));

  if (datesOnly) {
    const dates = [...new Set(slots.map(s => s.workDate))].sort();
    return successResponse(dates);
  }

  const trimmed = slots.map(s => ({ ...s, startTime: s.startTime?.slice(0, 5), endTime: s.endTime?.slice(0, 5) }));
  return successResponse(trimmed);
}
