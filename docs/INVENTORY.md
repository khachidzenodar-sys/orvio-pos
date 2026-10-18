# ORVIO — კალკულაცია და საწყობი

ეს დოკუმენტი აღწერს ორ ახალ შესაძლებლობას:

1. **კალკულაცია** (ტექნოლოგიური ბარათი). თითოეული კერძისთვის ვწერთ, რომელი ინგრედიენტი და რამდენი შედის მასში. პროგრამა ამით ითვლის კერძის თვითღირებულებას, ფუდქოსტს (%) და მოგებას.
2. **საწყობი**. პროგრამა აღრიცხავს მარაგებს: მიღებას, ჩამოწერას, ინვენტარიზაციას, ნახევარფაბრიკატების წარმოებას და გაყიდვით ავტომატურ ჩამოკლებას.

პირველი ნაწილი მფლობელისთვისაა. მეორე ნაწილი დეველოპერებისთვისაა. მესამე ნაწილი ნაბიჯ-ნაბიჯ ინსტრუქციაა ყოველდღიური მუშაობისთვის.

---

## ნაწილი 1. მარტივად — მფლობელისთვის

### რა გამოჩნდება პროგრამაში

მარცხენა მენიუში ჩნდება ახალი ღილაკი **„საწყობი“**. თუ რომელიმე პროდუქტი იწურება ან მინუსშია, ღილაკზე პატარა რიცხვი გამოჩნდება, მაგალითად `3`. საწყობის გვერდზე რამდენიმე ჩანართია:

| ჩანართი | რას აკეთებს | სჭირდება მენეჯერის კოდი? |
| --- | --- | --- |
| ნაშთები | რა გვაქვს, რამდენი, რა ღირს. აქ ემატება ახალი ინგრედიენტი ან ნახევარფაბრიკატი | ნახვა — არა. დამატება, შეცვლა, ამოღება — კი |
| მიღება | მომწოდებლისგან მიღებული საქონელი: რაოდენობა და ფასი | კი |
| ჩამოწერა | გაფუჭებული, დაზიანებული ან პერსონალის კვებაზე დახარჯული საქონელი, მიზეზით | კი |
| ინვენტარიზაცია | ფაქტობრივი დათვლა. პროგრამა აჩვენებს სხვაობას და ასწორებს ნაშთს | კი |
| წარმოება | ნახევარფაბრიკატის (სოუსი, ცომი) მომზადება პარტიებად | კი |
| კალკულაციები | კერძების ტექნოლოგიური ბარათები და ნახევარფაბრიკატების რეცეპტები | ნახვა — არა. შენახვა — კი |
| მოძრაობები | ყველა ცვლილების ისტორია, ფილტრით: თარიღი, პროდუქტი, ტიპი | არა |
| ფუდქოსტი | თითოეული კერძის ფასი, თვითღირებულება, ფუდქოსტი % და მოგება | არა |

„ანგარიშების“ გვერდზე ასევე გამოჩნდება საწყობის ჯამური ღირებულება და საშუალო ფუდქოსტი.

### ერთეულები

- წონა: კილოგრამი ან გრამი. პროგრამა შიგნით ყოველთვის **გრამს** ინახავს. თუ ჩაწერთ `1.250 კგ`-ს, შეინახება `1250 გ`.
- მოცულობა: ლიტრი ან მილილიტრი. შიგნით ინახება **მილილიტრი**.
- ცალი: მაგალითად კვერცხი ან ბოთლის წყალი. მხოლოდ მთელი რიცხვი.

ეს იგივე წესია, რაც ფულზე: ფული თეთრებში ინახება, რომ ათწილადებზე ცდომილება არ დაგროვდეს. გრამზე უფრო წვრილი რაოდენობა არ გვჭირდება, ამიტომ `0.3333 კგ` პროგრამა არ მიიღებს და ქართულად გეტყვით, რა არის არასწორი.

### როგორ ითვლება ფასი — „საშუალო შეწონილი ფასი“

ყოველი მიღების შემდეგ პროგრამა ითვლის, საშუალოდ რა დაგიჯდათ ერთი კილოგრამი (ლიტრი, ცალი).

**მაგალითი — ყველი.** საწყობში ყველი არ გვაქვს.

1. ორშაბათს მიიღეთ 2 კგ ყველი, კილო 10.00 ₾. საწყობში არის 2 კგ, ღირებულება 20.00 ₾, საშუალო ფასი 10.00 ₾/კგ.
2. ოთხშაბათს მიიღეთ 3 კგ, კილო 12.00 ₾ (36.00 ₾). ახლა არის 5 კგ, ღირებულება 56.00 ₾, საშუალო ფასი 56.00 ÷ 5 = **11.20 ₾/კგ**.
3. 0.5 კგ გაფუჭდა და ჩამოწერეთ. დარჩა 4.5 კგ, ღირებულება 50.40 ₾. დანაკარგი 5.60 ₾ ისტორიაში ჩანს. საშუალო ფასი არ იცვლება.
4. ინვენტარიზაციისას აწონეთ და აღმოჩნდა 4.1 კგ. სხვაობა −400 გ, ანუ −4.48 ₾. ნაშთი ხდება ზუსტად 4.1 კგ.

### კალკულაციის მაგალითი — ხაჭაპური

ხაჭაპური იყიდება 12.00 ₾-ად. ტექნოლოგიური ბარათი:

| ინგრედიენტი | რაოდენობა | საშუალო ფასი | ღირს |
| --- | --- | --- | --- |
| ფქვილი | 200 გ | 2.00 ₾/კგ | 0.40 ₾ |
| ყველი | 250 გ | 16.00 ₾/კგ | 4.00 ₾ |
| კვერცხი | 1 ცალი | 0.40 ₾/ცალი | 0.40 ₾ |
| **სულ თვითღირებულება** | | | **4.80 ₾** |

- ფუდქოსტი: 4.80 ÷ 12.00 = **40.0%**.
- მოგება (მარჟა): 12.00 − 4.80 = **7.20 ₾**.

თუ ყველი გაძვირდება და ახალი მიღების შემდეგ საშუალო ფასი შეიცვლება, ხაჭაპურის თვითღირებულებაც ავტომატურად შეიცვლება.

### ნახევარფაბრიკატი — სოუსის მაგალითი

ტომატის სოუსის ერთი პარტია იძლევა 1 კგ სოუსს. მასში შედის 600 გ პომიდორი (3.00 ₾/კგ, ანუ 1.80 ₾) და 50 გ ნიორი (8.00 ₾/კგ, ანუ 0.40 ₾).

როცა „წარმოებაში“ მიუთითებთ **2 პარტიას**:

- საწყობიდან ჩამოიჭრება 1200 გ პომიდორი და 100 გ ნიორი;
- საწყობს დაემატება 2 კგ სოუსი, ღირებულებით 4.40 ₾ (ზუსტად იმდენი, რამდენიც ინგრედიენტები ღირდა), ანუ 2.20 ₾/კგ.

კერძის ბარათში შეგიძლიათ ჩაწეროთ „ტომატის სოუსი 80 გ“. ასეთი კერძის გაყიდვისას ჩამოიჭრება მხოლოდ **სოუსი**. პომიდორი და ნიორი უკვე ჩამოიჭრა წარმოებისას.

### გაყიდვისას ავტომატური ჩამოჭრა

- მარაგი ჩამოიჭრება მაშინ, როცა მოლარე შეკვეთას **აგზავნის** სამზარეულოში ან ბარში. 3 ხაჭაპური, თითო 250 გ ყველით, ჩამოჭრის 750 გ ყველს.
- იგივე შეკვეთის ხელახლა გაგზავნა ორჯერ არ ჩამოჭრის. ჩამოიჭრება მხოლოდ ახლად დამატებული რაოდენობა.
- უკვე გაგზავნილი პოზიციის გაუქმება მარაგს **არ აბრუნებს**. კერძი უკვე მომზადდა, ეს დანაკარგია.
- კერძი კალკულაციის გარეშე არაფერს ჩამოჭრის. დანამატები (მაგ. „დამატებითი ყველი“) v1-ში არაფერს ჩამოჭრის.
- ბოთლის სასმელისთვის ცალკე რეჟიმი არ გვჭირდება. შექმენით პოზიცია „წყალი 0.5ლ“ ერთეულით „ცალი“ და კერძის ბარათში ჩაწერეთ „1 ცალი“.
- გაყიდვა **არასოდეს იბლოკება**, მაშინაც კი, თუ საწყობში არაფერია. ნაშთი შეიძლება მინუსში წავიდეს. ასეთ შემთხვევაში საწყობის ღილაკზე გამოჩნდება გაფრთხილება.

