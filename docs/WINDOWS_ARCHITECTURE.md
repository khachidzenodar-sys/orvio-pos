# ORVIO Windows-ზე — არქიტექტურა

ეს დოკუმენტი აღწერს, როგორ ხდება ORVIO-ს ვებპროგრამა Windows-ის დესკტოპ აპლიკაცია. პირველი ნაწილი მფლობელისთვისაა და მარტივად არის დაწერილი. მეორე ნაწილი დეველოპერებისთვისაა.

---

## ნაწილი 1. მარტივად — მფლობელისთვის

### რას ვაკეთებთ

- ORVIO Windows-ზე ჩვეულებრივი ინსტალერით ყენდება (`.exe` ან `.msi`). Start მენიუში და დესკტოპზე ჩნდება ხატულა „ORVIO“.
- აპი იხსნება საკუთარ ფანჯარაში. ბრაუზერი და ინტერნეტი არ სჭირდება.
- შესვლის ეკრანი არ არის. აპი პირდაპირ მაგიდებს აჩვენებს. მენეჯერის საწყისი კოდია `1234`, მისი შეცვლა „მართვის“ გვერდზეა შესაძლებელი.
- ყველა მონაცემი ამ კომპიუტერზე, ფაილში ინახება. Supabase და ინტერნეტი არ გამოიყენება.
- ჩეკები 80მმ თერმულ პრინტერზე იბეჭდება ერთი დაჭერით, ბეჭდვის ფანჯრის გარეშე. ქართული ასოები და ₾ სწორად გამოჩნდება.
- „მართვის“ გვერდზე შეგიძლიათ აირჩიოთ პრინტერი, გააკეთოთ საცდელი ბეჭდვა, შეინახოთ სარეზერვო ასლი და აღადგინოთ მონაცემები.
- ვებვერსია (Vercel: `/` და `/workspace`) ზუსტად ისე მუშაობს, როგორც ახლა.

### რატომ არ ვბეჭდავთ ჩვეულებრივ ტექსტად

თერმული პრინტერების უმეტესობამ ქართული ანბანი არ იცის. ქართულ ტექსტს ასეთი პრინტერი უცნაურ სიმბოლოებად ბეჭდავს. ამიტომ აპი ჩეკს ჯერ **სურათად** ხატავს, ზუსტად 80მმ სიგანით, და პრინტერს სურათს უგზავნის. სურათის დაბეჭდვა ყველა ESC/POS თერმულ პრინტერს შეუძლია. ასე ქართული ტექსტი ყოველთვის სწორად გამოჩნდება.

### სად ინახება მონაცემები

Windows-ზე მონაცემები ინახება საქაღალდეში:

```
C:\Users\<მომხმარებელი>\AppData\Roaming\ge.orvio.pos\
```

| ფაილი | რა არის შიგნით |
| --- | --- |
| `orvio.demo.v1.json` | მენიუ, მაგიდები, შეკვეთები, გადახდები, ჩეკები, ისტორია, მენეჯერის კოდი |
| `orvio.printer.v1.json` | არჩეული პრინტერის სახელი |
| `orvio.before-restore.<თარიღი>.json` | ავტომატური ასლი, რომელიც აღდგენამდე იქმნება |

შენახვა უსაფრთხოა. აპი ჯერ დროებით ფაილში წერს და მხოლოდ შემდეგ ანაცვლებს ძველს. თუ ჩაწერისას დენი გაითიშა, ძველი ფაილი არ ზიანდება.

### სარეზერვო ასლი

- „სარეზერვო ასლის შენახვა“ ქმნის ერთ ფაილს, მაგალითად `orvio-backup-2026-10-18.json`. მისი შენახვა შეიძლება ფლეშკაზე ან სხვა საქაღალდეში.
- „აღდგენა ფაილიდან“ ჯერ ამოწმებს ფაილს. შემდეგ აჩვენებს შეჯამებას: როდის შეიქმნა, რამდენი შეკვეთა და პროდუქტია. აღდგენას მენეჯერის კოდი სჭირდება.
- აღდგენამდე აპი მიმდინარე მონაცემების ასლს ავტომატურად ინახავს. ამიტომ მონაცემი ჩუმად არასდროს იკარგება.

### ფენები ერთი შეხედვით

