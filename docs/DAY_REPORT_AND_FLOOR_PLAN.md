# დღის ანგარიში და მაგიდების რუკა — დიზაინი

ეს დოკუმენტი აღწერს სამ ცვლილებას:

1. შეკვეთის ეკრანზე კერძის ბარათიდან ქრება ზედმეტი „+“ ნიშანი.
2. ემატება „დღის ანგარიში“: დღის შემოსავალი, სალაროს შემოწმება და დღის დახურვის შენახვა.
3. მაგიდები ჩანს დარბაზის რუკაზე: რეალური ფორმით, ზომით და სკამებით.

პირველი ნაწილი მფლობელისთვისაა და ტექნიკურ ცოდნას არ საჭიროებს. მეორე ნაწილი პროგრამისტებისთვისაა.

---

## ნაწილი I — მარტივად

### 1. კერძის ბარათი „+“-ის გარეშე

კერძის ბარათზე ერთი დაჭერა უკვე ამატებს ერთ ულუფას. სამი დაჭერა ნიშნავს სამ ულუფას. ამიტომ მწვანე „+“ ზედმეტია და ქრება. ბარათზე რჩება კატეგორია, სახელი და ფასი. ქვემოთ რჩება ღილაკი „რაოდენობა / შენიშვნა / დანამატი“. მაგიდის ბარათებიდანაც ქრება დეკორატიული ისარი „→“.

### 2. დღის ანგარიში

**სად არის:** „ანგარიშები“ → „დღის ანგარიში“. თარიღი თავიდანვე დღევანდელია, მაგრამ შეგიძლიათ სხვა დღეც აირჩიოთ.

**რა არის „დღე“:** საქართველოს დროით 00:00-დან 23:59:59-მდე. ეს ის დროა, რომელსაც ჩეკები და სარეზერვო ასლები უკვე იყენებს. ანგარიში ასე არ არის დამოკიდებული კომპიუტერის საათის სარტყელზე. თუ მაგიდა 23:50-ზე გაიხსნა და 00:20-ზე გადაიხადა, ანგარიში მომდევნო დღეს ჩაითვლება, რადგან დღე გადახდის მომენტით ისაზღვრება.

**რა ითვლება:**

| სტრიქონი | რას ნიშნავს |
| --- | --- |
| დახურული ანგარიშები | ამ დღეს ბოლომდე გადახდილი ანგარიშები. გაყოფილი გადახდა ერთ ანგარიშად ითვლება. ცარიელად გათავისუფლებული მაგიდა ანგარიშად არ ითვლება |
| მთლიანი გაყიდვები | დახურული ანგარიშების ჯამი ფასდაკლებამდე. გაუქმებული პოზიციები მასში აღარ შედის |
| ფასდაკლებები | ამ ანგარიშების ფასდაკლებების ჯამი |
| წმინდა გაყიდვები | მთლიანს გამოკლებული ფასდაკლება |
| გაუქმებები | დახურულ ანგარიშებში გაუქმებული ულუფების რაოდენობა და ღირებულება. ღია ანგარიშის გაუქმება ჩანს ღია ანგარიშების სიაში |
| ნაღდი / ბარათი / სხვა | ამ დღეს მიღებული ყველა გადახდა მეთოდის მიხედვით. ღია ანგარიშის ნაწილობრივი გადახდაც ჩაითვლება |
| ღია ანგარიშები | მაგიდები, რომლებიც ახლაც გადაუხდელია: მაგიდა და დარჩენილი თანხა |
| საშუალო ჩეკი | წმინდა გაყიდვები ÷ დახურული ანგარიშები. თუ ანგარიში არ არის, აჩვენებს 0.00-ს |

**მაგალითი — 2026 წლის 22 ოქტომბერი:**

| ანგარიში | შეკვეთა | გადახდა |
| --- | --- | --- |
| A, მაგიდა 1 | 42.00 ₾ | 20.00 ნაღდი + 22.00 ბარათი (გაყოფილი) |
| B, მაგიდა 2 | 60.00 ₾ + 1 კაპუჩინო (8.00 ₾) გაუქმდა, ფასდაკლება 5.00 ₾ | 55.00 ბარათი |
| C, მაგიდა 3 | 20.00 ₾ | 20.00 ბარათი |
| D, მაგიდა 9 | 15.50 ₾, ჯერ გადაუხდელია | — |

ანგარიში აჩვენებს:

- დახურული ანგარიშები: **3**. A ერთხელ ითვლება, თუმცა ორჯერ გადაიხადეს.
- მთლიანი: 42 + 60 + 20 = **122.00**; ფასდაკლება **5.00**; წმინდა **117.00**.
- გაუქმება: **1 ც. / 8.00**.
- ნაღდი **20.00**, ბარათი 22 + 55 + 20 = **97.00**, სხვა **0.00**, სულ **117.00**.
- ღია ანგარიში: **1**, მაგიდა 9, **15.50**.
- საშუალო ჩეკი: 117 ÷ 3 = **39.00**.

### 3. სალაროს შემოწმება

დილით სალაროში ხურდისთვის რაღაც თანხა რჩება. მაგალითად, 100 ლარი. საღამოს უჯრაში უნდა იყოს:

> **მოსალოდნელი ნაღდი = დილის თანხა + დღის ნაღდი გადახდები** = 100.00 + 20.00 = **120.00**

ბარათით და „სხვა“ მეთოდით გადახდილი თანხა უჯრაში არ დევს, ამიტომ აქ არ ითვლება.

მენეჯერი ითვლის ფულს და შეაქვს „დათვლილი ნაღდი“. პროგრამა მაშინვე აჩვენებს სხვაობას:

| დათვლილი | სხვაობა |
| --- | --- |
| 118.50 | **−1.50 დანაკლისი** (წითლად) |
| 121.00 | **+1.00 ზედმეტობა** |
| 120.00 | **0.00 ემთხვევა** |

ველში იწერება 0 ან მეტი, მაქსიმუმ 2 ციფრით წერტილის (ან მძიმის) შემდეგ. სხვა რამის შეყვანისას ჩანს შეცდომის ქართული ტექსტი.

### 4. დღის დახურვა

ღილაკი **„დღის დახურვა“** ითხოვს მენეჯერის კოდს. დემოში კოდია 1234. დახურვა ინახავს ჩანაწერს: თარიღს, ყველა ჯამს, დილის თანხას, მოსალოდნელ და დათვლილ ნაღდს, სხვაობას, შენიშვნას, დახურვის დროსა და დამხურავის სახელს, თუ ის ჩაწერილია.

