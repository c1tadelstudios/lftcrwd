'use client';

import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Trainer routes own their own layout entirely — no root padding or sidebar margin.
  if (pathname.startsWith('/trainer')) {
    return <>{children}</>;
  }

  return (
    <main className="max-w-lg mx-auto px-4 pt-6 pb-tab md:ml-56 md:max-w-none md:mx-0 md:px-10 md:pt-10 md:pb-10">
      {children}
    </main>
  );
}
