'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { logger } from '@/lib/logger';

/**
 * Возвращает общее количество непрочитанных сообщений.
 * Обновляется при монтировании и через SSE / поллинг.
 */
export function useUnreadMessages() {
  const [count, setCount] = useState(0);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchCount = () => {
      const token = getToken();
      if (!token) return;
      fetch('/api/messages?unread=1', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(json => { if (json.success) setCount(json.data?.total || 0); })
        .catch((error) => { logger.error(error, 'useUnreadMessages fetch failed'); });
    };

    fetchCount();

    // Поллинг каждые 10 секунд + слушаем событие фокуса (вернулись во вкладку)
    const interval = setInterval(fetchCount, 10000);
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [getToken]);

  return count;
}