### გაფრთხილებები

თითოეულ პოზიციას შეიძლება ჰქონდეს „მინიმალური ნაშთი“. თუ ნაშთი ამ ზღვარზე ნაკლები ან ტოლია, პოზიცია გამოჩნდება სიაში „მარაგის გაფრთხილებები → იწურება“. თუ ნაშთი მინუსშია, გამოჩნდება „მინუსში“. გაფრთხილება არცერთ მოქმედებას არ ბლოკავს.

### თქვენი ძველი მონაცემები

განახლების შემდეგ ყველა ძველი შეკვეთა, მენიუ, ჩეკი და ისტორია უცვლელად რჩება. ბრაუზერის დემოში, Windows-ის აპში, ანგარიშით რეჟიმში და სარეზერვო ასლებში ძველ მონაცემებს უბრალოდ ცარიელი საწყობი დაემატება. ახალ დემოს (ან „დემოს განულების“ შემდეგ) უკვე ექნება რამდენიმე საცდელი ინგრედიენტი და კალკულაცია, რომ ფუნქცია მაშინვე სცადოთ. ძველ დემოს საცდელი მარაგი თავისით არ დაემატება.

---

## ნაწილი 2. ტექნიკური აღწერა

### 2.1 ძირითადი გადაწყვეტილებები

| საკითხი | გადაწყვეტილება | მიზეზი |
| --- | --- | --- |
| სად ინახება | `PosState.inventory` — იგივე JSON დოკუმენტი, რომელიც უკვე ინახება localStorage-ში, AppData ფაილში და Supabase-ში | ერთი ტრანზაქცია, ერთი ვერსია, ერთი ბექაპი. ახალი ცხრილი ან ახალი Rust ბრძანება არ გვჭირდება |
| დომენი | ახალი სუფთა მოდული `lib/inventory.ts`. `lib/pos.ts`-ში მხოლოდ მინიმალური ინტეგრაცია | `applyAction` რჩება ერთადერთ შესასვლელად. დემო, `/workspace` და დესკტოპი ერთსა და იმავე წესს იყენებს |
| რაოდენობა | მთელი რიცხვი საბაზო ერთეულში: `g`, `ml`, `pcs` | ათწილადის ცდომილება არ არის |
| ფული | მთელი თეთრი, დამრგვალება half-up, `BigInt` შუალედური ნამრავლით | იგივე წესი, რაც `proportion()`-ში |
| საშუალო ფასი | `avgCost` — მთელი რიცხვი, **თეთრი 1000 საბაზო ერთეულზე** (₾/კგ × 100, ₾/ლ × 100, ცალზე ფასი × 1000) | 11.20 ₾/კგ = `1120`. 0.40 ₾/ცალი = `40000`. ერთი ფორმულა სამივე ერთეულზე |
| ღირებულება | `value` — ნაშთის საბალანსო ღირებულება თეთრში. ინვარიანტი: `quantity ≤ 0 ⇒ value = 0` | უარყოფით ნაშთს ღირებულება არ აქვს (US8). ბოლო `avgCost` ინახება ცალკე |
| ჩამოჭრის მომენტი | `sendOrder`, ახლად გაგზავნილ რაოდენობაზე | ზუსტად ის მომენტი, როცა სამზარეულო იწყებს მომზადებას |
| გაუქმება | გაგზავნილის გაუქმება მარაგს არ აბრუნებს. გაუგზავნელის გაუქმება არაფერს ცვლის | მფლობელის გადაწყვეტილება |
| ბოთლის სასმელი | ცალკე რეჟიმი არ არის. `pcs` ერთეულის პოზიცია + კალკულაცია „1 ცალი“ | ახალი კონცეფცია არ ემატება |
| ისტორიის ზომა | `movements`-ში ინახება ბოლო **5000** ჩანაწერი (`MOVEMENT_LIMIT`). ძველები იშლება, `prunedBefore` აფიქსირებს საზღვარს | ნაშთი პოზიციაზე ინახება, ამიტომ ისტორიის შეკვეცა ნაშთს არ ცვლის. დოკუმენტი localStorage-ის ~5 MB-ში რჩება |
| ავტორიზაცია | 8 ახალი მოქმედება მენეჯერის კოდით. ნახვა კოდის გარეშე | US1–US6 |

### 2.2 მოდულების რუკა

```
lib/
  inventory.ts          ახალი, სუფთა დომენი: ტიპები, მათემატიკა, ვალიდაცია, მოქმედებები,
                        გაყიდვის ჩამოჭრა, ისტორიის შეკვეცა, საცდელი მარაგი. runtime import-ი არ აქვს
                        (მხოლოდ `import type` ./pos-იდან)
  inventory-format.ts   ახალი, სუფთა UI დამხმარე: ერთეულების პარსინგი/ფორმატი, ქართული იარლიყები.
                        runtime import-ი არ აქვს
  pos.ts                PosState.inventory, normalizeState, demoSeedState, 8 ახალი case, sendOrder hook,
                        re-export: INVENTORY_ACTIONS, isValidInventory, emptyInventory
  demo-store.ts         validState + isValidInventory, მიგრაცია parseDemoDocument-ში, managerActions,
                        fresh() → demoSeedState()
  backup.ts             readBackup აბრუნებს stockItems რაოდენობას
app/api/pos/route.ts    მენეჯერის სია + INVENTORY_ACTIONS, პასუხში normalizeState
components/
  stock/                ახალი: საწყობის ეკრანები
  pos-workspace.tsx     ნავიგაცია „საწყობი“ + badge, StockView, ფუდქოსტი ანგარიშებში
  backup-panel.tsx      შეჯამებაში „საწყობის პოზიციები“
```

`src-tauri/`, `desktop/`, `lib/server/*`, `lib/ports/*`, `lib/adapters/*`, `lib/printing/*` არ იცვლება.

### 2.3 Runtime import-ის შეზღუდვა (მნიშვნელოვანია)

`lib/pos.ts`-ს დღეს runtime import-ი არ აქვს. ტესტები მას ორი გზით ტვირთავს:

1. `tests/*.test.ts` — Node `--experimental-strip-types` პირდაპირ: `import … from '../lib/pos.ts'`. Node-ს ESM-ში გაფართოების გარეშე import არ მუშაობს.
2. 9 ცალი `tests/*.test.mjs` — `evaluate('../lib/pos.ts')` (CommonJS transpile). `require`-ი უცნობ დამოკიდებულებაზე შეცდომას ისვრის.

გადაწყვეტა (შემოწმებულია scratch ასლში: `tsc`, `next build` compile და Node strip-types):

```ts
// lib/pos.ts
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {applyInventoryAction, consumeSale, emptyInventory, isValidInventory, seedInventory, INVENTORY_ACTIONS, type Inventory, type InventoryAction} from './inventory.ts';
export {emptyInventory, isValidInventory, INVENTORY_ACTIONS};
export type {Inventory};
```

- `@ts-expect-error` იგივე შაბლონია, რაც ტესტებში. ტიპები მაინც სწორად იხსნება: შემოწმდა, რომ არასწორი ტიპის მინიჭება შეცდომას იძლევა. `tsconfig.json`-ში `allowImportingTsExtensions`-ს **არ ვრთავთ**, რადგან ის 4 ტესტის `@ts-expect-error`-ს „unused“-ად აქცევს.
- Turbopack და Vite `./inventory.ts`-ს პირდაპირ პოულობენ.
- `lib/inventory.ts`-ში დასაშვებია მხოლოდ **erasable** TypeScript: არ გამოიყენოთ `enum`, `namespace`, constructor parameter properties. ტიპი შემოდის მხოლოდ `import type`-ით. სხვა runtime import-ი არ უნდა ჰქონდეს. `crypto`-ც არ გამოიყენება, id-ებს `ctx.newId()` იძლევა.
- 9 `.mjs` ტესტში `evaluate('../lib/pos.ts')` იცვლება ასე: `evaluate('../lib/pos.ts', {'./inventory.ts': evaluate('../lib/inventory.ts')})`. ეს ცვლილება მხოლოდ დამოკიდებულებას ამატებს და ტესტს არ ასუსტებს. ფაილები: `backup`, `demo`, `desktop-parity`, `desktop-restore-edge`, `desktop-store-async`, `escpos-printer`, `integration`, `receipt-layout`, `receipt-options`.
- `lib/demo-store.ts` და `app/api/pos/route.ts` ახალს იღებენ **მხოლოდ** `./pos` / `@/lib/pos`-იდან (re-export). ამიტომ მათი ტესტების import-ის რუკა არ იცვლება.
- `lib/inventory-format.ts`-საც runtime import-ი არ აქვს. `money`-ს ფორმატი იქ ლოკალურად იწერება, რადგან `./format`-ის გაფართოების გარეშე import strip-types-ში არ მუშაობს.

