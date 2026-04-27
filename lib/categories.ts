import { TrendingUp, Flame, Dumbbell, TrendingDown, type LucideIcon } from 'lucide-react';

export type CategoryKey = 'bulk' | 'cut' | 'recomposition' | 'weight_loss';

export type Category = {
  key: CategoryKey;
  label: string;       // full label
  shortLabel: string;  // for compact badges
  icon: LucideIcon;
  color: string;       // text color
  bg: string;          // badge background
};

export const CATEGORIES: Category[] = [
  { key: 'bulk',          label: 'Bulk',          shortLabel: 'Bulk',    icon: TrendingUp,   color: 'text-amber-400',  bg: 'bg-amber-900/40' },
  { key: 'cut',           label: 'Cut',           shortLabel: 'Cut',     icon: Flame,        color: 'text-red-400',    bg: 'bg-red-900/40'   },
  { key: 'recomposition', label: 'Recomposition', shortLabel: 'Recomp',  icon: Dumbbell,     color: 'text-purple-400', bg: 'bg-purple-900/40'},
  { key: 'weight_loss',   label: 'Weight Loss',   shortLabel: 'Wt Loss', icon: TrendingDown, color: 'text-green-400',  bg: 'bg-green-900/40' },
];

export const DEFAULT_CATEGORY: CategoryKey = 'recomposition';

export function getCategory(key: string | null | undefined): Category {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES.find(c => c.key === DEFAULT_CATEGORY)!;
}
