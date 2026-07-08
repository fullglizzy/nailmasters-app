'use client';

import { useState } from 'react';
import { X, Copy, Check, Share2, Link as LinkIcon } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';
import { toast } from 'sonner';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  designId: string;
}

export function ShareModal({ open, onClose, title, designId }: ShareModalProps) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const url = typeof window !== 'undefined' ? `${window.location.origin}/explore/${designId}` : '';
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    {
      name: 'Telegram',
      icon: '✈️',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-[#2AABEE]/10',
    },
    {
      name: 'WhatsApp',
      icon: '💬',
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: 'hover:bg-[#25D366]/10',
    },
    {
      name: 'ВКонтакте',
      icon: '📘',
      href: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`,
      color: 'hover:bg-[#0077FF]/10',
    },
    {
      name: 'X (Twitter)',
      icon: '𝕏',
      href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-black/10 dark:hover:bg-white/10',
    },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        onClose();
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Поделиться"
        className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />Поделиться
          </h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-1.5 hover:bg-muted/50 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Design title */}
        <p className="text-sm text-muted-foreground mb-5 truncate">{title}</p>

        {/* Copy link */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3.5 text-sm font-medium hover:bg-surface transition-colors mb-4"
        >
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${copied ? 'bg-secondary/10 text-secondary' : 'bg-muted/40 text-muted-foreground'}`}>
            {copied ? <Check className="h-5 w-5" /> : <LinkIcon className="h-5 w-5" />}
          </div>
          <div className="text-left">
            <div className="font-semibold">{copied ? 'Скопировано!' : 'Копировать ссылку'}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[220px]">{url}</div>
          </div>
        </button>

        {/* Social share links */}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Поделиться в соцсетях</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {shareLinks.map(link => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={`flex flex-col items-center gap-1.5 rounded-xl border border-border/40 py-3 text-xs font-medium transition-all ${link.color} hover:border-border`}
            >
              <span className="text-2xl">{link.icon}</span>
              <span>{link.name}</span>
            </a>
          ))}
        </div>

        {/* Native share (mobile only) */}
        {'share' in navigator && (
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-border/60 py-2.5 text-sm font-medium hover:bg-surface transition-colors"
          >
            <Share2 className="h-4 w-4" />Поделиться через систему
          </button>
        )}
      </div>
    </div>
  );
}
