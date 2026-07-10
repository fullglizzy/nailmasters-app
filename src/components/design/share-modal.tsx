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
  const shareText = encodeURIComponent(`Check out this nail design: ${title}`);

  const shareLinks = [
    {
      name: 'Instagram',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      // Instagram doesn't support direct share URLs — copies link and opens Instagram
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Link copied — paste in Instagram');
        } catch {
          toast.error('Could not copy link');
        }
        window.open('https://instagram.com', '_blank');
      },
      color: 'hover:bg-[#E4405F]/10',
    },
    {
      name: 'Pinterest',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
        </svg>
      ),
      href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
      color: 'hover:bg-[#E60023]/10',
    },
    {
      name: 'Facebook',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385h-3.047v-3.47h3.047v-2.642c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385c5.738-.901 10.126-5.866 10.126-11.855z"/>
        </svg>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
      color: 'hover:bg-[#1877F2]/10',
    },
    {
      name: 'X',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${shareText}`,
      color: 'hover:bg-black/10 dark:hover:bg-white/10',
    },
    {
      name: 'Message',
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.25 2H3.75C2.233 2 1 3.233 1 4.75v10.5c0 1.517 1.233 2.75 2.75 2.75h5.5l3.75 4.5 3.75-4.5h5.5c1.517 0 2.75-1.233 2.75-2.75V4.75C23 3.233 21.767 2 20.25 2zm-9.75 10.5l-5-3.75v-1.5l5 3.75 5-3.75v1.5l-5 3.75z"/>
        </svg>
      ),
      href: `sms:?body=${shareText}%20${encodedUrl}`,
      color: 'hover:bg-[#34C759]/10',
    },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        onClose();
      } catch { /* user cancelled */ }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share this design"
        className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />Share
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-muted/50 transition-colors">
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
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            copied ? 'bg-secondary/10 text-secondary' : 'bg-muted/40 text-muted-foreground'
          }`}>
            {copied ? <Check className="h-5 w-5" /> : <LinkIcon className="h-5 w-5" />}
          </div>
          <div className="text-left min-w-0">
            <div className="font-semibold">{copied ? 'Copied!' : 'Copy link'}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[220px]">{url}</div>
          </div>
        </button>

        {/* Social share links */}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Share via</p>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {shareLinks.map((link) =>
            link.href ? (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={`flex flex-col items-center gap-1.5 rounded-xl border border-border/40 py-3 text-xs font-medium transition-all ${link.color} hover:border-border`}
              >
                {link.icon}
                <span>{link.name}</span>
              </a>
            ) : (
              <button
                key={link.name}
                onClick={link.onClick}
                className={`flex flex-col items-center gap-1.5 rounded-xl border border-border/40 py-3 text-xs font-medium transition-all ${link.color} hover:border-border`}
              >
                {link.icon}
                <span>{link.name}</span>
              </button>
            )
          )}
        </div>

        {/* Native share (mobile) */}
        {'share' in navigator && (
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-border/60 py-2.5 text-sm font-medium hover:bg-surface transition-colors"
          >
            <Share2 className="h-4 w-4" />More options
          </button>
        )}
      </div>
    </div>
  );
}
