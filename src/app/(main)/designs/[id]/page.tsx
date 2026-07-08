'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Heart, MessageCircle, ArrowLeft, Send, Star, MapPin, User, Calendar } from 'lucide-react';
import { useLike } from '@/hooks/use-like';
import { PhotoGalleryModal } from '@/components/design/photo-gallery-modal';

interface DesignDetail {
  id: string; title: string; description: string | null; images: string[];
  videoUrl: string | null; type: string; tags: string[] | null; color: string | null;
  techniques: string[] | null; length: string | null; shape: string | null;
  season: string | null; moodTags: string[] | null; materials: string[] | null;
  likesCount: number; ordersCount: number;
  author: { id: string; name: string; type: string } | null;
  createdAt: string;
}

interface Master { userId: string; fullName: string; rating: string; city: string | null; }
interface Comment { id: string; text: string; authorId: string; createdAt: string; }

export default function DesignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [design, setDesign] = useState<DesignDetail | null>(null);
  const [masters, setMasters] = useState<Master[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { isLiked, likesCount, handleLike } = useLike({
    designId: id || '',
    initialLikesCount: 0,
    initialIsLiked: false,
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/designs/${id}`).then(r => r.json()),
      fetch(`/api/designs/${id}/masters`).then(r => r.json()).catch(() => ({ success: false })),
      fetch(`/api/comments/${id}`).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([designJson, mastersJson, commentsJson]) => {
      if (designJson.success) {
        setDesign(designJson.data);
        // Update like state
      }
      if (mastersJson.success) setMasters(mastersJson.data || []);
      if (commentsJson.success) setComments(commentsJson.data || []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(token ? `/api/designs/${id}/comments` : `/api/comments/${id}/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: newComment }),
      });
      const json = await res.json();
      if (json.success) {
        setComments(prev => [json.data.comment || json.data, ...prev]);
        setNewComment('');
      }
    } catch {}
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;
  if (!design) return <div className="flex min-h-screen flex-col items-center justify-center"><h1 className="text-2xl font-bold mb-2">Дизайн не найден</h1><Link href="/designs" className="text-primary hover:underline">Вернуться в каталог</Link></div>;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <Link href="/designs" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> К каталогу
        </Link>

        <div className="grid md:grid-cols-[1fr_360px] gap-8">
          {/* Left: Images + Info */}
          <div>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {design.images.slice(0, 4).map((img, i) => (
                <button
                  key={i}
                  onClick={() => { setGalleryIndex(i); setShowGallery(true); }}
                  className={`overflow-hidden rounded-xl ${design.images.length === 1 ? 'col-span-2' : i === 0 ? 'row-span-2' : ''}`}
                >
                  <img src={img} alt={design.title} className="w-full h-full object-cover aspect-square hover:scale-105 transition-transform" />
                </button>
              ))}
            </div>

            <h1 className="text-3xl font-bold mb-3">{design.title}</h1>
            {design.description && <p className="text-muted-foreground leading-relaxed mb-6">{design.description}</p>}

            <div className="flex flex-wrap gap-2 mb-6">
              {design.tags?.map(t => (
                <Link key={t} href={`/?tag=${t}`} className="rounded-full bg-accent px-3 py-1 text-xs font-medium hover:bg-accent/80">{t}</Link>
              ))}
            </div>

            {design.techniques && design.techniques.length > 0 && (
              <div className="mb-6"><h3 className="font-semibold mb-2">Техники</h3><div className="flex flex-wrap gap-1">{design.techniques.map(t => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t}</span>)}</div></div>
            )}

            {/* Comments */}
            <div className="border-t pt-6 mt-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Комментарии ({comments.length})</h2>
              <div className="flex gap-3 mb-6">
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Добавить комментарий..."
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                />
                <button onClick={handleAddComment} disabled={!newComment.trim()} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {comments.map(c => (
                <div key={c.id} className="flex gap-3 py-3 border-t">
                  <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold shrink-0"><User className="h-4 w-4" /></div>
                  <div>
                    <div className="text-sm font-medium">Пользователь</div>
                    <p className="text-sm">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Actions + Masters */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 space-y-4 sticky top-20">
              <button onClick={handleLike} className={`w-full flex items-center justify-center gap-2 rounded-full border py-3 text-sm font-medium transition-colors ${isLiked ? 'bg-red-50 border-red-200 text-red-600' : 'hover:bg-accent'}`}>
                <Heart className="h-5 w-5" fill={isLiked ? 'currentColor' : 'none'} /> {likesCount} лайков
              </button>

              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Тип</span><span>{design.type === 'designer' ? 'Дизайнерский' : 'Базовый'}</span></div>
                {design.length && <div className="flex justify-between"><span className="text-muted-foreground">Длина</span><span>{design.length === 'short' ? 'Короткие' : design.length === 'medium' ? 'Средние' : 'Длинные'}</span></div>}
                {design.shape && <div className="flex justify-between"><span className="text-muted-foreground">Форма</span><span>{design.shape.replace('_', ' ')}</span></div>}
                {design.season && <div className="flex justify-between"><span className="text-muted-foreground">Сезон</span><span>{design.season === 'spring' ? 'Весна' : design.season === 'summer' ? 'Лето' : design.season === 'fall' ? 'Осень' : 'Зима'}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Заказов</span><span>{design.ordersCount}</span></div>
              </div>

              {/* Masters who can do this design */}
              {masters.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-sm mb-3">Мастера, которые делают этот дизайн</h3>
                  <div className="space-y-3">
                    {masters.map(m => (
                      <Link key={m.userId} href={`/masters/${m.userId}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                        <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">{m.fullName.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{m.fullName}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {m.rating}
                            {m.city && <span>· {m.city}</span>}
                          </div>
                        </div>
                        <Calendar className="h-4 w-4 text-primary" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showGallery && (
        <PhotoGalleryModal images={design.images} initialIndex={galleryIndex} onClose={() => setShowGallery(false)} />
      )}
    </div>
  );
}
