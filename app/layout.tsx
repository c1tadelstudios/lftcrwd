import type { Metadata, Viewport } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'lftcrwd',
  description: 'lftcrwd App',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'lftcrwd',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        <AppShell>{children}</AppShell>
        <Nav />
      </body>
    </html>
  );
}
