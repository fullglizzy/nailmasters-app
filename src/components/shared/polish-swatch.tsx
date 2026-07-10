'use client';

import { cn } from '@/lib/utils';

export interface PolishColor {
  name: string;
  value: string;
  hex: string;
}

interface PolishSwatchProps {
  color: PolishColor;
  selected: boolean;
  onSelect: (value: string) => void;
  size?: 'sm' | 'md';
}

/**
 * PolishSwatch — glassy color selector that mimics nail polish bottles.
 *
 * The signature interaction of the Polished Glass design system.
 * Each swatch renders as a glossy circle with specular highlight,
 * lifts on hover, and pulses a ripple on selection.
 */
export function PolishSwatch({ color, selected, onSelect, size = 'md' }: PolishSwatchProps) {
  const dims = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const labelClass = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  return (
    <button
      onClick={() => onSelect(color.value)}
      aria-label={color.name}
      aria-pressed={selected}
      title={color.name}
      className={cn(
        'group flex flex-col items-center gap-1.5',
        'focus-visible:outline-none focus-visible:rounded-lg',
      )}
    >
      <span
        className={cn('polish-swatch shrink-0', dims)}
        style={{ backgroundColor: color.hex }}
      />
      <span
        className={cn(
          labelClass,
          'transition-all duration-200 text-center leading-tight',
          selected
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground group-hover:text-foreground/80',
        )}
      >
        {color.name}
      </span>
    </button>
  );
}

/**
 * PolishSwatchGrid — a responsive grid of polish swatches.
 * Handles the "browsing polish bottles on a shelf" layout.
 */
interface PolishSwatchGridProps {
  colors: PolishColor[];
  selected: string;
  onSelect: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function PolishSwatchGrid({
  colors,
  selected,
  onSelect,
  size = 'md',
  className,
}: PolishSwatchGridProps) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-3', className)}>
      {colors.map((c) => (
        <PolishSwatch
          key={c.value}
          color={c}
          selected={selected === c.value}
          onSelect={onSelect}
          size={size}
        />
      ))}
    </div>
  );
}
