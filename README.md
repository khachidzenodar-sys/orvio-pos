# ORVIO — Restaurant POS

Restaurant POS learning trial with public source code. Georgian UI, tables and manual menu entry, immutable departmental order/cancel tickets, PIN-gated discounts and voids, mixed payment recording, receipts and reports.

## Architecture

React/Vinext UI → POST /api/pos → pure domain transitions in lib/pos.ts → optimistic-version D1 persistence. Each authenticated owner identity has isolated state. Department views use the same signed-in identity; they are display modes, not independent staff permissions. See docs/ARCHITECTURE.md and CONTRACT.md.

## Verification

`node --experimental-strip-types --test tests/finance.test.ts tests/integration.test.mjs tests/quick-add.test.ts`

`node node_modules/typescript/bin/tsc --noEmit`

`npm run build`

The Sites project helpers own installation, build packaging and deployment. SQL migrations in drizzle/ are generated from db/schema.ts with `npm run db:generate`; hosted publication applies migrations. Never edit an already applied migration.

## Trial boundaries

No card processing, fiscal integration, physical printer confirmation, offline queue, separate employee roles, stock or costing. Browser print dialogs only. Payments and discounts lock order editing after the first payment. No refunds yet. Single-document storage is deliberately bounded in scalability; migrate to relational entities and paging before production/large histories. Table/menu counts have no artificial product cap.

First launch prompts for a new manager PIN; there is no hard-coded default. Protect and remember it. All monetary values are integer tetri.

## გზამკვლევი ქართულად

ORVIO არის რესტორნის სალაროს საცდელი პროგრამა. კერძზე თითო დაჭერა შეკვეთას ერთ ერთეულს უმატებს; რაოდენობისა და შენიშვნის ცალკე ფანჯარაც ხელმისაწვდომია. მაგიდებისა და განყოფილებების მართვა და ფასდაკლება მენეჯერის PIN-ით არის დაცული.

| ფაილი / საქაღალდე | დანიშნულება |
| --- | --- |
| `app/page.tsx` | ეკრანი და მომხმარებლის მოქმედებები |
| `app/globals.css` | ORVIO-ს ფერები და ვიზუალური სტილი |
| `app/api/pos/route.ts` | მოთხოვნების მიღება, ავტორიზაცია და შენახვა |
| `lib/pos.ts` | შეკვეთების, ფასების, ფასდაკლებისა და გადახდის წესები |
| `lib/serial-queue.ts` | სწრაფი დაჭერების რიგრიგობით დამუშავება |
| `db/` და `drizzle/` | მონაცემთა ბაზის სტრუქტურა და მიგრაციები |
| `tests/` | ავტომატური შემოწმებები |
| `docs/` | არქიტექტურისა და ტესტირების ახსნა |

ვმუშაობთ ერთ ბრენჩზე — `main`. Commit არის ცვლილებების შენახული ვერსია, რომელსაც აქვს აღწერა და ისტორია. ეს საცავი არსებული პროექტის მიმდინარე კოდის ასლს შეიცავს; ადრინდელი სამუშაო ისტორია ამ ატვირთვაში არ გადმოტანილა.

## Hosting and installation

This snapshot uses the ChatGPT Sites runtime: Vinext/Cloudflare Workers, a D1 database binding named `DB`, and platform-provided authentication. It is not ready for a one-click Vercel deployment. Independent hosting requires replacing/configuring authentication and database access, plus adapting the build/deployment configuration. GitHub stores the source; pushing code here does not automatically publish the running app.

Node.js >=22.13.0 is required. The package manager version is recorded in `package.json`; dependencies are locked in `pnpm-lock.yaml`. Within a configured Sites environment use `npm run install:ci`, then the verification commands above. Platform deployment identifiers, local database contents, environment files and generated build/cache files are not part of this export. `.openai/hosting.json` declares required bindings without linking another checkout to the existing deployment.
