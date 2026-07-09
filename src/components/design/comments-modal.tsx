'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Send, Heart, CornerDownRight } from 'lucide-react';
import { UserAvatar } from '@/components/shared/user-avatar';
import { AuthGuardModal, getAuthToken } from '@/components/auth/auth-guard-modal';
import { useComments } from '@/hooks/api';

interface Comment {
  id: string; text: string; authorId: string;
  parentCommentId: string | null;
  likesCount: number; createdAt: string;
  replies?: Comment[];
  author?: { id: string; name: string; avatarUrl?: string | null };
}

interface Props {
  designId: string; designTitle: string; open: boolean; onClose: () => void;
  /** Вызывается после добавления комментария — чтобы родитель обновил счётчик */
  onCommentAdded?: () => void;
}

export function CommentsModal({ designId, designTitle, open, onClose, onCommentAdded }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAuthGuard, setShowAuthGuard] = useState(false);

  // Load comments via React Query
  const { data: commentsData, isLoading } = useComments(designId);

  // Process and store comments when data arrives
  useEffect(() => {
    if (!commentsData) return;
    // API отдаёт новые первыми — переворачиваем: старые сверху, новые снизу
    setComments(groupComments([...(commentsData as Comment[])].reverse()));
    // Reset
    setText(''); setReplyingTo(null); setReplyText('');
  }, [commentsData]);

  // Reset inputs when modal opens
  useEffect(() => {
    if (open) {
      setText(''); setReplyingTo(null); setReplyText('');
    }
  }, [open]);

  // Group replies under parents
  const groupComments = (all: Comment[]): Comment[] => {
    const main: Comment[] = [];
    const replyMap: Record<string, Comment[]> = {};
    all.forEach(c => {
      if (c.parentCommentId) {
        (replyMap[c.parentCommentId] ??= []).push(c);
      } else {
        main.push({ ...c, replies: [] });
      }
    });
    return main.map(c => ({ ...c, replies: replyMap[c.id] || [] }));
  };

  const sendComment = useCallback(async (body: { text: string; parentCommentId?: string }) => {
    if (!body.text.trim()) return;
    const token = getAuthToken();
    if (!token) { setShowAuthGuard(true); return; }
    try {
      const res = await fetch(`/api/designs/${designId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        const newComment = json.data.comment || json.data;
        if (body.parentCommentId) {
          setComments(prev => prev.map(c =>
            c.id === body.parentCommentId
              ? { ...c, replies: [...(c.replies || []), newComment] }
              : c
          ));
        } else {
          setComments(prev => [...prev, { ...newComment, replies: [] }]);
        }
        onCommentAdded?.();
        return true;
      }
    } catch {}
    return false;
  }, [designId]);

  const handleLikeComment = async (commentId: string) => {
    const token = getAuthToken();
    if (!token) { setShowAuthGuard(true); return; }
    try {
      await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setLikedIds(prev => {
        const next = new Set(prev);
        if (next.has(commentId)) {
          next.delete(commentId);
        } else {
          next.add(commentId);
        }
        return next;
      });
      setComments(prev => prev.map(c => toggleLikeRecursive(c, commentId)));
    } catch {}
  };

  const toggleLikeRecursive = (c: Comment, targetId: string): Comment => {
    if (c.id === targetId) return { ...c, likesCount: likedIds.has(targetId) ? c.likesCount - 1 : c.likesCount + 1 };
    if (c.replies?.length) return { ...c, replies: c.replies.map(r => toggleLikeRecursive(r, targetId)) };
    return c;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-background shadow-xl modal-enter" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b">
          <div className="min-w-0">
            <h2 className="font-bold text-lg">Комментарии</h2>
            <p className="text-xs text-muted-foreground truncate">{designTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50"><X className="h-5 w-5" /></button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Нет комментариев. Будьте первым!</div>
          ) : (
            comments.map(c => (
              <CommentItem
                key={c.id}
                comment={c}
                likedIds={likedIds}
                expandedIds={expandedIds}
                onToggleReplies={() => setExpandedIds(prev => {
                  const next = new Set(prev);
                  if (next.has(c.id)) {
                    next.delete(c.id);
                  } else {
                    next.add(c.id);
                  }
                  return next;
                })}
                replyingTo={replyingTo}
                replyText={replyText}
                onReplyChange={setReplyText}
                onStartReply={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                onSendReply={() => { sendComment({ text: replyText, parentCommentId: c.id }).then(ok => { if (ok) { setReplyingTo(null); setReplyText(''); } }); }}
                onLike={handleLikeComment}
              />
            ))
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 p-4 border-t">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <CornerDownRight className="h-3 w-3" />
              Ответ на комментарий
              <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="ml-auto hover:text-foreground">Отмена</button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment({ text }).then(ok => ok && setText('')); } }}
              placeholder="Добавить комментарий..."
              className="flex-1 rounded-full border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => sendComment({ text }).then(ok => ok && setText(''))}
              disabled={!text.trim()}
              className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <AuthGuardModal open={showAuthGuard} onClose={() => setShowAuthGuard(false)} action="оставить комментарий" />
    </div>
  );
}

// Single comment thread item
function CommentItem({
  comment, likedIds, expandedIds, onToggleReplies,
  replyingTo, replyText, onReplyChange, onStartReply, onSendReply, onLike,
}: {
  comment: Comment;
  likedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleReplies: () => void;
  replyingTo: string | null;
  replyText: string;
  onReplyChange: (v: string) => void;
  onStartReply: () => void;
  onSendReply: () => void;
  onLike: (id: string) => void;
}) {
  const isReplyOpen = replyingTo === comment.id;
  const isLiked = likedIds.has(comment.id);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const isExpanded = expandedIds.has(comment.id);

  return (
    <div className="space-y-3">
      {/* Main comment */}
      <div className="flex gap-3">
        <UserAvatar avatarUrl={comment.author?.avatarUrl} name={comment.author?.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{comment.author?.name || 'Пользователь'}</span>
            <span className="text-xs text-muted-foreground">{formatRelative(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground/90 break-words">{comment.text}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => onLike(comment.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
            >
              <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
              {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
            </button>
            <button onClick={onStartReply} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Ответить
            </button>
          </div>

          {/* Reply input */}
          {isReplyOpen && (
            <div className="flex gap-2 mt-2">
              <input
                value={replyText}
                onChange={e => onReplyChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendReply(); } }}
                placeholder="Написать ответ..."
                className="flex-1 rounded-full border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={onSendReply}
                disabled={!replyText.trim()}
                className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
              >
                Отправить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replies toggle */}
      {hasReplies && !isExpanded && (
        <button onClick={onToggleReplies} className="ml-11 text-xs text-muted-foreground hover:text-primary transition-colors">
          —— Показать {comment.replies!.length} {plural(comment.replies!.length, 'ответ', 'ответа', 'ответов')}
        </button>
      )}

      {/* Replies expanded */}
      {hasReplies && isExpanded && (
        <div className="ml-11 space-y-3 border-l-2 border-muted pl-4">
          <button onClick={onToggleReplies} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Скрыть ответы
          </button>
          {comment.replies!.map(r => (
            <div key={r.id} className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center shrink-0">
                <UserAvatar avatarUrl={r.author?.avatarUrl} name={r.author?.name} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium">{r.author?.name || 'Пользователь'}</span>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(r.createdAt)}</span>
                </div>
                <p className="text-xs text-foreground/80 break-words">{r.text}</p>
                <button
                  onClick={() => onLike(r.id)}
                  className={`flex items-center gap-1 text-[10px] mt-1 transition-colors ${likedIds.has(r.id) ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                >
                  <Heart className={`h-3 w-3 ${likedIds.has(r.id) ? 'fill-current' : ''}`} />
                  {r.likesCount > 0 && <span>{r.likesCount}</span>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins}м`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}д`;
  return date.toLocaleDateString('ru');
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