- დახურვა **არ ბლოკავს** გაყიდვას და **არ ცვლის** შეკვეთებს. თუ დახურვის შემდეგ კიდევ გაყიდეთ, ცოცხალი ანგარიში ამ გაყიდვას აჩვენებს. შენახული ჩანაწერი კი უცვლელი რჩება.
- იგივე დღის ხელახლა დახურვა **ახალ ჩანაწერს** ქმნის ნიშნით „განმეორებითი დახურვა #2“. ძველი ჩანაწერი არასოდეს იშლება.
- „დახურვების ისტორია“ აჩვენებს ყველა დახურვას. ახალი ზემოთაა. ჩანაწერის გახსნისას ჩანს ზუსტად ის, რაც დახურვისას შეინახა.
- ცოცხალი ანგარიშიც და შენახული დახურვაც იბეჭდება 80 მმ ჩეკის პრინტერზე. ვებში იბეჭდება ბრაუზერის ფანჯრიდან. ცოცხალ ანგარიშზე „დათვლილი“ და „სხვაობა“ იბეჭდება როგორც „—“. დათვლილი ნაღდით ჩეკისთვის ჯერ დახურეთ დღე, შემდეგ **დახურვების ისტორია → ნახვა → ბეჭდვა**.

**სად არის:** ანგარიშები → **დღის ანგარიში** → **მიმდინარე** (ცოცხალი ანგარიში) ან **დახურვების ისტორია**.

### 5. მაგიდების რუკა

„მაგიდები“ ეკრანზე თითოეული ზონა, მაგალითად დარბაზი ან ტერასა, ჩანს როგორც გეგმა ზემოდან. მაგიდებს აქვთ:

- **ადგილები:** 1-დან 20-მდე. რაც მეტი ადგილია, მით დიდია მაგიდა. თითო ადგილზე ერთი სკამი იხატება.
- **ფორმა:** მრგვალი, კვადრატული ან მართკუთხა. 6–8 კაციანი მართკუთხა მაგიდა გრძელია, 2 კაციანი კი პატარა.
- **ადგილი რუკაზე** და საჭიროების შემთხვევაში **90°-ით შემობრუნება**.

ფერები:

| ფერი | ნიშნავს |
| --- | --- |
| მწვანე | თავისუფალი |
| ყვითელი | დაკავებული |
| ლურჯი | აქვს განყოფილებაში გაუგზავნელი პოზიცია |
| აგურისფერი | ნაწილობრივ გადახდილი |

თუ რამდენიმე პირობა ერთად სრულდება, ჩანს უფრო მნიშვნელოვანი: ნაწილობრივ გადახდილი, შემდეგ გაუგზავნელი, შემდეგ დაკავებული. მაგიდაზე წერია ნომერი, ადგილების რაოდენობა და, თუ დაკავებულია, გადასახდელი თანხა, მაგალითად 15.50 ₾. მაგიდაზე დაჭერა ხსნის შეკვეთას, როგორც ახლა. ზემოთ გადამრთველით „რუკა / ბადე“ შეგიძლიათ ძველ ბადეზეც გადახვიდეთ.

**განლაგების რედაქტირება:** ჯერ ზემოთ აირჩიეთ ერთი ზონა (მაგ. „დარბაზი“) — „ყველა ზონის“ დროს რედაქტირება გამორთულია. შემდეგ დააჭირეთ „განლაგების რედაქტირებას“. მაგიდის ასარჩევად დააჭირეთ მას; გვერდით პანელში −/+ ღილაკებით ცვლით ადგილებს, ფორმის ღილაკებით კი ფორმას. მაგიდებს გადაადგილებს მაუსით ან თითით და ცვლის სახელს, ადგილებს, ფორმასა და შემობრუნებას. შეუძლია მაგიდის დამატება და ამოღება. ღია შეკვეთის მქონე მაგიდის ამოღება შეუძლებელია. „შენახვა“ ითხოვს კოდს და ყველა ცვლილებას ერთად ინახავს. „გაუქმება“ ცვლილებებს აუქმებს. რედაქტირების დროს გაყიდვა გრძელდება.

**ძველი მონაცემები:** არსებული მაგიდები ავტომატურად ლაგდება მწკრივებად: 4 ადგილი, კვადრატი. არც ერთი შეკვეთა, სარეზერვო ასლი ან პარამეტრი არ იკარგება.

---

## ნაწილი II — ტექნიკური დიზაინი

### 6. პრინციპები

- ბიზნესლოგიკა პატარა, სუფთა მოდულებშია: `lib/day-report.ts`, `lib/floor-plan.ts` და `lib/order-totals.ts`. თანხა ყველგან მთელ თეთრებში ითვლება.
- ახალი ცვლილება შეიძლება მხოლოდ `applyAction` გაიაროს (`lib/pos.ts`). დემო, `/workspace` (Supabase) და desktop ერთსა და იმავე წესებს იყენებენ.
- მენეჯერის ახალი მოქმედებებია **`closeDay`** და **`saveFloorPlan`**. ორივე ემატება **ორივე** `managerActions` სიას: `lib/demo-store.ts` და `app/api/pos/route.ts`.
- ახალი ველები არასავალდებულოა (`Table.layout?`, `PosState.dayCloses?`). ძველი დოკუმენტები უცვლელად იტვირთება. თუ ველი არსებობს, `validState` მას მკაცრად ამოწმებს.
- ახალი lib მოდულები Node strip-types-ით მუშაობს: არ შეიძლება `enum`, `namespace` ან parameter properties. lib-ის შიდა runtime import იწერება `.ts` გაფართოებით და `// @ts-expect-error` კომენტარით, როგორც `pos.ts`-ში `./inventory.ts`. ტიპის import იწერება `import type`-ით, გაფართოების გარეშე.
- `lib/floor-plan.ts`-ს **runtime import არ აქვს**. `lib/day-report.ts` runtime-ში მხოლოდ `./order-totals.ts`-ს იყენებს. ეს საჭიროა, რადგან `.mjs` ტესტები მოდულებს `evaluate()`-ით მკაცრი import-რუკით ტვირთავს.

### 7. მოდულები და დამოკიდებულებები

```
lib/order-totals.ts   (ახალი; orderTotals, lineBalances, proportion — pos.ts-დან უცვლელად გადმოტანილი)
      ▲         ▲
      │         └── lib/day-report.ts (ახალი, A)
      │                   ▲
lib/pos.ts ───────────────┤ imports: ./inventory.ts, ./order-totals.ts, ./day-report.ts, ./floor-plan.ts
      │                   └── lib/floor-plan.ts (ახალი, B; მხოლოდ type import-ები pos-იდან)
      ▼ re-exports: orderTotals, lineBalances, isValidDayCloses, isValidTableLayout
lib/demo-store.ts (იღებს მხოლოდ ./pos-დან, როგორც ახლა)
```