### 2.4 ტიპები — შეთანხმებული კონტრაქტი (`lib/inventory.ts`)

დეველოპერი A ამ ტიპებს **ზუსტად ასე** ქმნის, ტალღა 1-ის პირველივე ნაბიჯად. დეველოპერი B UI-ს ამ ტიპებზე წერს.

```ts
import type {Line, Order, PosState} from './pos';

export type StockUnit = 'g' | 'ml' | 'pcs';            // base units
export type StockKind = 'ingredient' | 'semi';         // semi = ნახევარფაბრიკატი
export type RecipeLine = {itemId: string; quantity: number};   // base units, integer 1..1_000_000
export type BatchRecipe = {output: number; lines: RecipeLine[]}; // output: base units per batch, 1..100_000_000
export type StockItem = {
  id: string;
  name: string;          // trimmed, 1..100 chars, unique case-insensitively
  unit: StockUnit;
  kind: StockKind;
  quantity: number;      // signed safe integer, base units
  value: number;         // tetri, >= 0; always 0 when quantity <= 0
  avgCost: number;       // tetri per 1000 base units, >= 0; kept when stock runs out
  threshold?: number;    // low-stock threshold in base units, >= 0
  batch?: BatchRecipe;   // only for kind === 'semi'
  archived?: boolean;
};
export type ProductRecipe = {productId: string; lines: RecipeLine[]};  // lines non-empty
export type MovementType = 'receipt' | 'sale' | 'writeoff' | 'count' | 'production';
export type Movement = {
  id: string;
  at: string;            // ISO time of the action
  type: MovementType;
  group: string;         // shared by all movements written by one action
  itemId: string;
  quantity: number;      // signed delta in base units, never 0
  value: number;         // signed delta in tetri (receipt: line total; outflow: negative cost)
  orderId?: string; lineId?: string; tableName?: string; productName?: string; // sale
  reason?: string;       // writeoff
  supplier?: string; note?: string; date?: string; // receipt; date = 'YYYY-MM-DD'
};
export type Inventory = {
  items: StockItem[];
  recipes: ProductRecipe[];
  movements: Movement[];  // oldest first, at most MOVEMENT_LIMIT
  prunedBefore?: string;  // ISO time of the newest dropped movement
};

export const INVENTORY_ACTIONS = ['saveStockItem', 'archiveStockItem', 'saveRecipe', 'saveBatchRecipe', 'receiveStock', 'writeOff', 'stockCount', 'produce'] as const;
export type InventoryAction = typeof INVENTORY_ACTIONS[number];
export const MOVEMENT_LIMIT = 5000;
export const WRITE_OFF_REASONS = ['გაფუჭება', 'დაზიანება', 'პერსონალის კვება', 'სხვა'];
export type InventoryContext = {now: string; newId: () => string};

// Pure helpers used by the UI (no PIN needed to call them).
export function emptyInventory(): Inventory;
export function lineCost(quantity: number, avgCost: number): number;          // signed, half-up: sign(q)·round(|q|·avg/1000)
export function stockValue(item: StockItem): number;                          // quantity > 0 ? value : 0
export function totalStockValue(inventory: Inventory): number;                // non-archived items
export function recipeCost(lines: RecipeLine[], items: StockItem[]): number;  // Σ lineCost per line
export function productRecipe(inventory: Inventory, productId: string): RecipeLine[] | undefined;
export type FoodCostRow = {productId: string; name: string; price: number; cost: number; percentTenths: number | null; margin: number};
export function foodCostReport(state: PosState): {rows: FoodCostRow[]; averageTenths: number | null}; // products with a recipe
export function stockAlerts(inventory: Inventory): {low: StockItem[]; negative: StockItem[]; count: number};
export type CountLine = {itemId: string; system: number; counted: number; diff: number; value: number};
export function countPreview(inventory: Inventory, counts: {itemId: string; quantity: number}[]): {lines: CountLine[]; surplus: number; shortage: number};
export function isValidInventory(value: unknown, productIds: string[]): value is Inventory;

// Domain entry points, called only from lib/pos.ts (they mutate the already cloned state).
export function applyInventoryAction(s: PosState, action: InventoryAction, p: Record<string, unknown>, ctx: InventoryContext): string; // returns audit detail
export function consumeSale(s: PosState, order: Order, sent: {line: Line; quantity: number}[], ctx: InventoryContext): void;
export function seedInventory(ctx: InventoryContext): Inventory;
```

`lib/pos.ts`-ში:

```ts
export type PosState = { /* existing fields */; inventory: Inventory };
export function normalizeState(state: Omit<PosState, 'inventory'> & {inventory?: Inventory}): PosState; // missing → emptyInventory(); idempotent; nothing else changes
export function seedState(): PosState;                                // existing seed + emptyInventory()
export function demoSeedState(now?: string): PosState;               // seedState() + seedInventory(...) — only for demo/desktop fresh documents
```

### 2.5 გამოთვლის წესები

ყველა გამოთვლა მთელ რიცხვებზეა. `mulDiv(a, b, d)` = `round_half_up(a·b/d)` არაუარყოფით მნიშვნელობებზე, `BigInt`-ით. ნიშანი ცალკე ემატება. ყველა შედეგი მოწმდება `Number.isSafeInteger`-ით, თორემ შეცდომა: „რაოდენობა ან თანხა დასაშვებ ზღვარს აღემატება“.

- `lineCost(q, avg) = sign(q) · mulDiv(|q|, avg, 1000)`.
- **შემოსვლა** (`inflow(item, q, T)`, q > 0, T ≥ 0 — მიღება ან წარმოების გამოსავალი):
  - თუ `quantity > 0`: `quantity += q; value += T; avgCost = mulDiv(value, 1000, quantity)`.
  - სხვა შემთხვევაში: `avgCost = mulDiv(T, 1000, q); quantity += q; value = quantity > 0 ? lineCost(quantity, avgCost) : 0`.
  - მოძრაობის `value = +T`.
- **გასვლა** (`outflow(item, q)`, q > 0 — გაყიდვა, ჩამოწერა, წარმოების ხარჯი):
  - `amount = (quantity > 0 && q >= quantity) ? value + lineCost(q − quantity, avgCost) : lineCost(q, avgCost)`.
  - `quantity −= q; value = quantity > 0 ? max(0, value − amount) : 0`. `avgCost` არ იცვლება.
  - მოძრაობის `value = −amount`, `quantity = −q`.
- **ინვენტარიზაცია** (`counted = c ≥ 0`): `diff = c − quantity`. თუ `diff = 0`, არაფერი იწერება. სხვა შემთხვევაში `quantity = c; value = c > 0 ? lineCost(c, avgCost) : 0`. მოძრაობა: `quantity = diff, value = lineCost(diff, avgCost)`. `avgCost` არ იცვლება, ამიტომ ნულოვან ან უარყოფით ნაშთზე ნამეტი ფასდება ბოლო საშუალო ფასით.
- **წარმოება** (`n` პარტია): თითოეულ ხაზზე `outflow(line.itemId, line.quantity · n)`. `V = Σ amount`. შემდეგ `inflow(semi, batch.output · n, V)`. ყველა მოძრაობას აქვს ტიპი `production` და საერთო `group`.
- **კალკულაცია**: `recipeCost = Σ lineCost(line.quantity, item.avgCost)`. ფუდქოსტი: `percentTenths = price > 0 ? mulDiv(cost, 1000, price) : null`, `margin = price − cost`. გამოიყენება `product.price` (დანამატების გარეშე). `averageTenths` არის `percentTenths`-ის მარტივი საშუალო მხოლოდ კალკულაციიან პროდუქტებზე, სადაც `price > 0`. ნახევარფაბრიკატის ღირებულება მისი `avgCost`-ით ითვლება.