```
┌───────────────────────────────────────────────────────────────┐
│ ეკრანი (React UI): pos-workspace, მართვა, პრინტერის ბლოკი     │
└───────────────┬───────────────────────────────┬───────────────┘
                │ იყენებს მხოლოდ „პორტებს“      │
┌───────────────▼──────────────┐ ┌──────────────▼───────────────┐
│ პორტი: შენახვა (storage)      │ │ პორტი: ბეჭდვა (printer)       │
└───────┬──────────────┬───────┘ └───────┬──────────────┬───────┘
        │              │                 │              │
 ბრაუზერი:        დესკტოპი:         ბრაუზერი:       დესკტოპი:
 localStorage     ფაილი AppData-ში  ბეჭდვის ფანჯარა  სურათი → ESC/POS → Windows
                                                    პრინტერი (RAW)
┌───────────────────────────────────────────────────────────────┐
│ ბიზნესწესები: lib/pos.ts (თანხები, ფასდაკლება, გადახდა) —     │
│ ერთი და იგივე ვებშიც და დესკტოპშიც, უცვლელი                   │
└───────────────────────────────────────────────────────────────┘
```

პორტი არის შეთანხმება: „შეინახე ეს“ ან „დაბეჭდე ეს“. ადაპტერი არის კონკრეტული შემსრულებელი: ბრაუზერი ან Windows. ეკრანმა არ იცის, ვინ ასრულებს. ამიტომ ვებვერსია და დესკტოპი ერთსა და იმავე ეკრანს და ერთსა და იმავე ბიზნესწესებს იყენებენ.

### როგორ მიიღებთ ინსტალერს

GitHub Actions ყოველ ცვლილებაზე ბრანჩში `claude/exciting-curie-9lz8ms` ავტომატურად აწყობს ინსტალერს Windows-ის სერვერზე. ინსტალერი ჩანს GitHub-ზე: **Actions → Windows installer → ბოლო გაშვება → Artifacts**. ნაბიჯ-ნაბიჯ ინსტრუქცია იქნება ფაილში [WINDOWS_INSTALL.md](WINDOWS_INSTALL.md).

---

## ნაწილი 2. ტექნიკური აღწერა

### 2.1 ძირითადი გადაწყვეტილებები

| საკითხი | გადაწყვეტილება | მიზეზი |
| --- | --- | --- |
| დესკტოპის გარსი | Tauri v2 | პატარა ინსტალერი, WebView2, Rust-ში წვდომა winspool-ზე |
| დესკტოპის ფრონტენდი | **ცალკე Vite entry** (`desktop/`), რომელიც იმავე `PosWorkspace` კომპონენტს არენდერებს | Next-ის `output:'export'` `app/api` route handler-ებთან არ მუშაობს. ცალკე entry ვებ-build-ს საერთოდ არ ეხება: `next.config.ts` და `app/` უცვლელია. `vite` და `@vitejs/plugin-react` უკვე დაყენებულია |
| რეჟიმი | იგივე demo/local რეჟიმი: `createDemoStore`, ერთი რესტორანი, ლოკალური PIN | ახალი ბიზნესწესები არ იწერება |
| შენახვა | `createDemoStore` იღებს async-თავსებად key-value პორტს; დესკტოპის ადაპტერი Rust-ის ბრძანებით წერს ფაილს ატომურად (tmp → fsync → rename) | UI ცვლილებას აჩვენებს მხოლოდ წარმატებული ჩაწერის შემდეგ |
| ბეჭდვა | Canvas → 576 წერტილიანი 1-bit bitmap → ESC/POS `GS v 0` raster + ჭრა → Rust `print_raw` → winspool `RAW` | ქართული code page პრინტერებში არ არსებობს |
| შრიფტი | `@fontsource/noto-sans-georgian` (OFL), იტვირთება მხოლოდ დესკტოპის entry-ში | შეიცავს ქართულს და ₾-ს (U+20BE, latin-ext subset). Windows-ის სისტემურ შრიფტზე დამოკიდებული არ ვართ |
| ფაილის დიალოგი | `tauri-plugin-dialog` გამოიძახება **Rust-იდან** | JS-ს არ სჭირდება ფაილურ სისტემაზე თავისუფალი წვდომა |
| ინსტალერი | GitHub Actions, `windows-latest`, `pnpm tauri build` → NSIS `.exe` + `.msi` | Linux კონტეინერში Windows ინსტალერის აწყობა შეუძლებელია |