`pos.ts` აგრძელებს `orderTotals` და `lineBalances` ექსპორტს, ამიტომ არსებული `import {orderTotals} from '@/lib/pos'` უცვლელი რჩება.

**ტესტების ჩართვა:** იქმნება `tests/helpers/load-domain.mjs`:

```js
// Builds lib/pos.ts with its runtime dependencies for tests that evaluate TypeScript directly.
export function loadDomain(evaluate, {inventory} = {}) {
  const totals = evaluate('../lib/order-totals.ts');
  return evaluate('../lib/pos.ts', {
    './inventory.ts': inventory ?? evaluate('../lib/inventory.ts'),
    './order-totals.ts': totals,
    './day-report.ts': evaluate('../lib/day-report.ts', {'./order-totals.ts': totals}),
    './floor-plan.ts': evaluate('../lib/floor-plan.ts'), // added in wave 2
  });
}
```

ბილიკები ტესტის ფაილის `import.meta.url`-ით იხსნება, რადგან `evaluate` ტესტის ფაილშია. ამიტომ `../lib/...` სწორია. ქვემოთ ჩამოთვლილ ფაილებში `evaluate('../lib/pos.ts', {...})` იცვლება `loadDomain(evaluate)`-ით, ხოლო `inventory-tester1-wave2`-ში `loadDomain(evaluate, {inventory})`-ით. ტესტის შინაარსი არ იცვლება.

`backup`, `demo`, `desktop-parity`, `desktop-restore-edge`, `desktop-store-async`, `escpos-printer`, `integration`, `inventory-persistence`, `inventory-tester1-wave2`, `receipt-layout`, `receipt-options` (`.test.mjs`).

### 8. მონაცემთა მოდელი (ზუსტი ტიპები)

#### 8.1 `lib/pos.ts` (A ამატებს ტალღა 1-ის დასაწყისშივე)

```ts
import type {DayClose} from './day-report';

export type TableShape = 'round' | 'square' | 'rectangle';
// Center of the table in plan units (0..1000 × 0..625), chairs excluded from x/y.
export type TableLayout = {seats: number; shape: TableShape; x: number; y: number; rotation: 0 | 90};
export type Table = Department & {zoneId: string; layout?: TableLayout};

export type PosState = {
    /* ...existing fields... */
    inventory: Inventory;
    dayCloses?: DayClose[];   // absent in old documents = empty history
};
```

#### 8.2 `lib/day-report.ts` (A)

```ts
import type {PosState} from './pos';
// @ts-expect-error Explicit extension is required by the Node strip-types test runner.
import {orderTotals} from './order-totals.ts';

export type PaymentTotals = {cash: number; card: number; other: number; total: number};
export type DayTotals = {
    closedBills: number;   // closed that day with ≥1 payment
    gross: number;         // Σ subtotal (voided units excluded)
    discounts: number;     // Σ discount
    net: number;           // gross − discounts
    voidCount: number;     // Σ voidQuantity on orders closed that day
    voidValue: number;     // Σ price × voidQuantity on orders closed that day
    payments: PaymentTotals; // payments whose createdAt is that day, any order
    openBills: number;
    openAmount: number;    // Σ due of open bills
    averageCheck: number;  // closedBills ? Math.round(net / closedBills) : 0
};
export type OpenBill = {orderId: string; tableName: string; total: number; paid: number; due: number; voidCount: number; voidValue: number};
export type DayReport = {date: string; totals: DayTotals; openBills: OpenBill[]};
export type DayClose = {
    id: string;
    date: string;          // 'YYYY-MM-DD' business day
    sequence: number;      // 1 = first close of that date, 2+ = repeat close
    closedAt: string;      // ISO
    closedBy?: string;     // optional free text, ≤100 chars
    note: string;          // '' allowed, ≤500 chars
    totals: DayTotals;     // snapshot, never recalculated
    openingFloat: number;
    expectedCash: number;  // openingFloat + totals.payments.cash
    countedCash: number;
    difference: number;    // countedCash − expectedCash (may be negative)
};
export type CashStatus = 'short' | 'over' | 'even';
export type CashCheck = {expected: number; difference: number | null; status: CashStatus | null};
export type AmountInput = {ok: true; value: number | null} | {ok: false; error: string};

export const BUSINESS_TIME_ZONE = 'Asia/Tbilisi';
export const CASH_STATUS_LABELS: Record<CashStatus, string> = {short: 'დანაკლისი', over: 'ზედმეტობა', even: 'ემთხვევა'};

export function businessDay(iso: string): string;                  // 'YYYY-MM-DD' in Asia/Tbilisi
export function computeDayReport(state: PosState, date: string): DayReport;
export function cashCheck(openingFloat: number, cashPayments: number, counted: number | null): CashCheck;
export function parseAmount(text: string): AmountInput;            // '' → value null; '118.50'/'118,5' → 11850
export function signedAmount(tetri: number): string;               // '−1.50' (U+2212) | '+1.00' | '0.00'
export function differenceText(tetri: number): string;             // '−1.50 დანაკლისი' | '+1.00 ზედმეტობა' | '0.00 ემთხვევა'
export function isValidDayCloses(value: unknown): boolean;
export function closeDay(s: PosState, p: Record<string, unknown>, ctx: {now: string; newId: () => string}): string; // mutates s, returns audit detail
```

#### 8.3 `lib/floor-plan.ts` (B)

```ts
import type {Order, PosState, Table, TableLayout, TableShape} from './pos';

export const PLAN_WIDTH = 1000;
export const PLAN_HEIGHT = 625;          // 16:10 zone canvas
export const MIN_SEATS = 1;
export const MAX_SEATS = 20;
export const TABLE_SHAPES: readonly TableShape[] = ['round', 'square', 'rectangle'];
export const SHAPE_LABELS: Record<TableShape, string> = {round: 'მრგვალი', square: 'კვადრატული', rectangle: 'მართკუთხა'};
export type TableStatus = 'free' | 'occupied' | 'unsent' | 'partial';
export const STATUS_LABELS: Record<TableStatus, string> = {free: 'თავისუფალი', occupied: 'დაკავებული', unsent: 'გაუგზავნელი პოზიციებით', partial: 'ნაწილობრივ გადახდილი'};

export function defaultLayout(index: number, count: number): TableLayout;
export function zoneTables(state: Pick<PosState, 'tables'>, zoneId: string): Table[];      // non-archived, stored order
export function zoneLayouts(tables: Table[]): {table: Table; layout: TableLayout}[];        // layout ?? defaultLayout(i, tables.length)
export function tableSize(layout: Pick<TableLayout, 'seats' | 'shape'>): {width: number; height: number};
export function footprint(layout: TableLayout): {width: number; height: number};          // incl. chairs, rotation applied
export function clampPosition(layout: TableLayout, x: number, y: number): {x: number; y: number};
export function chairPositions(layout: Pick<TableLayout, 'seats' | 'shape'>): {x: number; y: number; angle: number}[]; // relative to centre, unrotated
export function tableStatus(order: Order | undefined): TableStatus;
export function findFreeSpot(layouts: TableLayout[], table: Omit<TableLayout, 'x' | 'y'>): {x: number; y: number};
export function nextTableName(tables: Table[]): string;
export function isValidTableLayout(value: unknown): value is TableLayout;
export function parseTableLayout(value: unknown): TableLayout;   // throws Error with Georgian text
export function applyFloorPlan(s: PosState, p: Record<string, unknown>, ctx: {newId: () => string}): string; // mutates s, returns audit detail
```