შემოწმების მაგალითები. ისინი ტესტებში ზუსტად ასე უნდა გამეორდეს:

| შემთხვევა | შედეგი |
| --- | --- |
| 0 → მიღება 2000 გ, T=2000 | qty 2000, value 2000, avg 1000 |
| + მიღება 3000 გ, T=3600 | qty 5000, value 5600, avg 1120 |
| −200 გ → მიღება 1000 გ, T=1200 | qty 800, avg 1200, value 960 |
| 5000 გ / 5600 / 1120 → ჩამოწერა 500 გ | qty 4500, value 5040, მოძრაობა −560 |
| 5000 გ / 1120 → დათვლა 4600 | diff −400, მოძრაობა −448, value 5152 |
| ხაჭაპური 1200: 200 გ × 200, 250 გ × 1600, 1 ცალი × 40000 | 40 + 400 + 40 = 480, 40.0% (`400`), margin 720 |
| სოუსი 1000 გ/პარტია: პომიდორი 600 გ × 300, ნიორი 50 გ × 800; 2 პარტია | −1200 გ (−360), −100 გ (−80), +2000 გ (+440), avg 220 |
| 3 კერძი × 150 გ ყველი, avg 1600 | −450 გ, −720 |

### 2.6 მოქმედებები

ყველა ახალი მოქმედება **მენეჯერისაა**. `applyAction`-ში თითოეული იწყება `assert(manager, 'მენეჯერის კოდი აუცილებელია')`-ით. PIN-ს ამოწმებს demo-store (`verifyPin`) ან API route (`matches`), ზუსტად ისე, როგორც `discount`-ზე. payload-ში PIN არის `pin` ველში. თითოეული წარმატებული მოქმედება წერს ერთ audit ჩანაწერს.

| მოქმედება | payload (`pin`-ის გარდა) | წესები |
| --- | --- | --- |
| `saveStockItem` | `{id?, name, unit, kind, threshold?: number \| null}` | ახალი: `quantity=value=avgCost=0`. სახელი უნიკალურია `trim().toLowerCase()`-ით ყველა პოზიციაში. `kind` შექმნის შემდეგ არ იცვლება. `unit` იცვლება მხოლოდ მაშინ, როცა პოზიციას მოძრაობა არ აქვს და არცერთ კალკულაციაში არ გამოიყენება. `threshold: null` შლის ზღვარს. ამოღებულს რედაქტირება არ შეიძლება |
| `archiveStockItem` | `{id, archived: boolean}` | `true`: უარი, თუ პოზიცია გამოიყენება პროდუქტის კალკულაციაში ან არაამოღებული ნახევარფაბრიკატის რეცეპტში („ჯერ ამოიღეთ კალკულაციებიდან“). `false` აბრუნებს. წაშლა საერთოდ არ არსებობს |
| `saveRecipe` | `{productId, lines: RecipeLine[]}` | პროდუქტი უნდა არსებობდეს. `lines: []` შლის კალკულაციას. ხაზები: არსებული და არაამოღებული პოზიცია, `quantity` 1..1 000 000, ერთი პოზიცია მხოლოდ ერთხელ. მაქსიმუმ 50 ხაზი |
| `saveBatchRecipe` | `{itemId, output, lines}` | `itemId` არის `semi` და არ არის ამოღებული. `lines: []` შლის რეცეპტს. ხაზი თავის თავზე არ უთითებს. ციკლი არ შეიძლება, არც სხვა ნახევარფაბრიკატის გავლით (DFS). ხაზის სხვა წესები იგივეა |
| `receiveStock` | `{date?: 'YYYY-MM-DD', supplier?, note?, lines: {itemId, quantity, total}[]}` | 1..100 ხაზი. `quantity` 1..100 000 000, `total` 0..10 000 000 000 თეთრი. პოზიცია არ არის ამოღებული. ყველაფერი სრულდება ერთად ან საერთოდ არა: `applyAction` კლონზე მუშაობს, ამიტომ შეცდომისას საწყისი state უცვლელია. თითოეულ ხაზზე ერთი `receipt` მოძრაობა |
| `writeOff` | `{itemId, quantity, reason}` | `reason` სავალდებულოა (1..200). მოძრაობა `writeoff`. ნაშთი შეიძლება მინუსში წავიდეს. ამოღებულზეც დაშვებულია |
| `stockCount` | `{counts: {itemId, quantity}[]}` | `quantity` 0..100 000 000. პოზიცია არ მეორდება. ცარიელად დატოვებული პოზიცია payload-ში არ შედის. ერთი `count` მოძრაობა ყოველ შეცვლილზე, საერთო `group`. სხვაობის გარეშე მოძრაობა არ იქმნება. ამოღებულზეც დაშვებულია |
| `produce` | `{itemId, batches}` | `semi`, არაამოღებული, აქვს `batch`. `batches` 1..1000. ინგრედიენტები შეიძლება მინუსში წავიდეს |

`saveProduct` უცვლელია. პროდუქტი არასოდეს იშლება, ამიტომ კალკულაცია `productId`-ზე უსაფრთხოდ მიბმულია.

### 2.7 გაყიდვის ჩამოჭრა (`sendOrder`)

```ts
case 'sendOrder': {
  const o = getOrder();
  const lines = o.lines.map(line => ({line, quantity: line.quantity - line.voidQuantity - line.sentQuantity}));
  ticket(o, lines, 'order');
  consumeSale(s, o, lines.filter(x => x.quantity > 0), ctx);   // new
  for (const x of lines) x.line.sentQuantity += x.quantity;
  break;
}
```

- `consumeSale` თითოეულ ხაზზე პოულობს `productRecipe(line.productId)`-ს. თუ ის არ არსებობს, ხაზს ტოვებს. თითოეულ კალკულაციის ხაზზე აკეთებს `outflow(item, recipe.quantity × quantity)`-ს. მოძრაობა: `type:'sale'`, `orderId`, `lineId`, `tableName`, `productName: line.name`. ერთი `sendOrder`-ის ყველა მოძრაობას აქვს საერთო `group`.
- შეცდომას არასოდეს ისვრის ნაშთის გამო. ერთადერთი შესაძლო შეცდომაა safe-integer-ის გადავსება. კალკულაციის ხაზის ზღვარი 1 000 000 ამას პრაქტიკულად გამორიცხავს.
- `voidItem`, `pay`, `transfer`, `discount`, `closeEmptyOrder`, `addItem` საწყობს არ ეხება.
- განმეორებითი `sendOrder` ახალი რაოდენობის გარეშე არაფერს ჩამოჭრის, რადგან `quantity = 0`. `voidItem` ამცირებს `sentQuantity`-საც და `voidQuantity`-საც, ამიტომ გაუქმებული ერთეული ხელახლა არ იგზავნება და ხელახლა არ ჩამოიჭრება.

### 2.8 `applyAction`-ში ინტეგრაცია

```ts
export function applyAction(original, action, p, manager = false, now = new Date().toISOString()) {
  const s = normalizeState(structuredClone(original));
  const ctx = {now, newId: id};
  ...
  case 'saveStockItem': case 'archiveStockItem': case 'saveRecipe': case 'saveBatchRecipe':
  case 'receiveStock': case 'writeOff': case 'stockCount': case 'produce': {
    assert(manager, 'მენეჯერის კოდი აუცილებელია');
    log(applyInventoryAction(s, action, p, ctx));
    break;
  }
```

`applyInventoryAction` ბოლოს იძახებს `prune(inventory)`-ს: თუ `movements.length > MOVEMENT_LIMIT`, ძველები იშლება და `prunedBefore = ბოლო წაშლილის at`. იგივე ხდება `consumeSale`-ის შემდეგ.

### 2.9 შენახვა, მიგრაცია და ვალიდაცია

**მიგრაცია** (ძველ დოკუმენტს `inventory` არ აქვს):

