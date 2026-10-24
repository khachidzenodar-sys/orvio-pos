import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('menu cards carry no redundant "+" badge', () => {
    for (const path of ['../components/pos-workspace.tsx', '../app/globals.css']) assert.ok(!read(path).includes('addcircle'), path);
});
