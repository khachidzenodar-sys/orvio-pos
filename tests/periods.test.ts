import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {quickPeriod} from '../lib/periods.ts';

test('quick periods cover the right calendar days', () => {
    const today = '2026-10-24'; // a Saturday
    assert.deepEqual(quickPeriod('today', today), ['2026-10-24', '2026-10-24']);
    assert.deepEqual(quickPeriod('yesterday', today), ['2026-10-23', '2026-10-23']);
    assert.deepEqual(quickPeriod('week', today), ['2026-10-19', '2026-10-24']);
    assert.deepEqual(quickPeriod('week', '2026-10-19'), ['2026-10-19', '2026-10-19'], 'Monday starts its own week');
    assert.deepEqual(quickPeriod('week', '2026-10-25'), ['2026-10-19', '2026-10-25'], 'Sunday ends the week');
    assert.deepEqual(quickPeriod('month', today), ['2026-10-01', '2026-10-24']);
    assert.deepEqual(quickPeriod('lastMonth', today), ['2026-09-01', '2026-09-30']);
    assert.deepEqual(quickPeriod('lastMonth', '2026-01-15'), ['2025-12-01', '2025-12-31']);
    assert.deepEqual(quickPeriod('yesterday', '2026-03-01'), ['2026-02-28', '2026-02-28']);
});