### 9. დღის ანგარიშის წესები (`computeDayReport`)

`day(iso) = businessDay(iso)`. ეს არის `Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit'})`, იგივე, რაც `localDay` ფაილში `pos-workspace.tsx`. Asia/Tbilisi არის UTC+4 და ზაფხულის დრო არ აქვს. ამიტომ `2026-10-22` = `2026-10-21T20:00:00Z` … `2026-10-22T19:59:59.999Z`.

1. **Closed set C** = შეკვეთები, სადაც `status === 'closed'`, `closedAt` არსებობს, `day(closedAt) === D` და `payments.length > 0`.
   - `closedBills = |C|`; `gross = Σ orderTotals(o).subtotal`; `discounts = Σ .discount`; `net = Σ .total`.
2. **Voids** ითვლება ყველა იმ შეკვეთაზე, სადაც `status === 'closed'` და `day(closedAt) === D`. ესენიც შედის: `closeEmptyOrder`-ით დახურული, გადახდის გარეშე შეკვეთები. `voidCount = Σ line.voidQuantity`, `voidValue = Σ line.price × line.voidQuantity`. `gross`-ს ეს **არ** აკლდება ხელახლა, რადგან `subtotal` გაუქმებულს უკვე აღარ შეიცავს.
3. **Payments** არის ყველა შეკვეთის ყველა `payment`, სადაც `day(createdAt) === D`, დაჯამებული `method`-ის მიხედვით. `splitPay` ქმნის ორ payment-ს, ამიტომ თითო მეთოდი სწორად ჯამდება, ანგარიში კი C-ში ერთხელ ითვლება.
4. **Open bills** არის შეკვეთები, სადაც `status === 'open'`, `day(createdAt) <= D` და (`∃ line: quantity > voidQuantity` ან `payments.length > 0`). `tableName = tables.find(...)?.name ?? tableId`. თითოეულს აქვს `total/paid/due/voidCount/voidValue`. `openBills` არის რაოდენობა, `openAmount = Σ due`. ღია ანგარიში არის **ნახვის მომენტის** მდგომარეობა.
5. `averageCheck = closedBills ? Math.round(net / closedBills) : 0`. ყველა მნიშვნელობა მთელი თეთრია.
6. `payments.total` შეიძლება `net`-ს არ დაემთხვეს. მაგალითად, ღია ანგარიშის ნაწილობრივი გადახდა ან წინა დღის ნაწილობრივი გადახდა დახურულ ანგარიშზე. ორივე ჩანს ცალკე, ეს ნორმალურია და დოკუმენტირებულია.

**სალარო:** `expected = openingFloat + payments.cash`. `difference = counted − expected`. `status` არის `<0` → `short`, `>0` → `over`, `0` → `even`. თუ `counted === null`, მაშინ `difference` და `status` არის `null`.

**`parseAmount`:** ცარიელი ან მხოლოდ შუალედები → `{ok: true, value: null}`. რეგულარული გამოსახულება `^\d{1,9}([.,]\d{1,2})?$` → თეთრები სტრიქონიდან ითვლება, float-ის გარეშე. სხვა შემთხვევაში → `{ok: false, error: 'შეიყვანეთ 0 ან მეტი თანხა, მაქსიმუმ 2 ციფრით წერტილის შემდეგ'}`. 1 000 000 ₾-ზე (100000000 თეთრი) მეტი → `{ok: false, error: 'თანხა არ უნდა აღემატებოდეს 1 000 000 ₾-ს'}`. UI-ში ცარიელი დილის თანხა ნიშნავს 0-ს.

### 10. მოქმედება `closeDay` (მენეჯერის)

Payload:

```ts
{pin: string; date: string; openingFloat: number; countedCash: number; note?: string; closedBy?: string}
```

`pos.ts`-ში იწერება: `case 'closeDay': { assert(manager, 'მენეჯერის კოდი აუცილებელია'); log(closeDay(s, p, ctx)); break; }`

`closeDay` შეამოწმებს:

- `date` ემთხვევა `^\d{4}-\d{2}-\d{2}$`-ს და ნამდვილი თარიღია. ასევე `date <= businessDay(now)`, თორემ: „მომავალი დღის დახურვა შეუძლებელია“.
- `openingFloat` და `countedCash` არის მთელი რიცხვი `0..100000000`. თორემ: „თანხა არასწორია“.
- `note` არის `undefined` ან string, ≤500 სიმბოლო, trim-ით. `closedBy` არის `undefined`, `''` ან string, ≤100 სიმბოლო, trim-ით. ცარიელი ნიშნავს, რომ ველი არ არის.

ჩანაწერი:

```
totals = computeDayReport(s, date).totals
sequence = (s.dayCloses ?? []).filter(c => c.date === date).length + 1
s.dayCloses = [...(s.dayCloses ?? []), {id: ctx.newId(), date, sequence, closedAt: now, ...}]
```

აუდიტი: `${date}: მოსალოდნელი ${expected}, დათვლილი ${counted}, სხვაობა ${difference}` (თეთრებში, როგორც სხვა აუდიტში).

`closeDay` შეკვეთებს, გადახდებს, მაგიდებს და ჩეკებს **არ ეხება**. ამას ტესტი `deepEqual`-ით ამოწმებს.

**ზომა:** თითო ჩანაწერი დაახლოებით 0.5 KB-ია, მხოლოდ ჯამებით და ღია ანგარიშების სიის გარეშე. ეს წელიწადში დაახლოებით 180 KB-ია. ჩანაწერები არ იშლება, რადგან ისტორია არ უნდა გადაიწეროს. შეკვეთებიც ასევე იზრდება.