| ადგილი | რა ხდება |
| --- | --- |
| ბრაუზერის დემო / დესკტოპის ფაილი | `parseDemoDocument`: ჯერ `validState`, შემდეგ `state = normalizeState(state)`. დისკზე არაფერი იწერება მომდევნო მოქმედებამდე. `restoreBackup`-ის „before-restore“ ასლი რჩება ორიგინალი `raw` ტექსტი |
| Supabase (`/workspace`) | route-ის `response()` აბრუნებს `normalizeState(doc.state)`-ს. `applyAction` თავადაც ანორმალიზებს. პირველი ჩაწერისას დოკუმენტს `inventory` დაემატება. სხვა ველებს route არ ეხება |
| სარეზერვო ასლი | `readBackup` იყენებს `parseDemoDocument`-ს, ამიტომ ძველი ბექაპიც მიგრირდება. `formatVersion` რჩება `1` |
| ახალი ანგარიში (Supabase) | `seedState()`, ცარიელი საწყობით. საცდელი მარაგი რეალურ ანგარიშს არ ემატება |
| ახალი დემო / „დემოს განულება“ / ახალი დესკტოპი | `demoSeedState()`, საცდელი მარაგით |

**ვალიდაცია** (`isValidInventory(v, productIds)`, მკაცრი). `validState`-ში ემატება: `&& (v.inventory === undefined || isValidInventory(v.inventory, productIdsOf(v.products)))`. როცა `inventory` არსებობს, ის უნდა იყოს ობიექტი, რომლის `items`, `recipes`, `movements` მასივებია, ხოლო `prunedBefore` ან არ არის, ან თარიღია.

- **items**: უნიკალური `id` (string). `name`: string, `trim()`-ის ტოლი, 1..100. `unit ∈ {g, ml, pcs}`, `kind ∈ {ingredient, semi}`. `quantity`: safe integer, `|q| ≤ 1e15`. `value` და `avgCost`: safe integer ≥ 0. `quantity ≤ 0 ⇒ value === 0`. `threshold`: `undefined` ან safe integer ≥ 0. `archived`: `undefined` ან boolean. `batch` დასაშვებია მხოლოდ `semi`-ზე: `output` safe integer 1..1e8, ხაზები იგივე წესით. ნახევარფაბრიკატების გრაფი აციკლურია.
- **recipe line**: `itemId` არსებულ პოზიციას უთითებს. `quantity`: integer 1..1e6. ერთ რეცეპტში `itemId` არ მეორდება. რეცეპტი 1..50 ხაზს შეიცავს.
- **recipes**: `productId` უნიკალურია და არსებულ პროდუქტს უთითებს. `lines` არ არის ცარიელი.
- **movements**: `id`, `group`: string. `at`: თარიღი. `type ∈ MovementType`. `itemId` არსებულ პოზიციას უთითებს. `quantity`: safe integer ≠ 0. `value`: safe integer. ყველა არასავალდებულო ველი, თუ არსებობს, string-ია. `date`, თუ არსებობს, ემთხვევა `/^\d{4}-\d{2}-\d{2}$/`-ს. რაოდენობა ≤ `MOVEMENT_LIMIT`.
- უცნობი `type`/`unit`/`kind`, არამთელი რიცხვი, არარსებული მითითება ან `inventory: null` → დოკუმენტი დაზიანებულად ითვლება (`corruptError`). დაზიანებული ახალი ველი ვალიდაციას ვერ გაივლის იმით, რომ მას უბრალოდ უგულებელვყოფთ.

**PIN**: `demo-store.ts` → `managerActions = [...existing, ...INVENTORY_ACTIONS]`. `route.ts` → იგივე სია. არასწორი ან ცარიელი PIN: „მენეჯერის კოდი არასწორია“ და იგივე ბლოკირება (5 მცდელობა / 5 წუთი).

**ბექაპი**: `readBackup` აბრუნებს `{createdAt, document, summary, stockItems}`, სადაც `stockItems = document.state.inventory?.items.length ?? 0`. `summary` შეგნებულად უცვლელია (`{orders, products}`), რადგან არსებული ტესტი მას ზუსტად ადარებს. `demo-store.inspectBackup` აბრუნებს `{createdAt, summary, stockItems}`. `BackupPanel` აჩვენებს რიგს „საწყობის პოზიციები“.

### 2.10 საცდელი მარაგი (`seedInventory`)

id-ები დეტერმინისტულია (`stock-flour`, …), ხოლო მოძრაობები იქმნება იმავე `inflow` / `produce` ფუნქციებით. ამიტომ რიცხვები ყოველთვის თანმიმდევრულია. ყველა მოძრაობის `at` არის `ctx.now`.

| id | სახელი | ერთეული | მიღება | avgCost | threshold |
| --- | --- | --- | --- | --- | --- |
| stock-flour | ფქვილი | g | 10000 გ, 2000 | 200 | 2000 |
| stock-cheese | იმერული ყველი | g | 5000 გ, 8000 | 1600 | 1000 |
| stock-egg | კვერცხი | pcs | 60, 2400 | 40000 | 12 |
| stock-butter | კარაქი | g | 2000 გ, 4000 | 2000 | 500 |
| stock-chicken | ქათმის ფილე | g | 4000 გ, 5600 | 1400 | 1000 |
| stock-lettuce | სალათის ფოთოლი | g | 2000 გ, 1600 | 800 | 500 |
| stock-parmesan | პარმეზანი | g | 1000 გ, 4500 | 4500 | 200 |
| stock-oil | ზეითუნის ზეთი | ml | 3000 მლ, 5400 | 1800 | 500 |
| stock-garlic | ნიორი | g | 1000 გ, 800 | 800 | 100 |
| stock-water | წყალი 0.5ლ | pcs | 48, 2880 | 60000 | 12 |
| stock-caesar-sauce | ცეზარის სოუსი (semi) | g | წარმოება 2 პარტია | 1706 | 300 |

- ცეზარის სოუსის პარტია: გამოსავალი 500 გ. შემადგენლობა: კვერცხი 2, ზეთი 300 მლ, პარმეზანი 50 გ, ნიორი 10 გ. 2 პარტიის ხარჯი: 160 + 1080 + 450 + 16 = **1706**. შედეგი: 1000 გ სოუსი, avg 1706.
- კალკულაციები:
  - `product-1` ხაჭაპური (18.00): ფქვილი 200, ყველი 250, კვერცხი 1, კარაქი 20 → 40 + 400 + 40 + 40 = **520**, 28.9%, მარჟა 12.80.
  - `product-2` ცეზარი ქათმით (24.00): ქათამი 150, სალათი 100, პარმეზანი 20, სოუსი 40 → 210 + 80 + 90 + 68 = **448**, 18.7%, მარჟა 19.52.
  - `product-8` წყალი (4.00): წყალი 0.5ლ 1 → **60**, 15.0%.
- სხვა პროდუქტებს კალკულაცია არ აქვს და აჩვენებს „კალკულაცია არ არის“.

### 2.11 დოკუმენტის ზომა

ერთი მოძრაობა JSON-ში ~200–250 სიმბოლოა. 5000 მოძრაობა ≈ 1.2 MB, რაც localStorage-ის ~5 MB-ში ეტევა და Supabase-ის თითოეულ POST-ზე მისაღებია. დატვირთულ რესტორანში ეს ერთი-ორი კვირის ისტორიაა. ნაშთები და ღირებულებები ამაზე არ არის დამოკიდებული. UI აჩვენებს: „ისტორია ხელმისაწვდომია {prunedBefore}-დან. ძველი ისტორიისთვის შეინახეთ სარეზერვო ასლი.“ მომავალში ისტორია შეიძლება ცალკე გასაღებში ან ცხრილში გადავიდეს, დომენის შეცვლის გარეშე.

### 2.12 UI (`components/stock/`)

