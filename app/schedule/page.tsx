'use client';

import Nav from '@/components/Nav';

export default function SchedulePage() {
  return (
    <div className="min-h-[100dvh] bg-black pb-[83px]">
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-[34px] font-bold leading-[41px] text-white">Schedule</h1>
      </div>
      <div className="px-4">
        <div className="bg-[#1c1c1e] rounded-2xl p-8 text-center">
          <p className="text-white/45 text-[17px]">No recurring partners yet.</p>
          <p className="text-white/25 text-[15px] mt-1">Match and schedule a regular session.</p>
        </div>
      </div>
      <Nav />
    </div>
  );
}
