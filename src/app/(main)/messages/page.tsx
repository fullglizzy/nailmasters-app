'use client';

import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

export default function MessagesPage() {
  const [message, setMessage] = useState('');
  const [messages] = useState<{ id: string; text: string; from: string; time: string }[]>([]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // WebSocket отправка (будет реализована при подключении WS)
    setMessage('');
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <MessageCircle className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Сообщения</h1>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border bg-card">
            <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Нет сообщений</h2>
            <p className="text-muted-foreground">
              Когда вы начнете общаться с мастерами, сообщения появятся здесь
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            {messages.map(msg => (
              <div key={msg.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{msg.from}</span>
                  <span className="text-xs text-muted-foreground">{msg.time}</span>
                </div>
                <p className="text-sm">{msg.text}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-3">
          <input value={message} onChange={e => setMessage(e.target.value)}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Напишите сообщение..." />
          <button type="submit" disabled={!message.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
