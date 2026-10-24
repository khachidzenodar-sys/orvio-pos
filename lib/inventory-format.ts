import type {MovementType, StockKind, StockUnit} from './inventory';

// Pure UI helpers for stock quantities and costs. No runtime imports (strip-types test runner).
export type InputUnit = 'kg' | 'g' | 'l' | 'ml' | 'pcs';

export const unitLabels: Record<StockUnit, string> = {g: 'კგ/გ', ml: 'ლ/მლ', pcs: 'ცალი'};
export const kindLabels: Record<StockKind, string> = {ingredient: 'ინგრედიენტი', semi: 'ნახევარფაბრიკატი'};
export const movementLabels: Record<MovementType, string> = {receipt: 'მიღება', sale: 'გაყიდვა', writeoff: 'ჩამოწერა', count: 'ინვენტარიზაცია', production: 'წარმოება'};
export const inputUnitLabels: Record<InputUnit, string> = {kg: 'კგ', g: 'გ', l: 'ლ', ml: 'მლ', pcs: 'ცალი'};

const MAX_QUANTITY = 100_000_000;
const MAX_MONEY = 10_000_000_000;
const POSITIVE = 'შეიყვანეთ დადებითი რაოდენობა';

export function inputUnits(unit: StockUnit): InputUnit[] {
  return unit === 'g' ? ['kg', 'g'] : unit === 'ml' ? ['l', 'ml'] : ['pcs'];
}

// Splits "12.345" / "12,345" into integer and fraction digit strings; null when not a plain non-negative decimal.
function decimal(text: string): {whole: string; fraction: string} | null {
  const m = /^(\d*)(?:\.(\d*))?$/.exec(text.trim().replace(',', '.'));
  if (!m || (!m[1] && !m[2])) return null;
  return {whole: m[1] || '0', fraction: m[2] || ''};
}

// Converts entered text to integer base units (g, ml, pcs) without floating point arithmetic.
export function parseQuantity(text: string, unit: InputUnit, allowZero = false): number {
  const d = decimal(text);
  if (!d) throw new Error(POSITIVE);
  const scaled = unit === 'kg' || unit === 'l';
  let fraction = d.fraction.replace(/0+$/, '');
  if (scaled) {
    if (d.fraction.length > 3) throw new Error('კილოგრამი/ლიტრი — მაქსიმუმ 3 ათწილადი');
    fraction = d.fraction.padEnd(3, '0');
  } else if (fraction) throw new Error('გრამი, მილილიტრი და ცალი — მხოლოდ მთელი რიცხვი');
  const base = BigInt(d.whole) * BigInt(scaled ? 1000 : 1) + BigInt(scaled ? fraction : 0);
  if (base > BigInt(MAX_QUANTITY)) throw new Error('რაოდენობა დასაშვებ ზღვარს აღემატება');
  const n = Number(base);
  if (n === 0 && !allowZero) throw new Error(POSITIVE);
  return n;
}

// Lari text to integer tetri, at most 2 decimals.
export function parseMoney(text: string): number {
  const d = decimal(text);
  if (!d || d.fraction.length > 2) throw new Error('თანხა არასწორია');
  const tetri = BigInt(d.whole) * BigInt(100) + BigInt(d.fraction.padEnd(2, '0'));
  if (tetri > BigInt(MAX_MONEY)) throw new Error('თანხა არასწორია');
  return Number(tetri);
}

// unitPrice: tetri per kg/l (g, ml) or per piece (pcs). Half-up rounding.
export function lineTotal(unitPrice: number, quantity: number, unit: StockUnit): number {
  if (unit === 'pcs') return unitPrice * quantity;
  const sign = Math.sign(unitPrice) * Math.sign(quantity);
  const product = BigInt(Math.abs(unitPrice)) * BigInt(Math.abs(quantity));
  return sign * Number((product * BigInt(2) + BigInt(1000)) / BigInt(2000));
}

const MINUS = '−';
const signed = (n: number, text: string) => (n < 0 ? MINUS : '') + text;

export function formatQuantity(quantity: number, unit: StockUnit): string {
  const a = Math.abs(quantity);
  if (unit === 'pcs') return signed(quantity, `${a} ცალი`);
  const [big, small] = unit === 'g' ? ['კგ', 'გ'] : ['ლ', 'მლ'];
  if (a >= 1000) return signed(quantity, `${Math.floor(a / 1000)}.${String(a % 1000).padStart(3, '0')} ${big}`);
  return signed(quantity, `${a} ${small}`);
}

export function formatMoney(tetri: number): string {
  return `${(tetri / 100).toFixed(2)} ₾`;
}

// avgCost is tetri per 1000 base units: per kg/l directly, per piece after dividing by 1000 (half-up).
export function formatUnitCost(avgCost: number, unit: StockUnit): string {
  if (unit === 'pcs') return `${(Math.floor((avgCost + 500) / 1000) / 100).toFixed(2)} ₾/ცალი`;
  return `${(avgCost / 100).toFixed(2)} ₾/${unit === 'g' ? 'კგ' : 'ლ'}`;
}

export function formatPercent(tenths: number | null): string {
  return tenths === null ? '—' : `${(tenths / 10).toFixed(1)}%`;
}
