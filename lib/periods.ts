// Quick report periods as inclusive [from, to] calendar days (YYYY-MM-DD) around the given local day.
export type QuickPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth';
export const QUICK_PERIODS: [QuickPeriod, string][] = [['today', 'დღეს'], ['yesterday', 'გუშინ'], ['week', 'ეს კვირა'], ['month', 'ეს თვე'], ['lastMonth', 'წინა თვე']];

const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (text: string) => new Date(`${text}T00:00:00Z`);

export function quickPeriod(kind: QuickPeriod, today: string): [string, string] {
    const t = utc(today), shift = (days: number) => day(new Date(t.getTime() + days * 86_400_000));
    if (kind === 'today') return [today, today];
    if (kind === 'yesterday') return [shift(-1), shift(-1)];
    if (kind === 'week') return [shift(-((t.getUTCDay() + 6) % 7)), today]; // weeks start on Monday
    if (kind === 'month') return [`${today.slice(0, 8)}01`, today];
    const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)), last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
    return [day(first), day(last)];
}
