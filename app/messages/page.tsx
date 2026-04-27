'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/supabase';

const POLL_INTERVAL = 30_000;

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
    localStorage.setItem('lftcrwd_messages_last_seen', new Date().toISOString());
  }

  useEffect(() => {
    fetchMessages();
    const timer = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    await supabase.from('messages').insert({ body: text, sender: 'user' });
    setBody('');
    await fetchMessages();
    setSending(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4">
        <p className="text-zinc-400 text-sm">Messages</p>
        <h1 className="text-2xl font-bold">Trainer Chat</h1>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {loading ? (
          <div className="space-y-3 pt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`animate-pulse h-10 w-2/3 bg-zinc-800 rounded-2xl ${i % 2 === 0 ? 'ml-auto' : ''}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center pt-12">
            <p className="text-zinc-500 text-sm">No messages yet.</p>
            <p className="text-zinc-600 text-xs mt-1">Send a message to your trainer below.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.sender === 'user'
                    ? 'bg-[#30d158] text-black rounded-br-sm'
                    : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                }`}
              >
                <p>{msg.body}</p>
                <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-black/50' : 'text-zinc-500'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex gap-2 pt-3 border-t border-zinc-800">
        <input
          type="text"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Message your trainer..."
          className="flex-1 bg-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-zinc-600"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="bg-[#30d158] hover:bg-[#30d158]/85 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
