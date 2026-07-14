'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Calendar, Clock, Check, X, Phone, MapPin, ChevronDown,
  MessageSquare, Sparkles, Star, Loader2, ExternalLink,
} from 'lucide-react';
import { ReviewModal } from '@/components/review/review-modal';
import { useOrders } from '@/hooks/api';
import { useAuth } from '@/components/providers/auth-provider';
import type { OrderEnriched } from '@/lib/types';

/* ── Constants ──────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', alternative_proposed: 'Time proposed',
  declined: 'Declined', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gold/15 text-gold border-gold/30',
  confirmed: 'bg-secondary/15 text-secondary border-secondary/30',
  alternative_proposed: 'bg-gold/15 text-gold border-gold/30',
  completed: 'bg-primary/10 text-primary border-primary/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
  declined: 'bg-destructive/10 text-destructive border-destructive/30',
};

/* ═════════════════════════════════════════════════════════
   BookingsTab
   ═════════════════════════════════════════════════════════ */

export function BookingsTab() {
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { user, getToken } = useAuth();
  const role = user?.role || '';
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewMaster, setReviewMaster] = useState<{ id: string; name: string } | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('just_booked')) {
      sessionStorage.removeItem('just_booked');
      setTimeout(() => setBookingSuccess(true), 300);
    }
  }, []);

  const handleAction = async (orderId: string, action: string, body?: Record<string, unknown>) => {
    const token = getToken();
    if (!token) return;
    setActingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
    } finally {
      refetch();
      setActingId(null);
    }
  };

  const sorted = [...orders].sort(
    (a, b) => new Date(b.requestedDateTime).getTime() - new Date(a.requestedDateTime).getTime()
  );
  const grouped: Record<string, OrderEnriched[]> = {};
  sorted.forEach((o) => {
    const key = new Date(o.requestedDateTime).toLocaleDateString('ru', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    (grouped[key] ??= []).push(o);
  });

  if (bookingSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-6xl mb-6">✅</div>
        <h2 className="text-2xl font-bold mb-3">Booked!</h2>
        <p className="text-muted-foreground mb-8 max-w-sm leading-relaxed">
          The master will confirm your appointment. Track the status here.
        </p>
        <button
          onClick={() => setBookingSuccess(false)}
          className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Got it
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
          <Calendar className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No orders yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {role === 'nailmaster'
            ? 'When clients book your services, orders will appear here'
            : 'Browse designs and book a master — your orders will show up here'}
        </p>
      </div>
    );
  }

  const isMaster = role === 'nailmaster';

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([dateLabel, dayOrders]) => (
        <div key={dateLabel}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
            {dateLabel}
          </p>
          <div className="space-y-3">
            {dayOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                isMaster={isMaster}
                isExpanded={expandedId === o.id}
                isActing={actingId === o.id}
                onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
                onAction={handleAction}
                onReview={(masterId, masterName) => setReviewMaster({ id: masterId, name: masterName })}
              />
            ))}
          </div>
        </div>
      ))}

      {reviewMaster && (
        <ReviewModal
          open={!!reviewMaster}
          onClose={() => setReviewMaster(null)}
          onSubmitted={refetch}
          masterId={reviewMaster.id}
          masterName={reviewMaster.name}
        />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
   OrderCard — mobile-first, fully clickable
   ═════════════════════════════════════════════════════════ */

interface OrderCardProps {
  order: OrderEnriched;
  isMaster: boolean;
  isExpanded: boolean;
  isActing: boolean;
  onToggle: () => void;
  onAction: (orderId: string, action: string) => void;
  onReview: (masterId: string, masterName: string) => void;
}

function OrderCard({ order: o, isMaster, isExpanded, isActing, onToggle, onAction, onReview }: OrderCardProps) {
  const status = o.status as string;
  const price = o.price ? parseInt(String(o.price)).toLocaleString('en-US') : null;
  const time = o.requestedDateTime
    ? new Date(o.requestedDateTime).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    : null;
  const dateFormatted = o.requestedDateTime
    ? new Date(o.requestedDateTime).toLocaleDateString('ru', { day: 'numeric', month: 'long' })
    : null;

  const counterpartyName = isMaster ? o._client?.name : o._master?.name;
  // Master profiles are at /masters/[userId]; clients don't have public profiles
  const counterpartyLink = !isMaster && o.nailMasterId ? `/masters/${o.nailMasterId}` : null;
  const counterpartyPhone = isMaster ? o._client?.phone : o._master?.phone;
  const counterpartyAddress = isMaster ? undefined : o._master?.address;

  const designImage = o._design?.images?.[0];
  const designTitle = o._design?.title || 'View design';
  const designId = o.nailDesignId;

  /* ── Quick actions visible without expanding ──── */
  const quickAction =
    status === 'pending' && isMaster
      ? { label: 'Confirm', action: 'confirm', color: 'bg-secondary text-white hover:bg-secondary/90' }
      : status === 'confirmed' && isMaster
        ? { label: 'Complete', action: 'complete', color: 'bg-primary text-white hover:bg-primary/90' }
        : status === 'completed' && !isMaster && o._master
          ? { label: 'Review', action: 'review', color: 'bg-gold/10 text-gold hover:bg-gold/20' }
          : null;

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden transition-all hover:border-border/60 active:scale-[0.99]">
      {/* ═══ Header: always visible ═══ */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        {/* Design thumbnail */}
        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden shrink-0 bg-muted relative mt-0.5">
          {designImage ? (
            <Image src={designImage} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Sparkles className="h-5 w-5 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Core info — stacks vertically on narrow screens */}
        <div className="flex-1 min-w-0">
          {/* Row 1: status + price */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground'}`}>
              {STATUS_LABELS[status] || status}
            </span>
            {price && <span className="text-sm font-bold">${price}</span>}
          </div>

          {/* Row 2: counterparty (clickable) + time */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {counterpartyName && (
              counterpartyLink ? (
                <Link
                  href={counterpartyLink}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium text-foreground/80 truncate hover:text-primary hover:underline transition-colors"
                >
                  {counterpartyName}
                </Link>
              ) : (
                <span className="text-sm font-medium text-foreground/80 truncate">{counterpartyName}</span>
              )
            )}
            {time && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="h-3 w-3" />{time}
              </span>
            )}
          </div>

          {/* Row 3: design title */}
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{designTitle}</p>
        </div>

        {/* Right: quick action or chevron */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {quickAction ? (
            isActing ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (quickAction.action === 'review') {
                    onReview(o.nailMasterId, o._master?.name || '');
                  } else {
                    onAction(o.id, quickAction.action);
                  }
                }}
                className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${quickAction.color}`}
              >
                {quickAction.label}
              </span>
            )
          ) : null}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${!quickAction ? 'mt-1' : ''}`} />
        </div>
      </button>

      {/* ═══ Expanded detail ═══ */}
      {isExpanded && (
        <div className="border-t border-border/30 p-4 space-y-3 bg-card/20 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Design link — full row, opens new tab */}
          {designId && (
            <Link
              href={`/explore/${designId}`}
              target="_blank"
              className="flex items-center gap-3 rounded-lg bg-background p-3 hover:bg-accent/50 transition-colors group active:scale-[0.98]"
            >
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden shrink-0 bg-muted relative">
                {designImage ? (
                  <Image src={designImage} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Sparkles className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Design</div>
                <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{designTitle}</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
            </Link>
          )}

          {/* Clickable metadata — single column on mobile */}
          <div className="space-y-2 text-sm">
            {/* Counterparty: clickable profile + phone */}
            {counterpartyName && (
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2.5">
                <span className="text-muted-foreground text-xs">{isMaster ? 'Client' : 'Master'}</span>
                <div className="flex items-center gap-2">
                  {counterpartyLink ? (
                    <Link href={counterpartyLink} className="font-medium text-foreground hover:text-primary hover:underline transition-colors text-xs">
                      {counterpartyName}
                    </Link>
                  ) : (
                    <span className="font-medium text-xs">{counterpartyName}</span>
                  )}
                  {counterpartyPhone && (
                    <a href={`tel:${counterpartyPhone}`} className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
                      <Phone className="h-3 w-3" />{counterpartyPhone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Address — clickable, opens maps */}
            {counterpartyAddress && (
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2.5">
                <span className="text-muted-foreground text-xs">Address</span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(counterpartyAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <MapPin className="h-3 w-3" />{counterpartyAddress}
                </a>
              </div>
            )}

            {/* Date + Time */}
            {dateFormatted && (
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2.5">
                <span className="text-muted-foreground text-xs">Date & time</span>
                <span className="text-xs font-medium">
                  {dateFormatted}{time ? ` at ${time}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {o.clientNotes && (
            <p className="text-xs text-muted-foreground bg-background rounded-lg p-3">
              <span className="font-medium">Notes:</span> {o.clientNotes}
            </p>
          )}

          {/* Full action buttons — full width on mobile */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {status === 'pending' && isMaster && (
              <>
                <ActionBtn icon={Check} label="Confirm appointment" color="w-full sm:w-auto bg-secondary text-white hover:bg-secondary/90" disabled={isActing} onClick={() => onAction(o.id, 'confirm')} />
                <ActionBtn icon={X} label="Decline" color="w-full sm:w-auto bg-destructive/10 text-destructive hover:bg-destructive/20" disabled={isActing} onClick={() => onAction(o.id, 'decline')} />
              </>
            )}
            {status === 'confirmed' && isMaster && (
              <ActionBtn icon={Check} label="Mark as completed" color="w-full sm:w-auto bg-primary text-white hover:bg-primary/90" disabled={isActing} onClick={() => onAction(o.id, 'complete')} />
            )}
            {(status === 'pending' || status === 'confirmed' || status === 'alternative_proposed') && !isMaster && (
              <ActionBtn icon={X} label="Cancel booking" color="w-full sm:w-auto bg-destructive/10 text-destructive hover:bg-destructive/20" disabled={isActing} onClick={() => onAction(o.id, 'cancel')} />
            )}
            {status === 'completed' && !isMaster && o._master && (
              <button
                onClick={() => onReview(o.nailMasterId, o._master?.name || '')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
              >
                <MessageSquare className="h-4 w-4" /> Leave a review
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function ActionBtn({ icon: Icon, label, color, disabled, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; color: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${color}`}
    >
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}