### 2.2 ვერსიები (შემოწმებულია registry-ში 2026-10-18)

| პაკეტი | ვერსია | სად |
| --- | --- | --- |
| `@tauri-apps/cli` | `2.12.3` (exact) | devDependencies |
| `@tauri-apps/api` | `2.12.4` (exact) | dependencies |
| `@fontsource/noto-sans-georgian` | `5.3.0` (exact) | dependencies |
| `tauri` (crate) | `2.12` | src-tauri |
| `tauri-build` (crate) | `2.7` | src-tauri build-dependencies |
| `tauri-plugin-dialog` (crate) | `2.8` | src-tauri |
| `serde` / `serde_json` | `1` | src-tauri |
| `windows-sys` | `0.61`, features `Win32_Foundation`, `Win32_Graphics_Printing` | `[target.'cfg(windows)'.dependencies]` |

npm-ის `@tauri-apps/plugin-dialog` არ გვჭირდება, რადგან დიალოგი Rust-იდან იხსნება. პაკეტები ემატება მხოლოდ `pnpm add`-ით.

### 2.3 ფაილების რუკა

```
desktop/
  index.html                 Vite entry HTML (lang="ka")
  main.tsx                   React root: globals.css + შრიფტი + <PosWorkspace mode="demo" platform={desktopPlatform}/>
  platform.ts                composition root: აერთებს დესკტოპის ადაპტერებს
vite.desktop.config.ts       root=desktop, alias @ → რეპოს root, publicDir=public, outDir=dist-desktop

lib/
  pos.ts                     დომენი — უცვლელი
  demo-store.ts              createDemoStore(storage, lock, storageMessage) + backup/restore მეთოდები
  backup.ts                  სუფთა ფუნქციები: backup-ის კონვერტი, შემოწმება, შეჯამება
  format.ts                  money / when / grouped / methods (pos-workspace-დან გადატანილი)
  ports/
    storage.ts               KeyValueStore
    printer.ts               PrintDocument, ReceiptPrinter, PrinterSettings
    backup-files.ts          BackupFiles
    platform.ts              Platform (UI-ის ერთადერთი დამოკიდებულება გარე სამყაროზე)
  adapters/
    tauri-invoke.ts          Invoke ტიპი + @tauri-apps/api/core invoke
    tauri-file-storage.ts    KeyValueStore → storage_read / storage_write
    tauri-backup-files.ts    BackupFiles → backup_save / backup_open
    browser-printer.ts       ReceiptPrinter, რომელიც ყოველთვის ბეჭდვის ფანჯარას ირჩევს
    escpos-printer.ts        ReceiptPrinter + PrinterSettings → render → ESC/POS → print_raw
  printing/
    receipt-layout.ts        Order/Ticket → სტრიქონების აბსტრაქტული სია (Row[])
    canvas-renderer.ts       Row[] → canvas 576px → Bitmap
    bitmap.ts                RGBA → 1-bit Bitmap (სუფთა)
    escpos.ts                Bitmap → ESC/POS ბაიტები (სუფთა)

components/
  pos-workspace.tsx          იღებს არასავალდებულო `platform` prop-ს; მის გარეშე — დღევანდელი ქცევა
  printer-settings.tsx       ბლოკი „პრინტერი“ (მხოლოდ თუ platform.printerSettings არსებობს)
  print-failure-dialog.tsx   „ბეჭდვა ვერ მოხერხდა“ → „თავიდან ცდა“ / „ფანჯრიდან ბეჭდვა“
  backup-panel.tsx           „სარეზერვო ასლის შენახვა“ / „აღდგენა ფაილიდან“

src-tauri/
  Cargo.toml, build.rs, tauri.conf.json, capabilities/default.json, icons/
  src/main.rs                იძახებს orvio_lib::run()
  src/lib.rs                 Builder: dialog plugin + ყველა ბრძანების რეგისტრაცია
  src/storage.rs             storage_read / storage_write, write_atomic + cargo ტესტები
  src/backup.rs              backup_save / backup_open (დიალოგი Rust-იდან)
  src/printer/mod.rs         list_printers / print_raw (async, spawn_blocking)
  src/printer/windows.rs     #[cfg(windows)] winspool
  src/printer/stub.rs        #[cfg(not(windows))] — ქართული შეცდომა „ბეჭდვა მხოლოდ Windows-ზე“

.github/workflows/windows.yml
docs/WINDOWS_ARCHITECTURE.md, docs/WINDOWS_INSTALL.md, docs/PRINTING.md
```

