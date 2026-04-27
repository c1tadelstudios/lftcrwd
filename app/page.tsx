'use client';

import Nav from '@/components/Nav';

export default function DiscoverPage() {
  return (
    <div className="min-h-[100dvh] bg-black pb-[83px]">
      <div className="px-4 pt-14 pb-4">
        <p className="text-[13px] text-white/45 mb-1 uppercase tracking-[0.08em] font-semibold">lftcrwd</p>
        <h1 className="text-[34px] font-bold leading-[41px] text-white">Discover</h1>
      </div>
      <div className="px-4">
        <div className="bg-[#1c1c1e] rounded-2xl p-8 text-center">
          <p className="text-white/45 text-[17px]">Discovery feed coming soon.</p>
          <p className="text-white/25 text-[15px] mt-1">Set your status to start matching.</p>
        </div>
      </div>
      <Nav active="discover" />
    </div>
  );
}