- `pos-workspace.tsx`: ნავიგაციაში `['stock','▣','საწყობი']` ემატება „ანგარიშების“ წინ, badge-ით `stockAlerts(s.inventory).count`, თუ ის > 0 არის. სათაურია „საწყობი“. `view==='stock'` არენდერებს `<StockView state={s} busy={busy} error={error} act={act}/>`-ს. readOnly (განყოფილების ეკრანი) ნავიგაციას უკვე მალავს. „ანგარიშებში“ ემატება ბლოკი: საწყობის ღირებულება (`totalStockValue`), საშუალო ფუდქოსტი (`averageTenths`) და გაფრთხილებების რაოდენობა.
- `StockView` props: `{state: PosState; busy: boolean; error: string; act: (action: string, payload: Record<string, unknown>) => Promise<unknown>}`. `act` შეცდომისას აბრუნებს `null`-ს, შეცდომის ტექსტი `error` prop-ში მოდის. ფორმების მნიშვნელობები ინახება კომპონენტის ლოკალურ state-ში. 8 წამიანი reload მათ არ შლის.
- ქვე-ჩანართები: `levels` ნაშთები (ნაგულისხმევი), `receipt` მიღება, `writeoff` ჩამოწერა, `count` ინვენტარიზაცია, `production` წარმოება, `recipes` კალკულაციები, `history` მოძრაობები, `foodcost` ფუდქოსტი.
- თითოეულ მენეჯერულ ფორმას აქვს ველი „მენეჯერის კოდი“ (`type=password inputMode=numeric`), რომელიც payload-ში `pin`-ად იგზავნება.
- რაოდენობის ველს აქვს ერთეულის არჩევა: `g` → კგ/გ, `ml` → ლ/მლ, `pcs` → ცალი. მიღებაზე ფასის რეჟიმია „ერთეულის ფასი (₾/კგ, ₾/ლ, ₾/ცალი)“ ან „ხაზის ჯამი (₾)“. შეიძლება ხაზების დამატება და წაშლა. თარიღი ნაგულისხმევად თბილისის დღეა.
- ჩამოწერის მიზეზი: სწრაფი ღილაკები `WRITE_OFF_REASONS` + თავისუფალი ტექსტი.
- ინვენტარიზაცია: ცხრილი აქტიური პოზიციებით (სისტემური ნაშთი + ცარიელი ველი). ქვემოთ `countPreview`-ის სხვაობები, ჯამური ნამეტი და დანაკლისი. დადასტურება PIN-ით.
- კალკულაციები: პროდუქტების სია (ფასი, თვითღირებულება ან „კალკულაცია არ არის“) → რედაქტორი (პოზიცია + რაოდენობა საბაზო ერთეულში, ხაზების ჯამი პირდაპირ ჩანს). ნახევარფაბრიკატების რეცეპტები: გამოსავალი + ხაზები. ამოღებული პოზიციები სელექტორებში არ ჩანს.
- მოძრაობები: ფილტრი თარიღით (დან/ჩათვლით, `Asia/Tbilisi` დღე, როგორც ანგარიშებში), პოზიციით და ტიპით. სვეტები: დრო, პოზიცია, რაოდენობა (+/−), ღირებულება, წყარო (`მაგიდა {tableName} · {productName}`, მიზეზი, მომწოდებელი, „ინვენტარიზაცია“, „წარმოება“). ახალი ჩანაწერები ზემოთ.
- ნაშთები: სახელი, ტიპი, ერთეული, ნაშთი (`4.500 კგ`), საშუალო ფასი (`11.20 ₾/კგ`), ღირებულება. მინუსი ან დაბალი ნაშთი გამოკვეთილია. ქვემოთ ჯამური ღირებულებაა. ზემოთ არის ბლოკი „მარაგის გაფრთხილებები“ ორი ჯგუფით.

`lib/inventory-format.ts` (სუფთა, runtime import-ის გარეშე, ტიპები `import type`-ით):

```ts
export type InputUnit = 'kg' | 'g' | 'l' | 'ml' | 'pcs';
export const unitLabels: Record<StockUnit, string>;          // {g:'კგ/გ', ml:'ლ/მლ', pcs:'ცალი'}
export const kindLabels: Record<StockKind, string>;          // {ingredient:'ინგრედიენტი', semi:'ნახევარფაბრიკატი'}
export const movementLabels: Record<MovementType, string>;   // მიღება, გაყიდვა, ჩამოწერა, ინვენტარიზაცია, წარმოება
export function inputUnits(unit: StockUnit): InputUnit[];    // g→['kg','g'], ml→['l','ml'], pcs→['pcs']
export function parseQuantity(text: string, unit: InputUnit, allowZero?: boolean): number; // base units; throws Georgian Error
export function parseMoney(text: string): number;            // ლარი → თეთრი, ≤ 2 ათწილადი, ≥ 0; throws
export function lineTotal(unitPrice: number, quantity: number, unit: StockUnit): number; // g/ml: mulDiv(price, q, 1000); pcs: price·q
export function formatQuantity(quantity: number, unit: StockUnit): string; // 4500,g→'4.500 კგ'; 450,g→'450 გ'; -200,g→'−200 გ'; 12,pcs→'12 ცალი'
export function formatUnitCost(avgCost: number, unit: StockUnit): string;  // 1120,g→'11.20 ₾/კგ'; 40000,pcs→'0.40 ₾/ცალი'
export function formatPercent(tenths: number | null): string;              // 400→'40.0%'; null→'—'
export function formatMoney(tetri: number): string;                        // same output as lib/format money()
```

`parseQuantity`-ის წესები: `kg`/`l` → მაქსიმუმ 3 ათწილადი (`1.250` → 1250, `0.3333` → შეცდომა). `g`/`ml`/`pcs` → მხოლოდ მთელი რიცხვი. მძიმე `,` მიიღება როგორც წერტილი. უარყოფითი, ცარიელი, `NaN` ან 100 000 000-ზე მეტი რიცხვი შეცდომას იძლევა. ნული დაიშვება მხოლოდ მაშინ, როცა `allowZero` ჩართულია (ინვენტარიზაცია, threshold). შეცდომის ტექსტები: „შეიყვანეთ დადებითი რაოდენობა“, „კილოგრამი/ლიტრი — მაქსიმუმ 3 ათწილადი“, „გრამი, მილილიტრი და ცალი — მხოლოდ მთელი რიცხვი“, „თანხა არასწორია“.

### 2.13 ტესტები

| ფაილი | მფლობელი | რას ამოწმებს |
| --- | --- | --- |
| `tests/inventory.test.ts` | A | 2.5-ის ყველა მაგალითი; ცარიელი/უარყოფითი ნაშთზე მიღება; ჩამოწერა ნაშთზე მეტი; დათვლა 0-მდე, ნამეტი უარყოფით ნაშთზე; წარმოება; ციკლი; დუბლირებული სახელი/ხაზი; ამოღებულის აკრძალვები; unit-ის ცვლილების აკრძალვა; receipt-ის ატომურობა; prune; `isValidInventory` უარყოფს ყველა არასწორ ველს; `seedInventory`-ის რიცხვები (520/448/60, 1706) |
| `tests/inventory-pos.test.ts` | A | `applyAction`: sendOrder ჩამოჭრა (3×150), ხელახლა გაგზავნა, +1 და ხელახლა გაგზავნა, void გაგზავნილის/გაუგზავნელის, დანამატები, closeEmptyOrder, pay/transfer/discount უცვლელია, ნაშთის გარეშე გაგზავნა მინუსში, manager=false → შეცდომა, legacy state (inventory-ის გარეშე) ყველა მოქმედებაზე, `normalizeState` idempotent |
| `tests/inventory-persistence.test.mjs` | A | demo-store: legacy დოკუმენტი იტვირთება და orders/tickets/products/audit უცვლელია; დესკტოპის async storage; route (integration harness): legacy Supabase დოკუმენტი GET/POST; PIN: არასწორი/ცარიელი უარყოფილია demo-ში და route-ში ყველა 8 მოქმედებაზე; დაზიანებული inventory → corrupt; backup: legacy restore, ახალი roundtrip ზუსტად, `stockItems`; fresh დემოს აქვს საცდელი მარაგი, ძველს — არა |
| `tests/inventory-format.test.ts` | B | parse/format ყველა მაგალითით (`1.250 კგ` → 1250, `0.3333` შეცდომა, `-1`, `abc`, `1,5`), `lineTotal`, `formatQuantity`, `formatUnitCost`, `formatPercent` |

არსებული 119 ტესტი უცვლელად უნდა გავიდეს. ერთადერთი დაშვებული ცვლილება ძველ ტესტებში არის 2.3-ში აღწერილი `evaluate` რუკის დამატება.

### 2.14 შესრულების ტალღები და ფაილების მფლობელობა

**დეველოპერი A (დომენი + შენახვა):** `lib/inventory.ts`, `lib/pos.ts`, `lib/demo-store.ts`, `lib/backup.ts`, `app/api/pos/route.ts`, `lib/server/**`, `tests/**` (გარდა `tests/inventory-format.test.ts`), `docs/ARCHITECTURE.md`, `tsconfig.json`, `package.json`.