`app/`, `next.config.ts`, `vercel.json` და `lib/server/` არ იცვლება.

### 2.4 პორტების კონტრაქტები (TypeScript)

```ts
// lib/ports/storage.ts — localStorage-ც და ფაილური ადაპტერიც ამას აკმაყოფილებს
export type KeyValueStore = {
 getItem(key:string):string|null|Promise<string|null>;
 setItem(key:string,value:string):void|Promise<void>;
};

// lib/ports/printer.ts
import type {Order,PosState,Ticket} from '@/lib/pos';
export type PrintDocument = {kind:'receipt';order:Order;state:PosState}|{kind:'ticket';ticket:Ticket;state:PosState};
// 'dialog' — პრინტერი არ არის არჩეული; UI იყენებს არსებულ .printarea + window.print().
// შეცდომისას ისვრის Error-ს ქართული შეტყობინებით.
export type ReceiptPrinter = {print(doc:PrintDocument):Promise<'printed'|'dialog'>};
export type PrinterSettings = {
 list():Promise<string[]>;
 selected():Promise<string|null>;
 select(name:string|null):Promise<void>;
 testPrint():Promise<void>;
};

// lib/ports/backup-files.ts
export type BackupFiles = {
 save(defaultName:string,contents:string):Promise<boolean>; // false = მომხმარებელმა გააუქმა
 open():Promise<string|null>;                                // null = გააუქმა
};

// lib/ports/platform.ts
export type Platform = {
 kind:'browser'|'desktop';
 store:DemoStore;                  // ReturnType<typeof createDemoStore>
 printer:ReceiptPrinter;
 printerSettings?:PrinterSettings; // მხოლოდ დესკტოპზე
 backupFiles?:BackupFiles;         // მხოლოდ დესკტოპზე
};
```

`PosWorkspace({mode, platform})`: თუ `mode==='demo'` და `platform` არ არის გადაცემული, გამოიყენება დღევანდელი `createBrowserDemoStore()` და `browser-printer`. ამით `/` ზუსტად ისე მუშაობს, როგორც ახლა. `app/page.tsx` არ იცვლება.

### 2.5 შენახვა

- `createDemoStore(storage, withLock, storageMessage?)`: შიდა `read` და `write` ხდება `async` და იყენებს `await storage.getItem/setItem`-ს. სინქრონული localStorage და არსებული ტესტების mock-ები უცვლელად მუშაობს. მესამე პარამეტრი ცვლის ბრაუზერზე მორგებულ შეცდომის ტექსტს. დესკტოპზე ტექსტია: „მონაცემების შენახვა კომპიუტერზე ვერ მოხერხდა. წინა მონაცემები უცვლელია.“
- დესკტოპის lock: `createSerialQueue()` (`lib/serial-queue.ts`). აპს ერთი ფანჯარა აქვს.
- Rust `storage.rs`:
  - გასაღები მოწმდება: `^[a-z0-9][a-z0-9.-]{0,80}$`. ფაილია `<app_data_dir>/<key>.json`.
  - `write_atomic`: `<file>.tmp`-ში ჩაწერა → `sync_all` → `rename` (Windows-ზე rename არსებულ ფაილს ანაცვლებს) → საქაღალდის შექმნა საჭიროებისას.
  - ფაილი არ არსებობს → `None`. დარჩენილ `.tmp` ფაილს კითხვისას ყურადღება არ ექცევა.
- მონაცემების საქაღალდე: `app.path().app_data_dir()` → Windows-ზე `%APPDATA%\ge.orvio.pos`.

### 2.6 სარეზერვო ასლი

ფაილის ფორმატი:

```json
{"app":"orvio-pos","kind":"backup","formatVersion":1,"createdAt":"2026-10-18T12:00:00.000Z","document":{ "schema":1, "userId":"…", "version":42, "configured":true, "state":{…}, "pin":"1234", "failures":0, "blockedUntil":0 }}
```