**ვალიდაცია (`isValidDayCloses`):** მასივი. თითოეული ჩანაწერი არის ობიექტი. `id` არის string და არ მეორდება. `date` ნამდვილი თარიღია. `sequence` არის მთელი ≥1. `closedAt` არის თარიღი. `closedBy` არის undefined ან string ≤100. `note` არის string ≤500. `totals`-ის ყველა რიცხვი, ქვე-ობიექტ `payments`-ის ჩათვლით, არის safe integer ≥0. `openingFloat`, `countedCash` და `expectedCash` არის safe integer ≥0. `difference` არის safe integer. ასევე უნდა სრულდებოდეს `expectedCash === openingFloat + totals.payments.cash` და `difference === countedCash − expectedCash`. `validState` ამატებს: `(v.dayCloses === undefined || isValidDayCloses(v.dayCloses))`.

### 11. მაგიდების რუკის წესები (`lib/floor-plan.ts`)

**კოორდინატები:** ზონის ტილო არის `1000 × 625` ერთეული. `x` და `y` მაგიდის ცენტრია და მთელი რიცხვია. დიაპაზონია `0..1000` და `0..625`. ეკრანზე ტილო SVG `viewBox="0 0 1000 625"`-ით ავტომატურად მასშტაბირდება.

**ზომა (`tableSize`):**

| ფორმა | width × height |
| --- | --- |
| round | `d × d`, `d = 70 + 12·seats` (2→94, 4→118, 8→166) |
| square | `s × s`, `s = seats ≤ 2 ? 70 : 40 + 50·ceil(seats/4)` (2→70, 4→90, 8→140) |
| rectangle | `L × 80`, `L = max(100, 50·ceil(seats/2) + 20)` (2→100, 4→120, 6→170, 8→220) |

**სკამები (`chairPositions`):** `CHAIR = 24`, `GAP = 6`.

- round: `k`-ური სკამი დგას `−90° + 360°·k/n` კუთხით, რადიუსით `d/2 + GAP + CHAIR/2`.
- square: სკამი `k` მიდის გვერდზე `k % 4` (ზედა, მარჯვენა, ქვედა, მარცხენა). თითო გვერდზე სკამები თანაბრად ნაწილდება (`(i+1)/(m+1)`).
- rectangle: ზედა გრძელ გვერდზე `ceil(n/2)`, ქვედაზე `floor(n/2)`, თანაბრად.
- ყოველთვის `chairPositions(l).length === l.seats`.

**Footprint:** `tableSize + 2·(GAP + CHAIR)` ორივე მიმართულებით. `rotation === 90` width-სა და height-ს ცვლის. `clampPosition` ცენტრს ისე ზღუდავს, რომ footprint ტილოდან არ გავიდეს. თუ footprint ტილოზე დიდია, ცენტრი შუაში რჩება. შედეგი მრგვალდება მთელ რიცხვამდე.

**ნაგულისხმევი განლაგება (`defaultLayout(i, count)`):** `cols = count ≤ 24 ? 6 : max(6, ceil(sqrt(count·1.6)))` და `rows = max(4, ceil(count/cols))`. უჯრის ცენტრები: `x = round(1000/cols·(col+0.5))`, `y = round(625/rows·(row+0.5))`, `col = i % cols`, `row = floor(i / cols)`. მნიშვნელობები: `{seats: 4, shape: 'square', rotation: 0}`. 24 მაგიდამდე უჯრა 166×156-ია, ხოლო 4 ადგილიანი footprint 150×150. ამიტომ მაგიდები ერთმანეთს არ ეფარება. `i` არის მაგიდის ინდექსი ზონის **ყველა** აქტიურ მაგიდას შორის, შენახული რიგით. მიგრაცია **ზარმაცია**: დოკუმენტი არ იცვლება და `zoneLayouts` აბრუნებს `table.layout ?? defaultLayout(i, n)`-ს. პირველი `saveFloorPlan` ზონის ყველა მაგიდას ცხადად ინახავს.

**სტატუსი (`tableStatus`):**

```
!order                                   → 'free'
order.payments.length > 0                → 'partial'   (open order with payments ⇒ due > 0, because pay closes at due 0)
lines.some(q − void − sent > 0)          → 'unsent'
otherwise                                → 'occupied'
```

**`findFreeSpot`:** ეძებს `defaultLayout(i, max(24, n+1))` სლოტებს თანმიმდევრობით. აბრუნებს პირველს, რომლის footprint-ის მართკუთხედიც არცერთ არსებულ footprint-ს არ კვეთს. სხვა შემთხვევაში აბრუნებს ცენტრს `(500, 312)`.

**`nextTableName`:** აქტიური მაგიდების რიცხვითი სახელების `max + 1`. თუ ასეთი არ არის, აბრუნებს `String(count + 1)`-ს.

**ვალიდაცია (`isValidTableLayout`):** ობიექტი. `seats` არის მთელი `1..20`. `shape ∈ TABLE_SHAPES`. `x` არის მთელი `0..1000`, `y` არის მთელი `0..625`. `rotation ∈ {0, 90}`. `validState`-ის ცხრილების შემოწმებას ემატება: `(r.layout === undefined || isValidTableLayout(r.layout))`.

### 12. მოქმედება `saveFloorPlan` (მენეჯერის)

Payload:

```ts
{
  pin: string;
  zoneId: string;
  tables: {id?: string; name: string; layout: TableLayout}[];   // ≤200; full draft of the zone
  removeIds?: string[];                                         // existing tables to archive
}
```

`pos.ts`-ში იწერება: `case 'saveFloorPlan': { assert(manager, 'მენეჯერის კოდი აუცილებელია'); log(applyFloorPlan(s, p, ctx)); break; }`

`applyFloorPlan`-ის წესები. ნებისმიერი შეცდომა აგდებს exception-ს, ამიტომ ან ყველაფერი ინახება, ან არაფერი:

1. ზონა უნდა არსებობდეს და არ იყოს `archived`. თორემ: „ზონა ვერ მოიძებნა“.
2. `tables` არის მასივი ≤200 ელემენტით. `name` არის trim-ის შემდეგ 1–40 სიმბოლო. თორემ: „მაგიდის სახელი უნდა შეიცავდეს 1–40 სიმბოლოს“. `layout = parseTableLayout(...)`.
3. თუ `id` არის მოცემული, ის უნდა იყოს არსებული, არა-archived მაგიდა **იმავე** ზონაში. id არ უნდა მეორდებოდეს. ასეთ შემთხვევაში იცვლება `name` და `layout`.
4. თუ `id` არ არის, იქმნება ახალი მაგიდა: `{id: ctx.newId(), name, zoneId, layout}`.
5. `removeIds`-ის თითოეული id უნდა იყოს ზონის არა-archived მაგიდა, რომელიც `tables`-ში არ არის. ღია შეკვეთის შემთხვევაში ჩანს „ჯერ დახურეთ ან გადაიტანეთ მაგიდის შეკვეთა“, როგორც `deleteTable`-ში. შედეგად `archived = true`.
6. აუდიტი: `${zoneName}: განახლდა ${u}, დაემატა ${a}, ამოღებულია ${r}`.
   სხვა შეცდომები: უცნობი, archived ან სხვა ზონის id → „მაგიდა ვერ მოიძებნა“; id ორჯერ (მათ შორის `tables`-შიც და `removeIds`-შიც) → „მაგიდა სიაში ორჯერ არის“; `tables` არ არის მასივი, 200-ზე მეტია ან `removeIds` არ არის მასივი → „მაგიდების სია არასწორია“. `parseTableLayout`: „მაგიდის განლაგება არასწორია“, „ადგილების რაოდენობა უნდა იყოს 1–20“, „მაგიდის ფორმა არასწორია“, „მაგიდის მდებარეობა არასწორია“, „შემობრუნება უნდა იყოს 0° ან 90°“. `isValidTableLayout` უცნობ დამატებით ველებსაც უარყოფს.
7. ზონის ის მაგიდები, რომლებიც payload-ში არ არის, უცვლელი რჩება.

**`saveTable` (პარამეტრები):** თუ ზონა არ იცვლება, არსებული `layout` რჩება. თუ ზონა იცვლება, `layout` იშლება და მაგიდა ახალ ზონაში ნაგულისხმევ სლოტს იღებს.

**დემოს საწყისი მაგიდები** (`demoSeedState`, ახალი დემო): 12 მაგიდას ეძლევა განსხვავებული ფორმა და ადგილები. მაგალითად, დარბაზში: 2 მრგვალი ორკაციანი, 4 კვადრატული ოთხკაციანი, 2 მართკუთხა 6 და 8 კაციანი. ტერასაზე: მრგვალი ოთხკაციანი. `seedState()`, რომელსაც ანგარიშის რეჟიმი იყენებს, უცვლელი რჩება.

### 13. ბეჭდვა

- `lib/ports/printer.ts`: `PrintDocument`-ს ემატება `| {kind: 'rows'; rows: Row[]}` (`import type {Row} from '@/lib/printing/receipt-layout'`).
- `lib/adapters/escpos-printer.ts` → `docRows`: `doc.kind === 'rows' ? doc.rows : ...`. ახალი import არ ემატება.
- ახალი `lib/printing/day-report-layout.ts`:

```ts
export type DayReportPrint = {
  date: string; printedAt: string; totals: DayTotals;
  openingFloat: number; expectedCash: number;
  countedCash?: number; difference?: number;           // undefined → '—'
  sequence?: number; closedAt?: string; closedBy?: string; note?: string;
};
export function dayReportRows(doc: DayReportPrint): Row[];
```

  იმპორტებია: `type Row`, `money` და `when` (`@/lib/format`), ასევე `differenceText` (`@/lib/day-report`).

  რიგები:
  - `ORVIO` (large, center, bold)
  - `დღის ანგარიში` (center, bold)
  - თუ `sequence` არსებობს: `დღის დახურვა #1` ან `განმეორებითი დახურვა #N`
  - `თარიღი | 2026-10-22`
  - `დაბეჭდილია | when(printedAt)`
  - closedAt-ის არსებობისას: `დახურულია | when(closedAt)`
  - RULE
  - `დახურული ანგარიშები | 3`
  - `მთლიანი გაყიდვები | 122.00 ₾`
  - `ფასდაკლებები | 5.00 ₾`
  - `გაუქმებები | 1 ც. / 8.00 ₾`
  - `წმინდა გაყიდვები | 117.00 ₾` (bold)
  - RULE
  - `ნაღდი | 20.00 ₾`
  - `ბარათი | 97.00 ₾`
  - `სხვა | 0.00 ₾`
  - `სულ გადახდები | 117.00 ₾`
  - RULE
  - `ღია ანგარიშები | 1 / 15.50 ₾`
  - `საშუალო ჩეკი | 39.00 ₾`
  - RULE
  - `დილის თანხა სალაროში | 100.00 ₾`
  - `მოსალოდნელი ნაღდი | 120.00 ₾`
  - `დათვლილი | 118.50 ₾` ან `—`
  - `სხვაობა | −1.50 დანაკლისი` ან `—` (bold)
  - არსებობის შემთხვევაში: `დახურა: …`, `შენიშვნა: …`
  - RULE
  - `ORVIO · RESTAURANT POS` (center)

  ყველა მარცხენა ლეიბლი ≤22 სიმბოლოა. ასე 24px შრიფტით 560 წერტილის სიგანეზე მარჯვენა თანხასთან ერთად ერთ ხაზზე ეტევა. გრძელი შენიშვნა `canvas-renderer`-ის `wrap`-ით გადადის ახალ ხაზზე.
- ვებში ბრაუზერის ბეჭდვა იყენებს ახალ `components/rows-print.tsx` → `RowsPrint({rows})`-ს, რომელიც **იგივე** `Row[]`-ს HTML-ად აჩვენებს. ტექსტიანი რიგი right-ით არის `.summaryrow` (`span` + `b`). center/large/huge იყენებს კლასებს `.rowsprint .center/.large/.huge`. rule არის `<hr>`, gap არის `div` სიმაღლით. ეს ელემენტი იხატება `.printarea`-ში (`pos-workspace.tsx`).

### 14. UI კომპონენტები და კონტრაქტები

**`components/day-report-view.tsx` (A):**

```ts
import type {Row} from '@/lib/printing/receipt-layout';
export type DayReportProps = {
  state: PosState; busy: boolean; error: string;
  act: (action: string, payload: Record<string, unknown>) => Promise<unknown>;  // resolves null on failure
  print: (rows: Row[]) => Promise<void>;
};
export function DayReportView(props: DayReportProps): JSX.Element;
```

შიდა ჩანართებია „მიმდინარე“ და „დახურვების ისტორია“ (გარე ჩანართს უკვე ჰქვია „დღის ანგარიში“, ამიტომ შიდა სახელი არ მეორდება):

