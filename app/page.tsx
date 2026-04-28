'use client';

import Nav from '@/components/Nav';
import TodayHeader from '@/components/TodayHeader';
import TodayDashboard from '@/components/TodayDashboard';
import AppShell from '@/components/AppShell';

export default function TodayPage() {
  return (
    <div className="min-h-[100dvh] bg-black pb-[83px] md:pb-0">
      <AppShell>
        <TodayHeader />
        <TodayDashboard />
      </AppShell>
      <Nav />
    </div>
  );
}
