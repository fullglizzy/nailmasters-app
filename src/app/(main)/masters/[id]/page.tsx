'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Star, MapPin, Award, Shield, Clock, Phone, ArrowLeft, Heart, Sparkles, Calendar, Check } from 'lucide-react';
import { BookingModal } from '@/components/booking/booking-modal';
import { DesignCard } from '@/components/design/design-card';
import { ReviewModal } from '@/components/review/review-modal';

interface MasterProfile {
  userId: string; fullName: string; description: string | null; city: string | null;
  rating: string; totalOrders: number; reviewsCount: number; specialties: string[] | null;
  startingPrice: string | null; experience: string | null; workFormat: string[] | null;
  sterilization: boolean; disposableTools: boolean; phone: string;
  services: { id: string; name: string; price: string; duration: number }[];
}

interface Design { id: string; title: string; images: string[]; likesCount: number; }

export default function MasterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [master, setMaster] = useState<MasterProfile | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const isGuest = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}')?.isGuest : false;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/masters/profile/${id}`).then((r) => r.json()),
      fetch(`/api/designs/master/${id}`).then((r) => r.json()),
    ]).then(([masterJson, designsJson]) => {
      if (masterJson.success) setMaster(masterJson.data);
      if (designsJson.success) setDesigns(designsJson.data || []);
    }).finally(() => setLoading(false));
  }, [id]);

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-4 w-48 skeleton rounded-full" />
        <div className="rounded-2xl border border-border/40 bg-card p-8">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="h-24 w-24 rounded-full skeleton shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-56 skeleton" />
              <div className="h-5 w-72 skeleton" />
              <div className="flex gap-3">
                <div className="h-5 w-24 skeleton rounded-full" />
                <div className="h-5 w-32 skeleton rounded-full" />
                <div className="h-5 w-28 skeleton rounded-full" />
              </div>
            </div>
            <div className="h-10 w-36 skeleton rounded-full shrink-0" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-7 w-40 skeleton" />
          {[1,2,3].map(i => <div key={i} className="h-16 w-full skeleton rounded-xl" />)}
        </div>
      </div>
    </div>
  );

  if (!master) return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
        <Shield className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <h1 className="font-display text-2xl mb-2">Мастер не найден</h1>
      <p className="text-muted-foreground mb-6 text-sm">Возможно, страница была удалена или указан неверный адрес</p>
      <Link href="/masters" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
        К каталогу мастеров
      </Link>
    </div>
  );

  const hasHygiene = master.sterilization || master.disposableTools;
  const hygieneLabel = [
    master.sterilization && 'Стерилизация',
    master.disposableTools && 'Одноразовые материалы',
  ].filter(Boolean).join(' · ');

  const StatPill = ({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string | number; label: string }) => (
    <div className="flex items-center gap-1.5 rounded-full border border-border/40 px-3 py-1 text-xs">
      <Icon className="h-3.5 w-3.5 text-gold" />
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <Link href="/masters" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> К каталогу мастеров
        </Link>

        {/* ── Profile Header ── */}
        <div className="rounded-2xl border border-border/40 bg-card p-8 mb-8">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              {(master as any).avatarUrl ? (
                <img src={(master as any).avatarUrl} alt={master.fullName} className="h-[88px] w-[88px] rounded-full object-cover ring-2 ring-primary/[0.08]" />
              ) : (
                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-primary/[0.06] ring-2 ring-primary/[0.08]">
                  <span className="font-display text-[40px] text-primary">{master.fullName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl">{master.fullName}</h1>

                  {/* Stats pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <StatPill icon={Star} value={master.rating} label={`(${master.reviewsCount})`} />
                    <StatPill icon={Calendar} value={master.totalOrders} label="заказов" />
                    {master.experience && (
                      <StatPill icon={Award} value={master.experience} label="опыта" />
                    )}
                  </div>

                  {/* Info line */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
                    {master.city && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 opacity-60" />{master.city}
                      </span>
                    )}
                    {master.workFormat && master.workFormat.length > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 opacity-60" />
                        {master.workFormat.map(f => f === 'salon' ? 'Салон' : f === 'home' ? 'На дому' : f).join(' · ')}
                      </span>
                    )}
                    {hasHygiene && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-secondary">
                        <Sparkles className="h-3.5 w-3.5" />{hygieneLabel}
                      </span>
                    )}
                    {master.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 opacity-60" />{master.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sticky mobile CTA */}
                <div className="fixed bottom-20 md:hidden left-4 right-4 z-30">
                  {isGuest ? (
                    <a href="/auth" className="block w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg text-center">
                      Зарегистрируйтесь для записи
                    </a>
                  ) : (
                    <button
                      onClick={() => setShowBooking(true)}
                      className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
                    >
                      Записаться{master.startingPrice ? ` · от ${parseInt(master.startingPrice).toLocaleString('ru-RU')} ₽` : ''}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {master.description && (
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-5">
              {master.description}
            </p>
          )}

          {/* Specialties */}
          {master.specialties && master.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {master.specialties.map((s) => (
                <span key={s} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground/80">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Services ── */}
        {master.services && master.services.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Услуги</p>
                <h2 className="font-display text-2xl">Услуги и цены</h2>
              </div>
              {isGuest ? (
                <a href="/auth" className="hidden md:inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                  Зарегистрироваться
                </a>
              ) : (
                <button onClick={() => setShowBooking(true)} className="hidden md:inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                  Записаться
                </button>
              )}
            </div>
            <div className="grid gap-2">
              {master.services.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-xl border border-border/40 bg-card px-5 py-4 transition-all duration-200 group ${
                    isGuest ? '' : 'hover:border-primary/30 hover:shadow-sm cursor-pointer'
                  }`}
                  onClick={() => { if (!isGuest) setShowBooking(true); }}
                >
                  <div className="min-w-0 mr-4">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{s.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />{s.duration} мин
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/[0.06] px-3.5 py-1.5 text-sm font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    {parseInt(s.price).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Designs ── */}
        {designs.length > 0 && (
          <section className="mb-8">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Портфолио</p>
              <h2 className="font-display text-2xl">Дизайны мастера</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {designs.map((d, i) => (
                <DesignCard key={d.id} design={d} href={`/explore/${d.id}`} delay={Math.min(i * 40, 300)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty portfolio ── */}
        {designs.length === 0 && !loading && master && (
          <section className="mb-8">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Портфолио</p>
              <h2 className="font-display text-2xl">Дизайны мастера</h2>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-border/40 bg-card/50">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/30">
                <Sparkles className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">Мастер пока не добавил свои дизайны</p>
            </div>
          </section>
        )}

        {/* Reviews */}
        <MasterReviews masterId={id} onReviewClick={() => setShowReview(true)} />

        {/* Booking Modal */}
        {showBooking && (
          <BookingModal
            masterId={id}
            masterName={master.fullName}
            masterInfo={{ fullName: master.fullName, rating: master.rating, city: master.city, reviewsCount: master.reviewsCount }}
            onClose={() => setShowBooking(false)}
          />
        )}
        {showReview && <ReviewModal open={showReview} onClose={() => setShowReview(false)} masterId={id} masterName={master.fullName} onSubmitted={() => {}} />}
      </div>
    </div>
  );
}

function MasterReviews({ masterId, onReviewClick }: { masterId: string; onReviewClick: () => void }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/master-rating/${masterId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setReviews(j.data || []); })
      .finally(() => setLoading(false));
  }, [masterId]);

  if (loading) return <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Отзывы</p>
          <h2 className="font-display text-2xl">Что говорят клиенты</h2>
        </div>
        <button onClick={onReviewClick} className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20 transition-colors">
          <Star className="h-4 w-4 fill-gold text-gold" />Оставить отзыв
        </button>
      </div>
      {!reviews.length ? (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed border-border/40 bg-card/50">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/30">
            <Star className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">Пока нет отзывов</p>
          <button onClick={onReviewClick} className="mt-3 rounded-full border border-gold/40 px-4 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
            Станьте первым
          </button>
        </div>
      ) : (
      <div className="space-y-3">
        {reviews.slice(0, 10).map((r: any) => (
          <div key={r.id} className="rounded-xl border border-border/40 bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              {r.clientAvatar ? (
                <img src={r.clientAvatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold shrink-0">
                  {(r.clientName || '?').charAt(0)}
                </div>
              )}
              <span className="text-sm font-medium">{r.clientName || 'Клиент'}</span>
            </div>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`h-4 w-4 ${s <= r.ratingNumber ? 'fill-gold text-gold' : 'text-muted-foreground/20'}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(r.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            {r.description && <p className="text-sm text-muted-foreground leading-relaxed">{r.description}</p>}
          </div>
        ))}
      </div>
      )}
    </section>
  );
}
