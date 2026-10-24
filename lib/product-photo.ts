// Pure product-photo rules with no imports, so the Node strip-types runner, the domain,
// the demo store and the browser compressor all share one source of limits and messages.
export const PHOTO_MAX_SIDE = 400;
export const PHOTO_TARGET_CHARS = 54_000;
export const PHOTO_MAX_CHARS = 60_000;
export const PHOTO_MAX_COUNT = 60;
export const PHOTO_MAX_TOTAL_CHARS = 1_800_000;
export const PHOTO_SOURCE_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export const PHOTO_MESSAGES = {
    notImage: 'აირჩიეთ სურათი (JPEG, PNG, WebP).',
    tooLarge: 'ფაილი ძალიან დიდია (მაქს. 15 მბ).',
    heic: 'ამ ბრაუზერს HEIC ფოტოს გახსნა არ შეუძლია. შეინახეთ ფოტო JPEG ან PNG ფორმატში და სცადეთ ხელახლა.',
    tooHeavy: 'ფოტო შეკუმშვის შემდეგაც ძალიან დიდია. სცადეთ სხვა ფოტო.',
    invalid: 'ფოტო არასწორია. დასაშვებია მხოლოდ JPEG, PNG ან WebP სურათი.',
    countLimit: `ფოტოების ლიმიტი ამოიწურა (მაქს. ${PHOTO_MAX_COUNT}). ახლის დასამატებლად წაშალეთ რომელიმე ფოტო.`,
    totalLimit: 'ფოტოების ჯამური ზომის ლიმიტი ამოიწურა. წაშალეთ რომელიმე ფოტო ან გამოიყენეთ უფრო მარტივი სურათი.',
    quota: 'ბრაუზერის მეხსიერება გავსებულია — ფოტო ვერ შეინახა. წაშალეთ ზოგიერთი ფოტო.',
} as const;

// Encoder ladder for the browser adapter, from best quality to smallest output.
export const PHOTO_ENCODE_STEPS: readonly {maxSide: number; quality: number}[] = [
    {maxSide: 400, quality: 0.8}, {maxSide: 400, quality: 0.7}, {maxSide: 400, quality: 0.6},
    {maxSide: 400, quality: 0.5}, {maxSide: 320, quality: 0.6}, {maxSide: 240, quality: 0.6},
];

const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const SOURCE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const SOURCE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

// Only embedded raster images: never URLs, SVG or HTML. Length is checked before the regex.
export function isValidProductPhoto(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > PHOTO_MAX_CHARS) return false;
    const match = PHOTO_PATTERN.exec(value);
    return !!match && match[2].length % 4 === 0;
}

// Decoded binary size from base64 arithmetic, without decoding.
export function photoBytes(dataUrl: string): number {
    const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
}
export function photoKilobytes(dataUrl: string): number {
    return Math.ceil(photoBytes(dataUrl) / 1024);
}

export type PhotoUsage = {count: number; chars: number};
export function photoUsage(products: readonly {id: string; photo?: string}[], exceptId?: string): PhotoUsage {
    let count = 0, chars = 0;
    for (const product of products) if (product.photo && product.id !== exceptId) { count++; chars += product.photo.length; }
    return {count, chars};
}
// A replacement does not count the product's own previous photo.
export function photoLimitError(products: readonly {id: string; photo?: string}[], productId: string, photo: string): string | null {
    const usage = photoUsage(products, productId);
    if (usage.count + 1 > PHOTO_MAX_COUNT) return PHOTO_MESSAGES.countLimit;
    if (usage.chars + photo.length > PHOTO_MAX_TOTAL_CHARS) return PHOTO_MESSAGES.totalLimit;
    return null;
}

// Checks before decoding. Windows often reports an empty type, so the extension decides then.
export function sourceFileError(file: {name: string; type: string; size: number}): string | null {
    if (!(file.size <= PHOTO_SOURCE_MAX_BYTES)) return PHOTO_MESSAGES.tooLarge;
    const type = file.type.toLowerCase();
    if (type ? !SOURCE_TYPES.includes(type) : !SOURCE_EXTENSIONS.test(file.name)) return PHOTO_MESSAGES.notImage;
    return null;
}
export function isHeicFile(file: {name: string; type: string}): boolean {
    return /^image\/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

// Never enlarges; keeps the aspect ratio with integer sides of at least 1px.
export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE): {width: number; height: number} {
    const w = Number.isFinite(width) && width > 0 ? width : 1, h = Number.isFinite(height) && height > 0 ? height : 1;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    return {width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale))};
}

// localStorage quota failures differ per engine (Chrome/Safari: name or code 22, Firefox: 1014).
export function isQuotaError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const {name, code} = error as {name?: unknown; code?: unknown};
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}
