'use client';

import { useEffect, useState } from 'react';

export type AppSettings = {
  business_name: string;
  tagline: string | null;
};

const DEFAULT: AppSettings = { business_name: 'lftcrwd Fitness', tagline: null };

// Module-level cache — one fetch shared across all components per page load
let cached: AppSettings | null = null;
let pending: Promise<AppSettings> | null = null;

function loadSettings(): Promise<AppSettings> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        cached = { business_name: data.business_name ?? DEFAULT.business_name, tagline: data.tagline ?? null };
        return cached;
      })
      .catch(() => DEFAULT);
  }
  return pending;
}

export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(cached ?? DEFAULT);

  useEffect(() => {
    loadSettings().then(s => setSettings(s));
  }, []);

  return settings;
}

// Call this after saving to bust the cache
export function invalidateSettingsCache() {
  cached = null;
  pending = null;
}