- თარიღის ველი: ნაგულისხმევად `businessDay(new Date().toISOString())`, `max` = დღეს.
- ჯამები გამოიყენებს `.stats`-ს, გადახდები და ღია ანგარიშები კი `.panel .pad .summaryrow`-ს.
- სალაროს ბლოკი (`.dayreport-cash`) შეიცავს: დილის თანხას, დათვლილს, ცოცხალ `differenceText`-ს `.cashdiff.short|over|even` კლასით, შენიშვნას, „ვინ ხურავს“ (არასავალდებულო) ველს, „ბეჭდვა“ და „დღის დახურვა“ ღილაკებს.
- „დღის დახურვა“ აჩენს ჩაშენებულ PIN ველს და ღილაკს „დადასტურება“. შემდეგ იძახება `act('closeDay', {...})`. წარმატების შემთხვევაში ჩანს ისტორია და ახალი ჩანაწერი.
- ისტორიის ცხრილი ჩანს ახლიდან ძველისკენ: თარიღი, `#N` და `.badge.warm` „განმეორებითი“, წმინდა, მოსალოდნელი, დათვლილი, სხვაობა და „ნახვა“. ნახვისას ჩანს ჩანაწერის snapshot, ასევე „ბეჭდვა“.
- ფორმის state კომპონენტშივე ინახება, ამიტომ 8 წამიანი reload მას არ შლის.
- თანხის ველები გადის `parseAmount`-ში. ის იმავე ზღვარს იყენებს, რასაც `closeDay` (1 000 000 ₾), ამიტომ ზედმეტად დიდი თანხა აკრეფისთანავე ჩანს შეცდომად: „თანხა არ უნდა აღემატებოდეს 1 000 000 ₾-ს“, და „დღის დახურვა“ გათიშულია. შეცდომა (`error` prop) ჩანს მხოლოდ ამ ფორმის „დადასტურების“ შემდეგ.
- „ბეჭდვა“ ცოცხალ ანგარიშზე დათვლილსა და სხვაობას ბეჭდავს როგორც „—“, თუნდაც ველი შევსებული იყოს: ეს რიცხვები ჯერ არ არის შენახული. დათვლილი და სხვაობა იბეჭდება მხოლოდ შენახული დახურვიდან (ისტორია → „ნახვა“ → „ბეჭდვა“).

**ცხრილების ხედი (B), `components/floor-plan/`:**

| ფაილი | შიგთავსი |
| --- | --- |
| `tables-view.tsx` | `TablesView({state, busy, error, act, onOpen})` აჩვენებს stats-ს, ზონის ჩანართებს, „რუკა / ბადე“ გადამრთველს (`localStorage` `orvio.tables.view`, try/catch), ლეგენდას და „განლაგების რედაქტირება“ ღილაკს. ზონის state აქ გადმოდის |
| `floor-plan.tsx` | `FloorPlan({state, zoneId, busy, onOpen})`. `svg.floorplan` `viewBox="0 0 1000 625"`. „ყველა ზონა“ ზონებს ერთმანეთის ქვეშ აჩვენებს სათაურებით |
| `plan-table.tsx` | `PlanTable({layout, name, status, amount?, selected?, ...pointer handlers})`. `<g role="button" tabIndex={0} aria-label>` რეაგირებს Enter/Space-ზე. ფორმა და სკამები ტრიალდება `transform`-ით, ტექსტი კი არა |
| `table-grid.tsx` | ძველი ბადე: სტატუსის ფერები, სახელი, ადგილები, თანხა. ისარი „→“ და ზონის სახელი აღარ არის |
| `floor-plan-editor.tsx` | `FloorPlanEditor({state, zoneId, busy, error, act, onDone})`. draft იქმნება მხოლოდ რედაქტირების დაწყებისას |

**Drag:** `pointerdown` მაგიდაზე ირჩევს მაგიდას და იძახებს `svg.setPointerCapture`-ს. `pointermove` კოორდინატს ითვლის `svg.getScreenCTM().inverse()`-ით და აწესებს `clampPosition`-ს. სნეპი 5 ერთეულია. `pointerup` ასრულებს გადაადგილებას. რედაქტირების რეჟიმში `touch-action: none` აქვს მხოლოდ SVG-ს. ისრებიანი ღილაკები არჩეულ მაგიდას 5 ერთეულით ამოძრავებს.

**რედაქტორის გვერდითი პანელი:**

- სახელი;
- ადგილები: − / ციფრი / + (1–20);
- ფორმა: 3 ღილაკი;
- შემობრუნება: 0° / 90°;
- „ამოღება“: ღია შეკვეთის შემთხვევაში მაშინვე ჩანს ქართული შეტყობინება;
- „+ მაგიდის დამატება“: იყენებს `findFreeSpot`-ს და `nextTableName`-ს;
- PIN ველი და ღილაკები „შენახვა“ / „გაუქმება“.

1100px-ზე ვიწრო ეკრანზე პანელი რუკის ქვეშ გადადის.

**Workspace-ში ჩართვა (B, `pos-workspace.tsx`):**

```tsx
{view==='tables'&&!selected&&<TablesView state={s} busy={busy} error={error} act={act} onOpen={chooseTable}/>}
// reports: sub-tabs 'period' | 'day'
{view==='reports'&&reportTab==='day'&&<DayReportView state={s} busy={busy} error={error} act={act} print={rows=>sendToPrinter({kind:'rows',rows})}/>}
// print state: {order?: Order; ticket?: Ticket; rows?: Row[]}
function printDialog(doc){setPrint(doc.kind==='receipt'?{order:doc.order}:doc.kind==='ticket'?{ticket:doc.ticket}:{rows:doc.rows});...}
<div className="printarea">{print?.rows&&<RowsPrint rows={print.rows}/>}{/* existing */}</div>
```

**CSS (B, `app/globals.css`):**

- ქრება `.addcircle` წესები: ორივე, მე-2 და მე-50 სტრიქონებზე.
- ემატება:
  - `.floorplan`: `width:100%; height:auto; max-height:calc(100vh - 280px); background` ფილის/იატაკის ნაზი ფერით, `border-radius`.
  - `.floorplan.editing{touch-action:none}`.
  - `.plantable.free|occupied|unsent|partial`: fill და stroke.
  - `.chair`.
  - `.planlegend`.
  - `.planeditor`: `grid 1fr 300px`, ≤1100px-ზე `1fr`.
  - `.cashdiff`, `.cashdiff.short{color:#a04236}`, `.cashdiff.over{color:#1f6f4f}`, `.cashdiff.even{color:var(--muted)}`.
  - `.dayreport-cash`: grid 2 სვეტით, ≤760px-ზე 1 სვეტით.
  - `.rowsprint .center{text-align:center}`, `.rowsprint .large{font-size:15px;font-weight:700}`, `.rowsprint .huge{font-size:19px;font-weight:700}`, `.rowsprint hr{border:0;border-top:1px dashed #000;margin:6px 0}`.
