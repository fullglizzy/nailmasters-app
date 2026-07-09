'use client';

import { useState, useEffect } from 'react';

/**
 * Возвращает общее количество непрочитанных сообщений.
 * Обновляется при монтировании и через SSE / поллинг.
 */
export function useUnreadMessages() {
  const [count, setCount] = useState(0);

  const fetchCount = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/messages?unread=1', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setCount(json.data?.total || 0); })
      .catch(() => {});
  };

  useEffect(() => { fetchCount(); }, []);

  // Поллинг каждые 10 секунд + слушаем событие фокуса (вернулись во вкладку)
  useEffect(() => {
    const interval = setInterval(fetchCount, 10000);
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return count;
}
