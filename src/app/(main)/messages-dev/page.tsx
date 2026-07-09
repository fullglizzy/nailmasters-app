'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, MessageCircle, User, ChevronRight, Check, CheckCheck, Paperclip, X, ChevronLeft, Reply, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildImageGrid } from '@/lib/image-grid';

interface Conversation {
  userId: string; name: string; avatarUrl: string | null;
  lastMessage: string; lastTime: string; unread: number; isMine: boolean;
}

type Attachment = { url: string; type: string };

interface Message {
  id: string; text: string; senderId: string; receiverId: string;
  attachments?: Attachment[] | null;
  replyToId?: string | null; replyToText?: string | null; replyToSenderName?: string | null;
  isDeleted?: boolean; isEdited?: boolean;
  isRead: boolean; createdAt: string;
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lightbox, setLightbox] = useState<{ items: Attachment[]; index: number } | null>(null);
  const lightboxTouchRef = useRef<{ startX: number; startY: number }>({ startX: 0, startY: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = useRef('');

  // При загрузке — всегда скроллим наверх, отключаем восстановление позиции браузером
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // Загружаем свой ID
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      currentUserId.current = user.id || '';
    } catch {}
  }, []);

  // Загружаем диалоги
  const loadConversations = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setConversations(json.data || []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Авто-открытие чата по URL ?with=userId&name=Name
  useEffect(() => {
    const withId = searchParams.get('with');
    const name = searchParams.get('name');
    if (withId && name) {
      setActiveChat({ userId: withId, name, avatarUrl: null, lastMessage: '', lastTime: '', unread: 0, isMine: false });
      const token = localStorage.getItem('token');
      if (token) {
        fetch(`/api/messages?with=${withId}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(json => { if (json.success) setMessages(json.data || []); });
      }
      // Чистим URL
      router.replace('/messages-dev');
    }
  }, [searchParams, router]);

  // Скролл к сообщению и подсветка
  const scrollToMessage = useCallback((msgId: string) => {
    setHighlightedId(msgId);
    const el = msgRefs.current.get(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Снимаем подсветку через 2 секунды
    setTimeout(() => setHighlightedId(null), 2000);
  }, []);

  // Выход из чата — скролл наверх
  const closeChat = useCallback(() => {
    setActiveChat(null);
    window.scrollTo(0, 0);
  }, []);

  // Загружаем сообщения диалога
  const openChat = useCallback((conv: Conversation) => {
    setActiveChat(conv);
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`/api/messages?with=${conv.userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setMessages(json.data || []); });
    // Сбрасываем непрочитанные в списке диалогов
    setConversations(prev => prev.map(c => c.userId === conv.userId ? { ...c, unread: 0 } : c));
    // Загружаем актуальный список диалогов
    loadConversations();
  }, [loadConversations]);

  // Авто-прокрутка вниз — только при новом сообщении, не при поллинге
  const prevMsgCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  // Периодическое обновление статусов прочтения (каждые 5 сек когда чат открыт)
  useEffect(() => {
    const chatUserId = activeChat?.userId;
    if (!chatUserId) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const interval = setInterval(() => {
      fetch(`/api/messages?with=${chatUserId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(json => {
          if (json.success) {
            const updated = json.data as Message[];
            setMessages(prev => {
              const updatedMap = new Map(updated.map((m: Message) => [m.id, m]));
              const merged = prev.map(m => updatedMap.get(m.id) || m);
              // Добавляем новые, которых ещё нет в prev (для страховки)
              for (const m of updated) {
                if (!prev.some(p => p.id === m.id)) merged.push(m);
              }
              return merged;
            });
            // Обновляем также непрочитанные в списке диалогов
            loadConversations();
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [activeChat?.userId, loadConversations]);

  // SSE: реальное время
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const es = new EventSource(`/api/messages/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'new_message' && msg.data) {
          const m = msg.data as Message;
          // Если чат с этим пользователем открыт и это НЕ своё сообщение — добавляем
          if (activeChat && (m.senderId === activeChat.userId || m.receiverId === activeChat.userId)) {
            setMessages(prev => {
              if (prev.some(existing => existing.id === m.id)) return prev; // уже есть (своё или дубль)
              return [...prev, m];
            });
          }
          // Обновляем список диалогов
          loadConversations();
        }
      } catch {}
    };
    return () => es.close();
  }, [activeChat, loadConversations]);

  // Загрузка вложений
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !activeChat) return;
    setUploading(true);
    const token = localStorage.getItem('token');
    try {
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
      const res = await fetch('/api/messages/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token!}` },
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        setAttachments(prev => [...prev, ...(json.data as Attachment[])]);
      } else {
        toast.error(json.error || 'Ошибка загрузки');
      }
    } catch { toast.error('Ошибка загрузки'); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Удаление сообщения
  const handleDelete = async (msgId: string) => {
    setMenuMsgId(null);
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/messages/${msgId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token!}` } });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, text: '', attachments: null } : m));
    } catch { toast.error('Ошибка удаления'); }
  };

  // Начать редактирование
  const startEdit = (m: Message) => {
    setMenuMsgId(null);
    setEditingMsg(m);
    setText(m.text);
    setReplyTo(null);
  };

  // Отправка (или редактирование)
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeChat) return;
    const hasContent = text.trim() || attachments.length;

    // Редактирование существующего
    if (editingMsg) {
      if (!text.trim()) return;
      setSending(true);
      const token = localStorage.getItem('token');
      try {
        await fetch(`/api/messages/${editingMsg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token!}` },
          body: JSON.stringify({ text: text.trim() }),
        });
        setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, text: text.trim(), isEdited: true } : m));
        setText('');
        setEditingMsg(null);
      } catch { toast.error('Ошибка'); }
      finally { setSending(false); }
      return;
    }

    // Новая отправка
    if (!hasContent) return;
    setSending(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token!}` },
        body: JSON.stringify({
          text: text.trim(),
          receiverId: activeChat.userId,
          attachments: attachments.length ? attachments : undefined,
          ...(replyTo ? { replyToId: replyTo.id, replyToText: replyTo.text || 'Вложение', replyToSenderName: replyTo.senderId === currentUserId.current ? 'Вы' : activeChat?.name } : {}),
        }),
      });
      const json = await res.json();
      if (json.success) {
        const newMsg = json.data as Message;
        setMessages(prev => [...prev, newMsg]);
        setText('');
        setAttachments([]);
        setReplyTo(null);
        loadConversations();
      }
    } catch { toast.error('Ошибка отправки'); }
    finally { setSending(false); }
  };

  const cancelEdit = () => { setEditingMsg(null); setText(''); };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] py-2 px-4 overflow-hidden">
      <div className="mx-auto max-w-4xl h-full flex flex-col">

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Список диалогов */}
          {!activeChat && (
            <div className="w-full overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="text-center py-20 rounded-2xl border bg-card">
                  <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Нет сообщений</h2>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Найдите мастера и напишите ему, чтобы начать общение
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map(conv => (
                    <button
                      key={conv.userId}
                      onClick={() => openChat(conv)}
                      className="w-full flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 hover:bg-accent/30 transition-colors text-left"
                    >
                      {conv.avatarUrl ? (
                        <img src={conv.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="font-bold text-primary text-lg">{conv.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{conv.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                            {formatMsgTime(conv.lastTime)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate">
                            {conv.isMine && 'Вы: '}{conv.lastMessage}
                          </span>
                          {conv.unread > 0 && (
                            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                              {conv.unread}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Чат */}
          {activeChat && (
            <div className="w-full flex flex-col bg-card overflow-hidden
              fixed inset-0 z-50 md:relative md:z-0 md:rounded-2xl md:border md:border-border/40 md:h-full">
              {/* Хедер чата */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm shrink-0">
                <button onClick={closeChat} className="rounded-full p-1.5 hover:bg-accent transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {activeChat.avatarUrl ? (
                  <img src={activeChat.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-primary">{activeChat.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <Link href={`/masters/${activeChat.userId}`} className="font-semibold text-sm truncate hover:text-primary hover:underline transition-colors">
                  {activeChat.name}
                </Link>
              </div>

              {/* Сообщения */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Напишите первое сообщение
                  </div>
                ) : (
                  messages.map(m => {
                    const isMine = m.senderId === currentUserId.current;
                    return (
                      <div
                        key={m.id}
                        ref={el => { if (el) msgRefs.current.set(m.id, el); }}
                        className={`group flex items-end gap-1 ${isMine ? 'justify-end' : 'justify-start'} transition-colors duration-500 ${highlightedId === m.id ? 'bg-primary/10 rounded-xl' : ''}`}
                      >
                        {/* Кнопка ответа — слева для чужих, справа для своих */}
                        {!isMine && (
                          <button onClick={() => setReplyTo(m)} className="shrink-0 mb-1 rounded-full p-1 text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors" title="Ответить">
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <div
                          onClick={() => { if (isMine && !m.isDeleted) setMenuMsgId(menuMsgId === m.id ? null : m.id); }}
                          className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isMine && !m.isDeleted ? 'cursor-pointer' : ''} ${
                            isMine
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md'
                          }`}
                        >
                          {/* Мини-меню */}
                          {menuMsgId === m.id && (
                            <div className={`absolute -top-8 ${isMine ? 'right-0' : 'left-0'} flex gap-0.5 bg-background border border-border rounded-lg shadow-lg p-0.5 z-10`} onClick={e => e.stopPropagation()}>
                              <button onClick={() => startEdit(m)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent transition-colors">
                                <Pencil className="h-3 w-3" /> Изм.
                              </button>
                              <button onClick={() => handleDelete(m.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-destructive/10 hover:text-destructive transition-colors">
                                <Trash2 className="h-3 w-3" /> Удалить
                              </button>
                            </div>
                          )}
                          {/* Цитируемое сообщение — только если сообщение не удалено */}
                          {m.replyToText && !m.isDeleted && (
                            <div
                              onClick={() => m.replyToId && scrollToMessage(m.replyToId)}
                              className={`mb-1.5 rounded-lg px-2.5 py-1.5 text-xs border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${isMine ? 'bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground/70' : 'bg-background/60 border-primary/40 text-muted-foreground'}`}
                            >
                              <span className="font-semibold block mb-0.5 opacity-80">{m.replyToSenderName || 'Сообщение'}</span>
                              <span className="line-clamp-1">{m.replyToText}</span>
                            </div>
                          )}
                          {/* Удалённое сообщение */}
                          {m.isDeleted ? (
                            <p className="italic opacity-50 text-xs">Сообщение удалено</p>
                          ) : (
                            <>
                              {m.text && <p className="break-words whitespace-pre-wrap">{m.text}</p>}
                            </>
                          )}
                          {m.attachments && m.attachments.length > 0 && !m.isDeleted && (
                            <div className="mt-1.5 w-[220px] sm:w-[260px] overflow-hidden rounded-xl">
                              {/* Отделяем картинки от файлов */}
                              {m.attachments.filter(a => a.type === 'file').map((a, i) => (
                                <a key={`file-${i}`} href={a.url} target="_blank" className="flex items-center gap-2 text-xs underline opacity-80 hover:opacity-100 mb-1">
                                  <Paperclip className="h-3 w-3" /> Файл
                                </a>
                              ))}
                              {/* Умная сетка для фото/видео */}
                              {(() => {
                                const media = m.attachments!.filter(a => a.type === 'image' || a.type === 'video');
                                if (!media.length) return null;
                                const grid = buildImageGrid(
                                  media.map(a => ({ id: a.url, width: 400, height: 300 })),
                                  { containerWidth: 220, hMin: 60, wMin: 60 },
                                );
                                let globalIdx = 0;
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    {grid.map((row, ri) => {
                                      const isFirstRow = ri === 0;
                                      const isLastRow = ri === grid.length - 1;
                                      return (
                                        <div key={ri} className="flex gap-0.5" style={{ height: row[0]?.placedHeight ?? 0 }}>
                                          {row.map((img, ci) => {
                                            const a = media[globalIdx++];
                                            const isFirstCol = ci === 0;
                                            const isLastCol = ci === row.length - 1;
                                            // Скругляем углы у крайних ячеек сетки
                                            const corners = [
                                              isFirstRow && isFirstCol ? 'rounded-tl-xl' : '',
                                              isFirstRow && isLastCol ? 'rounded-tr-xl' : '',
                                              isLastRow && isFirstCol ? 'rounded-bl-xl' : '',
                                              isLastRow && isLastCol ? 'rounded-br-xl' : '',
                                            ].filter(Boolean).join(' ');
                                            return (
                                              <div key={img.id} className={`overflow-hidden ${corners}`} style={{ width: img.placedWidth, height: img.placedHeight }}>
                                                {a.type === 'image' ? (
                                                  <img
                                                    src={a.url} alt=""
                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                    onClick={() => setLightbox({ items: m.attachments!, index: m.attachments!.indexOf(a) })}
                                                  />
                                                ) : (
                                                  <video src={a.url} controls className="w-full h-full object-cover" />
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {m.isEdited && <span className="text-[10px] opacity-50 italic">изм.</span>}
                            <span className="text-[10px] opacity-70">
                              {new Date(m.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMine && !m.isDeleted && (
                              m.isRead
                                ? <CheckCheck className="h-3 w-3 opacity-50" />
                                : <Check className="h-3 w-3 opacity-40" />
                            )}
                          </div>
                        </div>
                        {/* Кнопка ответа справа для своих */}
                        {isMine && (
                          <button onClick={() => setReplyTo(m)} className="shrink-0 mb-1 rounded-full p-1 text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors" title="Ответить">
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Ввод */}
              <div className="shrink-0 border-t border-border/40 bg-background/50 safe-area-bottom">
                {/* Бар редактирования */}
                {editingMsg && (
                  <div className="flex items-center gap-2 px-4 pt-2">
                    <div className="flex-1 min-w-0 rounded-lg bg-gold/10 px-3 py-2 border-l-2 border-gold">
                      <span className="text-[11px] font-semibold text-gold block">Редактирование</span>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">{editingMsg.text}</span>
                    </div>
                    <button onClick={cancelEdit} className="shrink-0 rounded-full p-1 hover:bg-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {/* Бар ответа */}
                {!editingMsg && replyTo && (
                  <div className="flex items-center gap-2 px-4 pt-2">
                    <div className="flex-1 min-w-0 rounded-lg bg-accent/50 px-3 py-2 border-l-2 border-primary">
                      <span className="text-[11px] font-semibold text-primary block">
                        {replyTo.senderId === currentUserId.current ? 'Вы' : activeChat?.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {replyTo.text || 'Вложение'}
                      </span>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="shrink-0 rounded-full p-1 hover:bg-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {/* Превью вложений */}
                {attachments.length > 0 && (
                  <div className="px-4 pt-2 flex gap-2 flex-wrap">
                    {attachments.map((a, i) => (
                      <div key={i} className="relative">
                        {a.type === 'image' ? (
                          <img src={a.url} alt="" className="h-16 w-16 object-cover rounded-xl border border-border/40" />
                        ) : a.type === 'video' ? (
                          <video src={a.url} className="h-16 w-16 object-cover rounded-xl border border-border/40" />
                        ) : (
                          <div className="flex items-center gap-1.5 rounded-xl bg-accent/60 px-2.5 py-2 text-xs h-16">
                            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSend} className="flex gap-2 p-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="shrink-0 rounded-full p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition-colors"
                  >
                    {uploading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={editingMsg ? 'Редактировать...' : 'Сообщение...'}
                    className={`flex-1 rounded-full border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${editingMsg ? 'border-gold/60 focus:ring-gold/30' : 'border-border/60 focus:ring-primary/30'}`}
                  />
                  <button
                    type="submit"
                    disabled={(!text.trim() && !attachments.length && !editingMsg) || sending}
                    className={`shrink-0 rounded-full p-2.5 text-primary-foreground disabled:opacity-40 transition-colors ${editingMsg ? 'bg-gold hover:bg-gold/90' : 'bg-primary hover:bg-primary/90'}`}
                  >
                    {editingMsg ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Лайтбокс-галерея: свайп, доты, навигация */}
      {lightbox && (() => {
        const { items, index } = lightbox;
        const current = items[index];
        const hasMultiple = items.length > 1;

        const goNext = () => setLightbox(prev => prev ? { ...prev, index: Math.min(prev.index + 1, items.length - 1) } : null);
        const goPrev = () => setLightbox(prev => prev ? { ...prev, index: Math.max(prev.index - 1, 0) } : null);
        const close = () => setLightbox(null);

        return (
          <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center select-none" onClick={close}>
            {/* Крестик */}
            <button onClick={close} className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors">
              <X className="h-6 w-6" />
            </button>

            {/* Счётчик */}
            {hasMultiple && (
              <span className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                {index + 1} / {items.length}
              </span>
            )}

            {/* Стрелки */}
            {hasMultiple && index > 0 && (
              <button onClick={e => { e.stopPropagation(); goPrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition-colors">
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {hasMultiple && index < items.length - 1 && (
              <button onClick={e => { e.stopPropagation(); goNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition-colors">
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Контент — со свайпом */}
            <div
              className="max-w-full max-h-full p-4 flex items-center justify-center"
              onClick={e => e.stopPropagation()}
              onTouchStart={e => { lightboxTouchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }; }}
              onTouchEnd={e => {
                const { startX, startY } = lightboxTouchRef.current;
                const dx = e.changedTouches[0].clientX - startX;
                const dy = e.changedTouches[0].clientY - startY;
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
                  if (dx < 0) goNext(); else goPrev();
                }
              }}
            >
              {current.type === 'image' ? (
                <img src={current.url} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
              ) : (
                <video src={current.url} controls className="max-w-full max-h-[85vh] rounded-lg" />
              )}
            </div>

            {/* Доты-индикаторы */}
            {hasMultiple && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: i } : null); }}
                    className={`rounded-full transition-all ${i === index ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function formatMsgTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}
