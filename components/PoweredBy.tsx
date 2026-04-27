'use client';

import { usePathname } from 'next/navigation';

export default function PoweredBy() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <div className="flex justify-center py-3">
      <a
        href="https://bitharbor.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-30 hover:opacity-50 transition-opacity"
      >
        <span className="text-xs text-blue-300">Powered by Bitharbor</span>
      </a>
    </div>
  );
}