**დეველოპერი B (UI + მომხმარებლის დოკუმენტაცია):** `lib/inventory-format.ts`, `tests/inventory-format.test.ts`, `components/stock/**`, `components/pos-workspace.tsx`, `components/backup-panel.tsx`, `app/globals.css`, `docs/INVENTORY.md` (ტალღა 3-დან, ნაწილი 3), `docs/DEMO.md`.

სხვის ფაილში ცვლილება საჭირო თუ გახდა, დეველოპერი მას `openIssues`-ში წერს.

| ტალღა | A | B |
| --- | --- | --- |
| 1 | `lib/inventory.ts` (ჯერ 2.4-ის ტიპები, შემდეგ ლოგიკა) + `tests/inventory.test.ts`. `lib/pos.ts`-ის ინტეგრაცია + 9 ტესტის `evaluate` რუკა + `tests/inventory-pos.test.ts` | `lib/inventory-format.ts` + ტესტი. `components/stock/`: `stock-view.tsx`, `stock-levels.tsx` (სია, ჯამები, გაფრთხილებები, პოზიციის ფორმა), `stock-reports.tsx` (მოძრაობები, ფუდქოსტი) |
| 2 | demo-store (ვალიდაცია, მიგრაცია, PIN, demoSeedState), backup `stockItems`, route, `tests/inventory-persistence.test.mjs` | `stock-forms.tsx` (მიღება, ჩამოწერა, ინვენტარიზაცია, წარმოება), `recipe-editor.tsx`, pos-workspace wiring, backup-panel, CSS |
| 3 | სრული შემოწმება, ხარვეზების გასწორება B-ს openIssues-ით, `docs/ARCHITECTURE.md`-ში ბმული და შედეგები | UX გავლა, ნაწილი 3 („როგორ გამოვიყენოთ“) ამ დოკუმენტში, `docs/DEMO.md` |

### 2.15 შემოწმების ბრძანებები

`pnpm test` · `pnpm typecheck` · `pnpm lint` (მხოლოდ 10 ძველი შეცდომა) · `pnpm build` · `pnpm desktop:build` · `cargo test --manifest-path src-tauri/Cargo.toml` (უცვლელი) · `git status`-ში `src-tauri/`, `desktop/`, `lib/server/` არ იცვლება.

---

## ნაწილი 3. როგორ გამოვიყენოთ

ეს ნაწილი ნაბიჯ-ნაბიჯ გიჩვენებთ, როგორ იმუშაოთ საწყობთან. ყველა ღილაკი და ჩანართი პროგრამაში ზუსტად ასე ჰქვია, როგორც აქ წერია.

**მენეჯერის კოდი.** ყველა ცვლილებას (დამატება, მიღება, ჩამოწერა, ინვენტარიზაცია, წარმოება, კალკულაციის შენახვა) სჭირდება მენეჯერის კოდი. ის ფორმის ბოლოშია, ველში „მენეჯერის კოდი“. ნაშთების, ისტორიისა და ფუდქოსტის ნახვას კოდი არ სჭირდება.

**რაოდენობის ჩაწერა.** რაოდენობის ველის გვერდით არის ერთეულის არჩევა: კგ ან გ, ლ ან მლ, ცალი. კილოგრამსა და ლიტრში შეგიძლიათ ჩაწეროთ მაქსიმუმ 3 ციფრი წერტილის შემდეგ, მაგალითად `1.250`. მძიმეც მიიღება: `1,250`. გრამი, მილილიტრი და ცალი მხოლოდ მთელი რიცხვია.

### 1. ინგრედიენტის დამატება

1. გახსენით **საწყობი → ნაშთები**.
2. დააჭირეთ **„+ პოზიცია“**.
3. ჩაწერეთ დასახელება, მაგალითად „იმერული ყველი“.
4. აირჩიეთ ერთეული: „კგ/გ“ წონისთვის, „ლ/მლ“ სითხისთვის, „ცალი“ ცალობითისთვის.
5. ტიპი: „ინგრედიენტი“. სოუსისთვის ან ცომისთვის აირჩიეთ „ნახევარფაბრიკატი“.
6. სურვილისამებრ ჩაწერეთ „მინიმალური ნაშთი“, მაგალითად `1.250 კგ`. როცა მარაგი ამაზე ნაკლები ან ტოლი გახდება, პროგრამა გაგაფრთხილებთ.
7. ჩაწერეთ მენეჯერის კოდი და დააჭირეთ **„შენახვა“**.

ახალი პოზიციის ნაშთი ნულია. მარაგი მიღებით ემატება.

ერთეული და ტიპი შექმნის შემდეგ აღარ იცვლება. სახელისა და მინიმალური ნაშთის შეცვლა „რედაქტირებით“ შეიძლება. თუ პოზიცია აღარ გჭირდებათ, დააჭირეთ **„ამოღება“**. ის ისტორიაში რჩება, მაგრამ სიებში აღარ ჩანს. „ამოღებულების ჩვენება“ აჩვენებს მათ და „დაბრუნებით“ შეგიძლიათ აღადგინოთ. თუ ნახევარფაბრიკატის რეცეპტში ამოღებული ინგრედიენტია, ჯერ ის ინგრედიენტი დააბრუნეთ, შემდეგ კი ნახევარფაბრიკატი — წინააღმდეგ შემთხვევაში პროგრამა გეტყვით: „ჯერ დააბრუნეთ რეცეპტის პოზიცია: <სახელი>“.

### 2. საქონლის მიღება მომწოდებლისგან

1. გახსენით **საწყობი → მიღება**.
2. თარიღი თავისით დგება დღევანდელზე. საჭიროების შემთხვევაში შეცვალეთ.
3. ჩაწერეთ მომწოდებელი და შენიშვნა (არასავალდებულოა).
4. ხაზში აირჩიეთ პოზიცია, ჩაწერეთ რაოდენობა და ერთეული.
5. ჩაწერეთ ფასი. აირჩიეთ, რას წერთ:
   - **„ერთეულის ფასი“**: ერთი კილოგრამის, ლიტრის ან ცალის ფასი. მაგალითად 2 კგ, კილო 10.00 ₾.
   - **„ხაზის ჯამი“**: მთლიანი თანხა ზედნადებიდან. მაგალითად 3 კგ ჯამში 36.00 ₾.
6. მეტი პროდუქტისთვის დააჭირეთ **„+ ხაზი“**. ზედმეტ ხაზს „×“ შლის.
7. შეამოწმეთ „მიღების ჯამი“. ის ზედნადების ჯამს უნდა ემთხვეოდეს.
8. ჩაწერეთ კოდი და დააჭირეთ **„მიღების დადასტურება“**.

მწვანე შეტყობინება „მიღება შენახულია“ ნიშნავს, რომ ნაშთი და საშუალო ფასი განახლდა. მაგალითად, 2 კგ 10.00 ₾-ად და შემდეგ 3 კგ 12.00 ₾-ად იძლევა საშუალო ფასს **11.20 ₾/კგ**.

### 3. კერძის კალკულაცია (ტექნოლოგიური ბარათი)

1. გახსენით **საწყობი → კალკულაციები**.
2. ზედა ცხრილში მენიუს ყველა კერძია. დააჭირეთ კერძის გვერდით **„დამატება“** (ან **„რედაქტირება“**, თუ ბარათი უკვე არსებობს).
3. თითო ხაზზე აირჩიეთ ინგრედიენტი და ჩაწერეთ, რამდენი შედის **ერთ** პორციაში. მაგალითად „იმერული ყველი 250 გ“.
4. ახალი ხაზისთვის დააჭირეთ **„+ ინგრედიენტი“**. ერთი ინგრედიენტი ბარათში მხოლოდ ერთხელ შეიძლება.
5. ქვემოთ მაშინვე ჩანს თვითღირებულება, ფუდქოსტი და მარჟა.
6. ჩაწერეთ კოდი და დააჭირეთ **„შენახვა“**.

ბარათში ნახევარფაბრიკატიც შეგიძლიათ ჩაწეროთ, მაგალითად „ცეზარის სოუსი 40 გ“.

ბოთლის სასმელი (წყალი, ლიმონათი): შექმენით პოზიცია ერთეულით „ცალი“ და კერძის ბარათში ჩაწერეთ „1 ცალი“.

ბარათის წასაშლელად გახსენით ის და დააჭირეთ **„კალკულაციის წაშლა“**. ბარათის გარეშე კერძი საწყობიდან არაფერს ჩამოჭრის.

