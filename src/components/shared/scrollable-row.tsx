'use client';

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  children: ReactNode;
  className?: string;
  /** Отступ для правого фейда (если контент выходит за padding) */
  fadeRightOffset?: string;
  /** Отключить фейды по краям */
  noFade?: boolean;
}

/**
 * Горизонтально скроллимый ряд с фейдами по краям и кнопками-стрелками.
 * Скролл колёсиком мыши работает по горизонтали.
 */
export function ScrollableRow({ children, className = '', fadeRightOffset, noFade }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    el.addEventListener('scroll', check, { passive: true });
    // Проверяем при ресайзе
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [check]);

  // Скролл колёсиком по горизонтали
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="relative group/scroll">
      {/* Левый фейд + стрелка */}
      {canScrollLeft && (
        <>
          {!noFade && (
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none z-10 rounded-l-inherit" />
          )}
          <button
            onClick={() => scroll('left')}
            className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border/40 shadow-sm text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover/scroll:opacity-100"
            aria-label="Прокрутить влево"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Правый фейд + стрелка */}
      {canScrollRight && (
        <>
          {!noFade && (
            <div
              className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none z-10 rounded-r-inherit"
              style={fadeRightOffset ? { right: fadeRightOffset } : undefined}
            />
          )}
          <button
            onClick={() => scroll('right')}
            className="absolute -right-1 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border/40 shadow-sm text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover/scroll:opacity-100"
            aria-label="Прокрутить вправо"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Скролл-контейнер */}
      <div ref={ref} className={`overflow-x-auto hide-scrollbar ${className}`}>
        {children}
      </div>
    </div>
  );
}
