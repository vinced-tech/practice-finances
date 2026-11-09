import { monthKey } from './dates';
import { merchantDisplayName } from './merchant';
import type { Expense } from './model';
import type { Cents } from './money';

export interface Subscription {
  merchantKey: string;
  name: string;
  categoryId: string;
  personal: boolean;
  monthsSeen: number;
  /** most recent regular charge */
  monthlyCents: Cents;
  yearlyCents: Cents;
  lastDate: string;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/**
 * A merchant is a subscription when it charges a similar amount (within 25% of its
 * typical charge) in 3 or more different months. This catches "SLING.COM" and
 * "AMAZON PRIME" but not irregular Amazon Marketplace shopping.
 */
export function detectSubscriptions(expenses: Expense[], dismissed: string[] = []): Subscription[] {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (e.kind !== 'expense') continue;
    if (dismissed.includes(e.merchantKey)) continue;
    const g = groups.get(e.merchantKey);
    if (g) g.push(e);
    else groups.set(e.merchantKey, [e]);
  }

  const subs: Subscription[] = [];
  for (const [key, list] of groups) {
    const typical = median(list.map((e) => e.amountCents));
    const regular = list.filter((e) => Math.abs(e.amountCents - typical) <= typical * 0.25);
    const months = new Set(regular.map((e) => monthKey(e.date)));
    if (months.size < 3) continue;
    const latest = [...regular].sort((a, b) => b.date.localeCompare(a.date))[0];
    subs.push({
      merchantKey: key,
      name: merchantDisplayName(latest.description),
      categoryId: latest.categoryId,
      personal: latest.personal,
      monthsSeen: months.size,
      monthlyCents: latest.amountCents,
      yearlyCents: latest.amountCents * 12,
      lastDate: latest.date,
    });
  }
  return subs.sort((a, b) => b.monthlyCents - a.monthlyCents);
}

export const isSubscriptionMerchant = (subs: Subscription[]) => {
  const keys = new Set(subs.map((s) => s.merchantKey));
  return (key: string) => keys.has(key);
};
