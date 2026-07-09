'use client';

import { useEffect, useRef } from 'react';

export interface WsMessage {
  type: string;
  data?: unknown;
  [key: string]: unknown;
}

type MessageHandler = (msg: WsMessage) => void;

/**
 * Простой WebSocket хук — одно соединение на вызов.
 * Подключается, аутентифицируется, подписывается на канал.
 * Автоматически переподключается при обрыве (с задержкой 5с).
 * Закрывается при размонтировании компонента.
 */
export function useWebSocket(channel: string, onMessage?: MessageHandler) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (!mountedRef.current) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          ws?.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const msg: WsMessage = JSON.parse(event.data);
            if (msg.type === 'auth_success') {
              ws?.send(JSON.stringify({ type: 'subscribe', channel }));
            } else if (msg.type !== 'pong') {
              onMessageRef.current?.(msg);
            }
          } catch { /* ignore */ }
        };

        ws.onclose = () => {
          ws = null;
          if (mountedRef.current) {
            reconnectRef.current = setTimeout(connect, 5000);
          }
        };
      } catch { /* WebSocket не поддерживается */ }
    };

    connect();

    // Keepalive пинг каждые 25 секунд
    const pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      mountedRef.current = false;
      clearInterval(pingTimer);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws?.close();
    };
  }, [channel]);
}
