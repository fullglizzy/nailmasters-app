'use client';

import Image from 'next/image';
import { User } from 'lucide-react';

interface Props {
  avatarUrl?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 24, md: 32, lg: 48 } as const;

export function UserAvatar({ avatarUrl, name, size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';

  if (avatarUrl) {
    return (
      <div className={`${sizeClass} relative rounded-full overflow-hidden shrink-0 bg-accent`}>
        <Image src={avatarUrl} alt={name || ''} fill sizes={`${SIZE_MAP[size]}px`} className="object-cover" />
      </div>
    );
  }

  if (name) {
    return (
      <div className={`${sizeClass} rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-accent flex items-center justify-center shrink-0`}>
      <User className={iconSize} />
    </div>
  );
}