- ფერები ყველგან ერთნაირია:

| სტატუსი | fill | stroke |
| --- | --- | --- |
| free | `#eaf0e9` | `#9fbf9c` |
| occupied | `#f3dfae` | `#c9a258` |
| unsent | `#d6e4f5` | `#4a78b0` |
| partial | `#f3cdbd` | `#b5583d` |

**მისაწვდომობა და ზომები:** 1366×768-ზე და 768–1024px სიგანეზე არ უნდა ჩნდებოდეს ჰორიზონტალური scroll (`document.documentElement.scrollWidth <= innerWidth`). SVG ტექსტი უნდა იყოს ≥ 18 ერთეული, ანუ 768px-ზე დაახლოებით 11px.

### 15. თავსებადობა და შენახვა

- **დემო/desktop:** `parseDemoDocument` → `validState` მკაცრად ამოწმებს `layout`-ს და `dayCloses`-ს. ძველი ფაილი (`tests/fixtures/legacy-demo-v1.json`) იტვირთება.
- **სარეზერვო ასლი:** `lib/backup.ts` მთელ დოკუმენტს ინახავს, ამიტომ `dayCloses` და `layout` მასში შედის. აღდგენისას `parseDemoDocument` ამოწმებს. `BACKUP_FORMAT_VERSION` რჩება 1, რადგან ცვლილება მხოლოდ ამატებს ველებს. `backup.ts` კოდი არ იცვლება, ემატება მხოლოდ ტესტები.
- **Supabase:** `route.ts` ინახავს `doc.state`-ს JSON-ად. ახალი ველები გადის `applyAction`-ში. სქემის მიგრაცია საჭირო არ არის. ძველ ჩანაწერებს უბრალოდ არ აქვთ ეს ველები.
- **ვერსიის კონფლიქტი:** რედაქტორის draft ლოკალურ state-შია. თუ შენახვისას ვერსია შეიცვალა, `act` ჩატვირთავს ახალ state-ს და აჩვენებს შეცდომას, draft კი რჩება. მენეჯერს შეუძლია ხელახლა დააჭიროს „შენახვას“.

### 16. ტესტების გეგმა

| ფაილი | რას ამოწმებს |
| --- | --- |
| `tests/day-report.test.ts` | საცნობარო დღე (A–D); ცარიელი დღე (ყველაფერი 0, საშუალო 0); თბილისის შუაღამის საზღვარი; ღია ანგარიშის ნაწილობრივი გადახდა; `closeEmptyOrder` გაუქმება; `cashCheck` (118.50/121.00/120.00); `parseAmount`; `closeDay` (sequence, შეკვეთები უცვლელია, მომავალი თარიღი უარყოფილია, მენეჯერის გარეშე უარყოფილია) |
| `tests/day-report-persistence.test.mjs` | დემო PIN 1234 / არასწორი PIN ჩანაწერს არ ინახავს; დახურვის შემდეგ გაყიდვა მუშაობს; ძველი დოკუმენტი იტვირთება ცარიელი ისტორიით; არასწორი `dayCloses` უარყოფილია; backup round-trip; route-ის (Supabase) `closeDay` |
| `tests/day-report-layout.test.mjs` | `dayReportRows`: „ნაღდი 20.00 ₾“, „ბარათი 97.00 ₾“, „მოსალოდნელი ნაღდი 120.00 ₾“, „დათვლილი 118.50 ₾“, „სხვაობა −1.50…“, ასევე „—“ დახურვის გარეშე; `escpos-printer` `kind: 'rows'` |
| `tests/floor-plan.test.ts` | ზომები (2<4, მართკუთხა 6/8 > კვადრატი 4); `chairPositions` length = seats; footprint/rotation; `clampPosition`; default grid ≤24 არ იფარება; `tableStatus` პრიორიტეტით; `findFreeSpot`; `nextTableName`; `isValidTableLayout`/`parseTableLayout`; `applyFloorPlan` (განახლება, დამატება, ამოღება, ღია შეკვეთის უარყოფა, სხვა ზონის id-ის უარყოფა, ატომურობა) |
| `tests/floor-plan-persistence.test.mjs` | დემო store `saveFloorPlan` PIN-ით; არასწორი PIN; reload ინახავს; `saveTable` layout-ს ინარჩუნებს; არასწორი layout (`seats` 0/`'abc'`, უცნობი shape, x=1001) ფაილში უარყოფილია; ძველი fixture იტვირთება; route |
| `tests/ui-cleanup.test.mjs` | `pos-workspace.tsx`-ში და `globals.css`-ში `addcircle` აღარ გვხვდება |

---

## ნაწილი III — სამუშაოს განაწილება

**A — დღის ანგარიში და მთელი domain/persistence.** ფლობს ფაილებს:

- `lib/pos.ts`, `lib/order-totals.ts`, `lib/day-report.ts`, `lib/demo-store.ts`, `lib/backup.ts`, `app/api/pos/route.ts`
- `lib/ports/printer.ts`, `lib/adapters/escpos-printer.ts`, `lib/printing/*`
- `components/day-report-view.tsx`, `components/rows-print.tsx`
- `tests/helpers/*`, თერთმეტივე `.mjs` ტესტი, რომელიც `pos.ts`-ს ტვირთავს, `tests/day-report*`, `tests/floor-plan-persistence.test.mjs`
- `docs/*.md`

**B — მაგიდების რუკა და მთელი UI shell.** ფლობს ფაილებს:

- `lib/floor-plan.ts`
- `components/floor-plan/*`
- `components/pos-workspace.tsx`
- `app/globals.css`
- `tests/floor-plan.test.ts`, `tests/ui-cleanup.test.mjs`

**ტალღა 1 — საფუძველი:**

- A ამატებს ტიპებს, `order-totals`-ს, `day-report`-ს, `closeDay`-ს, ვალიდაციას, ორივე `managerActions` სიას და ტესტების helper-ს.
- B ამატებს `floor-plan.ts`-ს და მის ტესტებს, აშორებს „+“-ს, ამატებს CSS-ის საფუძველს და დამცავ `printDialog`-ს.

**ტალღა 2:**

- A: `saveFloorPlan`-ის domain-ში ჩართვა და მისი ვალიდაცია, ბეჭდვის `rows` და `RowsPrint`.
- B: რუკა, ბადე, რედაქტორი და `TablesView`-ის ჩართვა.

**ტალღა 3:**

- A: `DayReportView` და დოკუმენტაცია.
- B: `DayReportView`-ის და ბეჭდვის fallback-ის ჩართვა, ასევე Playwright შემოწმება 1366×768-სა და ტაბლეტზე.
