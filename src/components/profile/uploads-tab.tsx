'use client';

import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { DesignCard } from '@/components/design/design-card';

interface Design { id: string; title: string; images: string[]; likesCount: number; }

export function UploadsTab() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;
    fetch('/api/designs?includeOwn=true&limit=100', { headers: { Authorization: `Bearer ${token!}` } })
      .then(r => r.json()).then(j => {
        const all = j.data || [];
        // Filter: only designs uploaded by current user
        const mine = all.filter((d: any) =>
          d.uploadedByClientId === userId || d.uploadedByMasterId === userId
        );
        setDesigns(mine);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!designs.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
        <Upload className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Нет загруженных дизайнов</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Создайте новый дизайн — он появится здесь</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {designs.map(d => <DesignCard key={d.id} design={d} />)}
    </div>
  );
}
