// Builds lib/pos.ts with its runtime dependencies for tests that evaluate TypeScript directly.
export function loadDomain(evaluate, {inventory} = {}) {
  const totals = evaluate('../lib/order-totals.ts');
  return evaluate('../lib/pos.ts', {
    './inventory.ts': inventory ?? evaluate('../lib/inventory.ts'),
    './order-totals.ts': totals,
    './day-report.ts': evaluate('../lib/day-report.ts', {'./order-totals.ts': totals}),
    './floor-plan.ts': evaluate('../lib/floor-plan.ts'),
  });
}