- `lib/backup.ts` (სუფთა): `createBackup(document, now)`, `readBackup(text, isValidDocument)` → `{createdAt, document, summary:{orders, products}}` ან ქართული შეცდომა. შეცდომის შემთხვევებია ცარიელი ფაილი, არასწორი JSON, სხვა `app/kind` ან მომავალი `formatVersion`. დოკუმენტის ვალიდაცია ხდება `demo-store.ts`-ის არსებული შემოწმებით: `parseDemoDocument` export-დება და `backup.ts`-ს პარამეტრად გადაეცემა. ასე წრიული import არ წარმოიქმნება.
- `demo-store` ახალი მეთოდები:
  - `exportBackup()` → ტექსტი.
  - `inspectBackup(text)` → შეჯამება.
  - `restoreBackup(text, pin)`: PIN მოწმდება იმავე წესით და ბლოკირებით, რაც მენეჯერის მოქმედებებზე. შემდეგ მიმდინარე დოკუმენტი იწერება `orvio.before-restore.<YYYYMMDD-HHmmss>` გასაღებით. ბოლოს იწერება აღდგენილი დოკუმენტი: `version = max(current, restored) + 1`, `failures = 0`, `blockedUntil = 0`. UI ამის შემდეგ აკეთებს `window.location.reload()`-ს.
- Rust `backup.rs`: `backup_save(default_name, contents) -> Result<bool,String>` ხსნის Save დიალოგს `*.json` ფილტრით და წერს `write_atomic`-ით. `backup_open() -> Result<Option<String>,String>` ხსნის Open დიალოგს და კითხულობს მაქსიმუმ 50 MB-ს. დიალოგი გამოიძახება `blocking_*` API-ით async ბრძანების შიგნით, არა მთავარ thread-ზე.

### 2.7 ბეჭდვის მილი

```
კლიკი „ჩეკი / ბეჭდვა“
  → act('printReceipt'|'printTicket')   (მთვლელი იზრდება lib/pos.ts-ში, როგორც დღეს)
  → platform.printer.print(doc)
      browser-printer → 'dialog' → არსებული setPrint + window.print()
      escpos-printer:
        არჩეული პრინტერი არ არის → 'dialog'
        receipt-layout(doc) → Row[]
        canvas-renderer(Row[]) → Bitmap 576 × H (1 bit, MSB first, 1 = შავი)
        escpos.buildJob(bitmap) = ESC @ + GS v 0 ზოლები (≤ 255 სტრიქონი) + ESC d 4 + GS V 66 0
        invoke('print_raw', {printer, data: number[]})
          Rust: GetPrinterW (offline/არარსებული → ქართული შეცდომა)
                OpenPrinterW → StartDocPrinterW(DOC_INFO_1W, datatype "RAW")
                → StartPagePrinter → WritePrinter (ციკლში) → EndPage/EndDoc → ClosePrinter
  → შეცდომისას: print-failure-dialog („თავიდან ცდა“ — იგივე doc, act-ის გარეშე; „ფანჯრიდან ბეჭდვა“)
```

- `GS v 0`: `1D 76 30 00 xL xH yL yH` + მონაცემები, სადაც `x = 72` ბაიტი (576/8). გრძელი ჩეკი იყოფა 255 სტრიქონიან ზოლებად, რადგან ზოგიერთ პრინტერს დიდი ბლოკი არ ეტევა ბუფერში.
- ზომები: სიგანე 576 წერტილი, გვერდებზე 8px დაშორება. სტუმრის ჩეკი: ტექსტი 24px, სათაურები 32px bold. განყოფილების ჩეკი: 34px bold, მაგიდა 48px. გრძელი სტრიქონი იკეცება `measureText`-ით.
- შრიფტი: `"Noto Sans Georgian"`. რენდერამდე სრულდება `await document.fonts.load('24px "Noto Sans Georgian"', 'ქართული ₾')`.
- სტუმრის ჩეკის შინაარსი ემთხვევა არსებულ `.printarea`-ს: „ასკილი“, „არაფისკალური ანგარიში“ (+ „ · ასლი“, თუ `receiptPrintCount>1`), მაგიდა, დრო, `№` id-ის 8 სიმბოლო, პოზიციები (საბაზო ფასი/დანამატები/შენიშვნა), სულ/ფასდაკლება/ჯამი/გადახდილია/დარჩენილია, გადახდები მეთოდებით, „მადლობა სტუმრობისთვის!“, „ORVIO · RESTAURANT POS“.
- განყოფილების ჩეკი: განყოფილება, მაგიდა, „შეკვეთა“/„გაუქმების ჩეკი“ (+ „ · ასლი“, თუ `printCount>1`), დრო, დაჯგუფებული `რაოდ. × დასახელება`, დანამატები, შენიშვნა, `#` id-ის 8 სიმბოლო.
- არჩეული პრინტერი ინახება `KeyValueStore`-ში `orvio.printer.v1` გასაღებით, `{"name":"…"}` სახით.
- Rust-ის ბრძანებები (`printer/mod.rs`) სინქრონულ winspool გამოძახებებს უშვებს `tauri::async_runtime::spawn_blocking`-ში, რომ UI არ გაიყინოს. `list_printers` იყენებს `EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, level 4)`-ს.

