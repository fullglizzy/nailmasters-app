'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface GeoCoords {
  latitude: number;
  longitude: number;
}

interface UseGeolocationResult {
  coords: GeoCoords | null;
  error: string | null;
  loading: boolean;
  request: () => void;
}

/**
 * Хук для получения координат клиента.
 * Приоритет: browser Geolocation API (точный) → IP-геолокация (приблизительный).
 * Координаты кешируются в localStorage на 30 минут.
 */
export function useGeolocation(): UseGeolocationResult {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestedRef = useRef(false);

  // Восстанавливаем из кеша при монтировании
  useEffect(() => {
    try {
      const cached = localStorage.getItem('geo_coords');
      if (cached) {
        const entry = JSON.parse(cached);
        // Проверяем срок годности (30 мин) и валидность координат
        if (entry.ts && Date.now() - entry.ts < 30 * 60 * 1000) {
          const lat = Number(entry.latitude);
          const lon = Number(entry.longitude);
          if (lat && lon && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
            setCoords({ latitude: lat, longitude: lon });
            requestedRef.current = true;
            return;
          }
        }
      }
    } catch { /* ignore corrupt cache */ }
  }, []);

  const request = useCallback(() => {
    // Уже получили или запрашиваем — не спамим
    if (coords || loading || requestedRef.current) return;

    console.log('[geo] request() called');

    // Способ 1: Browser Geolocation API
    if (navigator.geolocation) {
      console.log('[geo] trying navigator.geolocation...');
      requestedRef.current = true;
      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          console.log('[geo] success via browser:', c);
          setCoords(c);
          setLoading(false);
          try {
            localStorage.setItem('geo_coords', JSON.stringify({ ...c, ts: Date.now() }));
          } catch {}
        },
        (err) => {
          console.warn('[geo] browser geolocation failed, code:', err.code, 'msg:', err.message);
          setLoading(false);
          // Fallback: IP-геолокация
          requestIpFallback();
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
      );
    } else {
      console.log('[geo] navigator.geolocation not available');
      // Способ 2: IP-геолокация
      requestIpFallback();
    }
  }, [coords, loading]);

  // IP-based fallback через бесплатный сервис
  const requestIpFallback = useCallback(async () => {
    try {
      console.log('[geo] trying IP fallback...');
      setLoading(true);
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const c = {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
        };
        console.log('[geo] success via IP fallback:', c);
        setCoords(c);
        setError(null);
        try {
          localStorage.setItem('geo_coords', JSON.stringify({ ...c, ts: Date.now() }));
        } catch {}
      } else {
        setError('Не удалось определить местоположение');
      }
    } catch (e) {
      console.warn('[geo] IP fallback failed:', e);
      setError('Не удалось определить местоположение');
    } finally {
      setLoading(false);
    }
  }, []);

  return { coords, error, loading, request };
}
