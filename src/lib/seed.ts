// Sample data so the dashboard isn't empty on first open.
// Every sample row is flagged `sample: true` and can be removed with one button.
import { merchantKey } from './merchant';
import type { AppState, Expense, Income } from './model';
import { emptyState, newId } from './model';

const d = (y: number, m: number, day: number) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function sampleState(year: number, throughMonth: number): AppState {
  const s = emptyState();
  const income: Income[] = [];
  const expenses: Expense[] = [];
  const addExp = (m: number, day: number, description: string, categoryId: string, cents: number, extra: Partial<Expense> = {}) =>
    expenses.push({
      id: newId(),
      date: d(year, m, day),
      description,
      merchantKey: merchantKey(description),
      categoryId,
      amountCents: cents,
      kind: 'expense',
      personal: false,
      origin: 'manual',
      sample: true,
      ...extra,
    });

  // Gentle, deterministic variation so the chart looks realistic.
  const wobble = [0, 412_37, -318_20, 655_10, -120_45, 230_00, -505_15, 98_60, 310_25, -240_80, 150_00, -60_00];

  for (let m = 1; m <= throughMonth; m++) {
    income.push({ id: newId(), date: d(year, m, 5), sourceId: 'talkspace', amountCents: 5_200_00 + wobble[m - 1], sample: true });
    income.push({ id: newId(), date: d(year, m, 12), sourceId: 'grow-therapy', amountCents: 1_850_00 - Math.round(wobble[(m + 3) % 12] / 2), sample: true });
    income.push({ id: newId(), date: d(year, m, 20), sourceId: 'private-client', amountCents: [480_00, 600_00, 720_00][m % 3], sample: true });

    addExp(m, 2, 'SIMPLEPRACTICE', 'software-and-subscriptions', 69_00);
    addExp(m, 3, 'PSYCHOLOGY TODAY', 'marketing-and-website', 29_95);
    addExp(m, 8, 'WEB*Network Solutions', 'marketing-and-website', 16_80);
    addExp(m, 11, 'OFFICE ALLY INC.', 'billing-and-claims', 44_95);
    addExp(m, 14, 'ZOOM.US 888-799-9666', 'software-and-subscriptions', 15_99);
    addExp(m, 18, 'HULU', 'other', 18_99, { personal: true });
  }
  if (throughMonth >= 1) addExp(1, 8, 'CPH LIABILITY INSURANC', 'insurance', 297_00);
  if (throughMonth >= 2) addExp(2, 9, 'STAPLES 00123', 'office-supplies-and-furniture', 84_37);
  if (throughMonth >= 3) addExp(3, 5, 'SP CORDAROYS-BEANBAG', 'office-supplies-and-furniture', 242_48);
  if (throughMonth >= 4) addExp(4, 12, 'ILLINOIS SECRETARY OF STA', 'licensing-and-fees', 178_94);
  if (throughMonth >= 5) addExp(5, 21, 'PESI INC', 'continuing-education', 219_99);
  if (throughMonth >= 6) addExp(6, 14, 'PANERA BREAD #4411', 'meals', 23_18);
  if (throughMonth >= 9) {
    addExp(9, 2, 'AMAZON MKTPL*BF2EX4393', 'office-supplies-and-furniture', 64_10);
    addExp(9, 9, 'AMAZON MKTPL*BF2EX4393', 'office-supplies-and-furniture', 64_10, { kind: 'refund' });
  }

  return { ...s, income, expenses };
}
