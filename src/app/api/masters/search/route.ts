import { NextRequest } from 'next/server';
import { searchMasters } from '@/lib/search';
import { successResponse } from '@/lib/response';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = {
    query: url.searchParams.get('q') || undefined,
    city: url.searchParams.get('city') || undefined,
    specialty: url.searchParams.get('specialty') || undefined,
    minRating: url.searchParams.get('minRating') ? parseFloat(url.searchParams.get('minRating')!) : undefined,
    page: parseInt(url.searchParams.get('page') || '1'),
    limit: parseInt(url.searchParams.get('limit') || '20'),
  };

  const result = await searchMasters(params);
  return successResponse(result);
}
