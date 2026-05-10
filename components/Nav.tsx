'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Dumbbell, MessageSquare, BarChart2, User, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';

const links = [
  { href: '/',          label: 'Today',    Icon: Zap          },
  { href: '/workout',   label: 'Workout',  Icon: Dumbbell     },
  { href: '/messages',  label: 'Messages', Icon: MessageSquare },
  { href: '/progress',  label: 'Progress', Icon: BarChart2    },
  { href: '/profile',   label: 'Profile',  Icon: User         },
];

export default function Nav() {
  const pathname = usePathname();
  const { business_name } = useSettings();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (pathname.startsWith('/trainer') || pathname === '/login') return;
    if (pathname === '/messages') {
      setHasUnread(false);
      return;
    }
    async function checkUnread() {
      const lastSeen = localStorage.getItem('lftcrwd_messages_last_seen');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender', 'trainer')
        .eq('user_id', user.id);
      if (lastSeen) query = query.gt('created_at', lastSeen);
      const { count } = await query;
      setHasUnread((count ?? 0) > 0);
    }
    checkUnread();
    const timer = setInterval(checkUnread, 60_000);
    return () => clearInterval(timer);
  }, [pathname]);

  if (pathname.startsWith('/trainer') || pathname === '/login') return null;

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-black/90 backdrop-blur-xl border-r border-white/10 flex-col z-40">
        <div className="px-5 py-6 border-b border-white/10">
          <p className="text-[15px] font-semibold text-white tracking-tight">{business_name}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-medium transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <div className="relative">
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                  {href === '/messages' && hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#30d158] rounded-full" />
                  )}
                </div>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          <Link
            href="/trainer"
            className="block text-[13px] text-white/30 hover:text-white/60 transition-colors"
          >
            Trainer view →
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="flex items-center gap-2 text-[13px] text-white/30 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ────────────────────────────────────── */}
      {/* Total height: 49px tab area + safe area inset */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/85 backdrop-blur-xl border-t border-white/15 pb-safe">
        <div className="flex items-start justify-around h-[49px] pt-1.5">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-[3px] min-w-[44px] min-h-[44px] justify-center px-1 active:opacity-70 transition-opacity duration-100"
              >
                <div className="relative">
                  <Icon
                    size={24}
                    strokeWidth={active ? 2.5 : 1.75}
                    className={active ? 'text-[#30d158]' : 'text-white/35'}
                  />
                  {href === '/messages' && hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#30d158] rounded-full border border-black" />
                  )}
                </div>
                <span className={`text-[10px] leading-none font-medium ${active ? 'text-[#30d158]' : 'text-white/35'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
