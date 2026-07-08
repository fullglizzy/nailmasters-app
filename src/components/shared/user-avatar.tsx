'use client';

import { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface Props { userId: string; size?: 'sm' | 'md' | 'lg'; }

export function UserAvatar({ userId, size = 'md' }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState('');

  const sizeClass = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !userId) return;
    // We fetch all profiles in one place — for now, a simple approach
    // The master profile endpoint includes avatar
    fetch(`/api/masters/profile/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setAvatarUrl(json.data.avatarUrl || null);
          setName(json.data.fullName || '');
        }
      })
      .catch(() => {});
  }, [userId]);

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-full object-cover shrink-0 bg-accent`} />;
  }

  return (
    <div className={`${sizeClass} rounded-full bg-accent flex items-center justify-center shrink-0`}>
      <User className={iconSize} />
    </div>
  );
}