### 4. ნახევარფაბრიკატი: რეცეპტი და წარმოება

**რეცეპტი (ერთხელ):**

1. „ნაშთებში“ დაამატეთ პოზიცია ტიპით **„ნახევარფაბრიკატი“**, მაგალითად „ცეზარის სოუსი“, ერთეული „კგ/გ“.
2. გახსენით **კალკულაციები**. ქვედა ცხრილში „ნახევარფაბრიკატების რეცეპტები“ დააჭირეთ **„დამატება“**.
3. ჩაწერეთ „გამოსავალი ერთ პარტიაზე“. ეს არის რამდენი სოუსი გამოდის ერთი მომზადებით, მაგალითად `500 გ`.
4. დაამატეთ ინგრედიენტები, რაც ერთ პარტიაში შედის.
5. ჩაწერეთ კოდი და შეინახეთ.

**წარმოება (ყოველ ჯერზე, როცა ამზადებთ):**

1. გახსენით **საწყობი → წარმოება**.
2. აირჩიეთ ნახევარფაბრიკატი და ჩაწერეთ პარტიების რაოდენობა.
3. ცხრილი გიჩვენებთ, რამდენი ინგრედიენტი დაიხარჯება და რა დარჩება. თუ რომელიმე მინუსში წავა, დაინახავთ ნიშანს „მინუსში წავა“. წარმოება მაინც დაიშვება.
4. ჩაწერეთ კოდი და დააჭირეთ **„წარმოება“**.

ინგრედიენტები ჩამოიჭრება, სოუსი კი დაემატება საწყობს. სოუსის ღირებულება ზუსტად იმდენია, რამდენიც დახარჯული ინგრედიენტები ღირდა. ფორმაში ნაჩვენები ღირებულება მიახლოებითია, ზუსტი თანხა „მოძრაობებში“ ჩანს.

### 5. ჩამოწერა (გაფუჭება, დაზიანება, პერსონალის კვება)

1. გახსენით **საწყობი → ჩამოწერა**.
2. აირჩიეთ პოზიცია და ჩაწერეთ რაოდენობა, მაგალითად `500 გ`.
3. აირჩიეთ მიზეზი ღილაკით („გაფუჭება“, „დაზიანება“, „პერსონალის კვება“, „სხვა“) ან ჩაწერეთ საკუთარი.
4. ჩაწერეთ კოდი და დააჭირეთ **„ჩამოწერა“**.

ფორმაში ჩანს მიმდინარე ნაშთი და დანაკარგის მიახლოებითი ღირებულება. საშუალო ფასი ჩამოწერით არ იცვლება.

### 6. ინვენტარიზაცია (დათვლა)

1. აწონეთ და დაითვალეთ, რაც რეალურად გაქვთ.
2. გახსენით **საწყობი → ინვენტარიზაცია**.
3. ცხრილში ჩანს ყველა პოზიცია და მისი „სისტემური ნაშთი“. სვეტში „ფაქტობრივი“ ჩაწერეთ დათვლილი რაოდენობა, მაგალითად `4600 გ`.
4. ცარიელი ველი ნიშნავს „არ დამითვლია“. ასეთი პოზიცია არ შეიცვლება. თუ პროდუქტი საერთოდ აღარ გაქვთ, ჩაწერეთ `0`.
5. ქვემოთ, „სხვაობებში“, ჩანს რა შეიცვლება: რამდენით მეტი (ნამეტი) ან ნაკლები (დანაკლისი) და რა ღირს.
6. ჩაწერეთ კოდი და დააჭირეთ **„ნაშთის გასწორება“**.

ამის შემდეგ ნაშთი ზუსტად დათვლილი გახდება. სხვაობები ისტორიაში ჩაიწერება ტიპით „ინვენტარიზაცია“.

### 7. რა ხდება გაყიდვისას

თქვენ არაფრის გაკეთება არ გჭირდებათ. როცა მოლარე შეკვეთას აგზავნის სამზარეულოში ან ბარში, პროგრამა თავად ჩამოჭრის ინგრედიენტებს კალკულაციის მიხედვით. 2 ხაჭაპური ჩამოჭრის ორი პორციის ფქვილს, ყველს, კვერცხსა და კარაქს.

- გაყიდვა არასოდეს იბლოკება. თუ მარაგი არ არის, ნაშთი მინუსში წავა.
- უკვე გაგზავნილი კერძის გაუქმება მარაგს არ აბრუნებს.
- სამზარეულოს ცალკე ეკრანზე საწყობი არ ჩანს. იქ მხოლოდ ჩეკებია.

### 8. გაფრთხილებები

- მარცხენა მენიუში ღილაკ **„საწყობზე“** ჩნდება წითელი რიცხვი. ეს არის რამდენ პოზიციას სჭირდება ყურადღება.
- **საწყობი → ნაშთები** გვერდის თავში არის ბლოკი **„მარაგის გაფრთხილებები“**:
  - **„მინუსში“** (წითელი): გაყიდულია იმაზე მეტი, ვიდრე საწყობში ეწერა. ჩვეულებრივ ეს ნიშნავს, რომ მიღება არ შეგიყვანიათ. შეიყვანეთ მიღება ან გააკეთეთ ინვენტარიზაცია.
  - **„იწურება“** (ყვითელი): ნაშთი მინიმალურ ზღვარზე ნაკლები ან ტოლია. დროა შეუკვეთოთ.
- ცხრილში მინუსიანი სტრიქონი წითლად არის გამოკვეთილი.

### 9. ანგარიშები

- **საწყობი → ფუდქოსტი**: თითოეული კერძის ფასი, თვითღირებულება, ფუდქოსტი % და მარჟა (ფასს გამოკლებული თვითღირებულება). ქვემოთ არის საშუალო ფუდქოსტი და კერძები, რომლებსაც კალკულაცია არ აქვთ.
  - მაგალითი დემოდან: ხაჭაპური 5.20 ₾ (28.9%), ცეზარი ქათმით 4.48 ₾ (18.7%), წყალი 0.60 ₾ (15.0%).
  - თუ ფუდქოსტი ძალიან მაღალია, ან ფასი გაზარდეთ, ან ბარათი გადახედეთ.
- **საწყობი → მოძრაობები**: ყველა ცვლილება ახლიდან ძველისკენ. შეგიძლიათ გაფილტროთ თარიღით, პოზიციით და ტიპით („მიღება“, „გაყიდვა“, „ჩამოწერა“, „ინვენტარიზაცია“, „წარმოება“). გაყიდვისას წყაროში ჩანს მაგიდა და კერძი.
- **საწყობი → ნაშთები**: რამდენი გაქვთ, საშუალო ფასი და ღირებულება. ბოლოში არის საწყობის ჯამური ღირებულება.
- **ანგარიშები** გვერდზე არის ბლოკი „საწყობი“: საწყობის ღირებულება, საშუალო ფუდქოსტი და გაფრთხილებების რაოდენობა.

ძალიან დიდი ისტორიის შემთხვევაში (5000-ზე მეტი ჩანაწერი) ყველაზე ძველი ჩანაწერები იშლება. ნაშთები ამით არ იცვლება. ძველი ისტორიის შესანახად დროდადრო შეინახეთ სარეზერვო ასლი.

### 10. ძველი მონაცემები და სარეზერვო ასლები

- განახლების შემდეგ ყველა ძველი შეკვეთა, მენიუ, ჩეკი და ანგარიში ადგილზე რჩება. საწყობი თავიდან ცარიელია. დაიწყეთ ინგრედიენტების დამატებით და პირველი ინვენტარიზაციით ან მიღებით.
- ახალ დემოს და „დემოს განულების“ შემდეგ უკვე აქვს საცდელი ინგრედიენტები, სამი კალკულაცია და ცეზარის სოუსი.
- Windows-ის აპში **მართვა → სარეზერვო ასლი** ინახავს ყველაფერს, საწყობის ჩათვლით.
- აღდგენისას ფანჯარაში ჩანს, რამდენი შეკვეთა, პროდუქტი და **საწყობის პოზიცია** არის ფაილში. აღდგენა ცვლის საწყობსაც.
- ძველი სარეზერვო ასლი (საწყობამდე შექმნილი) უპრობლემოდ აღდგება. საწყობი მაშინ ცარიელი იქნება.