### 2.8 Rust ბრძანებების კონტრაქტი

| ბრძანება (JS სახელი) | არგუმენტები (JS) | შედეგი | ფაილი |
| --- | --- | --- | --- |
| `storage_read` | `{key}` | `string \| null` | storage.rs |
| `storage_write` | `{key, value}` | `null` | storage.rs |
| `backup_save` | `{defaultName, contents}` | `boolean` | backup.rs |
| `backup_open` | — | `string \| null` | backup.rs |
| `list_printers` | — | `string[]` | printer/mod.rs |
| `print_raw` | `{printer, data:number[]}` | `null` | printer/mod.rs |

შეცდომა ყოველთვის `Err(String)`-ია, მომხმარებლისთვის გასაგები ქართული ტექსტით. ტექნიკური დეტალი შეიძლება ფრჩხილებში დაემატოს.

### 2.9 Tauri კონფიგურაცია

- `productName: "ORVIO"`, `identifier: "ge.orvio.pos"`, `version: "0.1.0"`.
- `build.frontendDist: "../dist-desktop"`, `devUrl: "http://localhost:5174"`, `beforeDevCommand: "pnpm desktop:dev"`, `beforeBuildCommand: "pnpm desktop:build"`.
- ფანჯარა: სათაური „ORVIO“, 1366×800, მინიმუმ 1024×700.
- `bundle.targets: ["nsis","msi"]`. ხატულები `pnpm tauri icon public/orvio-mark.svg`-ით გენერირდება `src-tauri/icons/`-ში. NSIS ქმნის Start მენიუს და დესკტოპის მალსახმობს.
- WebView2: Windows 10/11-ზე ჩვეულებრივ უკვე დაყენებულია. ნაგულისხმევი `downloadBootstrapper` ინტერნეტს საჭიროებს მხოლოდ მაშინ, როცა WebView2 აკლია.
- CSP: `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'`. გარე ქსელი არ გამოიყენება.
- capabilities: მხოლოდ `core:default`. ჩვენი ბრძანებები app-ის საკუთარი ბრძანებებია.

### 2.10 აწყობა და შემოწმება

| ბრძანება | რას აკეთებს |
| --- | --- |
| `pnpm test` / `pnpm typecheck` / `pnpm build` / `pnpm lint` | ვებვერსია და ყველა ტესტი, როგორც დღეს |
| `pnpm desktop:build` | Vite → `dist-desktop/` |
| `pnpm desktop:dev` | Vite dev server, პორტი 5174 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust ტესტები (ატომური ჩაწერა) |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Linux შემოწმება |
| `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` | Windows კოდის შემოწმება. თუ დამოკიდებულების build script (რესურსების კომპილატორი) Linux-ზე ვერ სრულდება, `printer/windows.rs` მოწმდება scratch crate-ში `#[path]`-ით და `windows-sys`-ით. შედეგი იწერება |
| `pnpm tauri build --debug --no-bundle` | Linux-ზე სრული აპის აწყობა |
| GitHub Actions `windows.yml` | Windows-ზე `pnpm tauri build` → `.exe` + `.msi` artifact |

ტესტები Node-ის strip-types runner-ით ეშვება. სუფთა მოდულები, რომლებსაც მხოლოდ `import type` აქვთ, პირდაპირ შემოიტანება `.ts` გაფართოებით და `// @ts-expect-error`-ით (`@ts-ignore`-ს lint უარყოფს). მოდულები, რომლებსაც runtime import აქვთ, მოწმდება `tests/demo.test.mjs`-ის `evaluate()` შაბლონით. ცვლადს ერქმევა `mod` და არა `module`, რადგან `module` lint-ის შეცდომას იწვევს.

