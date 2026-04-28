'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';

export default function TodayHeader() {
  const [name, setName] = useState('');
  const { business_name } = useSettings();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const display =
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        '';
      setName(display);
    })();
  }, []);

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="mb-6">
      <p className="text-[13px] font-semibold text-[#30d158] mb-1 tracking-tight">{business_name}</p>
      <p className="text-[13px] text-white/45 mb-1">
        {date}{name ? ` · ${name}` : ''}
      </p>
      <h1 className="text-[34px] font-bold leading-[41px] tracking-[0.37px] text-white">
        Today
      </h1>
    </div>
  );
}
