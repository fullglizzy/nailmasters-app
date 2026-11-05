import { successResponse } from '@/lib/response';
import { envBool } from '@/lib/env';

export const dynamic = 'force-dynamic';

type DemoRole = 'admin' | 'client' | 'nailmaster';

interface DemoAccountDef {
  role: DemoRole;
  label: string;
  phone?: string;
}

// GET /api/auth/demo-accounts — список тестовых учёток для быстрого входа.
// Всё управляется env; при выключенном флаге телефоны наружу не отдаются.
export async function GET() {
  if (!envBool('AUTH_DEMO_LOGIN_ENABLED')) {
    return successResponse({ enabled: false, accounts: [], code: null });
  }

  const defs: DemoAccountDef[] = [
    { role: 'admin', label: 'Админ', phone: process.env.AUTH_DEMO_ADMIN_PHONE },
    { role: 'client', label: 'Клиент', phone: process.env.AUTH_DEMO_CLIENT_PHONE },
    { role: 'nailmaster', label: 'Мастер', phone: process.env.AUTH_DEMO_MASTER_PHONE },
  ];

  const accounts = defs
    .filter((a): a is DemoAccountDef & { phone: string } => !!a.phone)
    .map((a) => ({ role: a.role, label: a.label, phone: a.phone }));

  return successResponse({
    enabled: accounts.length > 0,
    accounts,
    // Код нужен для автоматического подтверждения в тестовом режиме (SMS выключен)
    code: process.env.AUTH_DEMO_OTP_CODE || '000000',
  });
}