### 2.11 რისი შემოწმება შეიძლება მხოლოდ Windows-ზე

ინსტალაცია და ხატულები, ინტერნეტის გარეშე გახსნა, გადატვირთვის შემდეგ მონაცემები, ფიზიკური ბეჭდვა და ჭრა, ქართული ასოების ხარისხი ქაღალდზე, პრინტერების სია, გათიშული პრინტერის შეცდომა, Save/Open დიალოგები. Linux კონტეინერში ეს ნაწილები მხოლოდ კოდისა და ტესტების დონეზე მოწმდება.

### 2.12 შემოწმების შედეგები

თარიღი: 2026-10-18. გარემო: Linux კონტეინერი (Node 22, pnpm 11, Rust 1.97, სამიზნეები `x86_64-unknown-linux-gnu` და `x86_64-pc-windows-msvc`). ყველა ბრძანება გაეშვა რეპოზიტორიის ძირიდან, მესამე ტალღის ბოლოს (`printer` მოდული დარეგისტრირებულია `lib.rs`-ში, `desktop/platform.ts` იყენებს ESC/POS პრინტერს).

| ბრძანება | შედეგი |
| --- | --- |
| `pnpm test` | ✅ 119 ტესტი: 119 გავიდა, 0 ჩავარდა |
| `pnpm typecheck` | ✅ შეცდომა არ არის |
| `pnpm build` | ✅ მარშრუტები უცვლელია: `/`, `/workspace`, `/api/auth/login`, `/api/auth/logout`, `/api/pos` |
| `pnpm lint` | ✅ 10 შეცდომა, 11 გაფრთხილება — მხოლოდ ძველი 10 შეცდომა, ახალი არ დამატებულა. `desktop/`, `lib/adapters/`, `lib/printing/` სუფთაა |
| `pnpm desktop:build` | ✅ `dist-desktop/` (JS, Tailwind CSS, Noto Sans Georgian 400/700). Vite-ის `INEFFECTIVE_DYNAMIC_IMPORT` შენიშვნა მხოლოდ ინფორმაციულია |
| `cargo fmt --check` | ✅ |
| `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ 8/8 (5 storage, 3 backup) |
| `cargo check --manifest-path src-tauri/Cargo.toml` | ✅ Linux, გაფრთხილების გარეშე (`printer/stub.rs`) |
| `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` | ✅ მთელი crate, `printer/windows.rs`-ის ჩათვლით. ერთადერთი გაფრთხილება: `GNU compiler is not supported for this target` — Windows-ის რესურსის (ხატულა/manifest) ნაბიჯი Linux-ზე გამოტოვებულია, `windows-latest` runner-ზე სრულდება |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc` | ✅ clippy-ის გაფრთხილება არ არის |
| `pnpm tauri build --debug --no-bundle` | ✅ `src-tauri/target/debug/orvio` (Linux ELF) |
| `git status` — `lib/pos.ts`, `app/**`, `next.config.ts`, `vercel.json` | ✅ ცვლილება არ არის |

Windows-ის ჯვარედინი შემოწმება: `cargo check`/`clippy` MSVC სამიზნეზე სრულად გადის, მაგრამ ეს მხოლოდ კომპილაციაა. `winspool.lib`-თან დაკავშირება (link), ინსტალერის (NSIS/MSI) შექმნა და აპის გაშვება მოწმდება მხოლოდ GitHub Actions-ის `windows-latest` runner-ზე და რეალურ კომპიუტერზე (იხ. 2.11). დეველოპერ B-მ `printer/windows.rs` დამატებით შეამოწმა ცალკე scratch crate-ებში `#![deny(warnings)]`-ით (Linux და MSVC, clippy `undocumented_unsafe_blocks`-ით) — ყველა სუფთაა.

ერთსა და იმავე წამში გაკეთებული ორი აღდგენა ერთმანეთის უსაფრთხოების ასლს აღარ გადააწერს: მეორე ასლს სახელს დაემატება `-2`, `-3` და ა.შ.

ინსტალაციის ინსტრუქცია მფლობელისთვის: [WINDOWS_INSTALL.md](WINDOWS_INSTALL.md). ბეჭდვა: [PRINTING.md](PRINTING.md).
