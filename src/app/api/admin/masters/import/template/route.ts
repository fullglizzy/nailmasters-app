import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { errorResponse } from '@/lib/response';
import { logger } from '@/lib/logger';
import { buildTemplateWorkbook } from '@/lib/masters-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// GET /api/admin/masters/import/template — скачать шаблон импорта
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const buffer = await buildTemplateWorkbook();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition':
          'attachment; filename="nailmasters-master-import-template.xlsx"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error(error, 'GET /api/admin/masters/import/template error');
    return errorResponse('Не удалось сформировать шаблон', 500);
  }
});
