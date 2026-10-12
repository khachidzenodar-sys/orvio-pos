# Validation record

2026-10-10. Two independent test agents created the suites; root reran all 23 tests successfully.

Run: `node --experimental-strip-types --test tests/finance.test.ts tests/integration.test.mjs`

13 domain tests cover integer amounts, discounts, rounding residuals, mixed and item payments, original price/routes, multi-destination tickets without duplicated sales, send deltas, cancellations, immutable paid orders and invalid inputs.

10 integration tests run the real route/domain with narrow D1 and identity mocks: auth, user isolation, Origin checks, PIN hashing/no leakage, persistent lockout, PIN changes, retry IDs, optimistic concurrency, input rejection, multi-station routing and settlement.

Found and repaired: one-tetri remainder when paying rounded per-unit discounted values; unsafe integer order totals. Regression tests pass.

Limitations: no browser automation capability available under the Sites workflow, so visual browser QA and interactive end-to-end checks were not performed. No real printer, live card transaction, fiscal device, multi-user staff authorization or recovery exercise tested. Local mocked D1 tests do not prove hosted D1/auth behavior. Deployment/build results are recorded in delivery separately.

Root added and verified empty-table release regression; UI first-run PIN, mutation errors, versioned polling and matching API payloads reviewed in source.
