import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const workspace = read('../components/pos-workspace.tsx');
const field = read('../components/product-photo-field.tsx');
const adapter = read('../lib/adapters/image-compressor.ts');
const css = read('../app/globals.css');

test('order cards and menu thumbnails use lazy, async, sized images with the product name as alt', () => {
    for (const cls of ['productphoto', 'menuthumb']) {
        const img = workspace.match(new RegExp(`<img className="${cls}"[^>]*>`))?.[0];
        assert.ok(img, cls);
        for (const attr of ['loading="lazy"', 'decoding="async"', 'alt={p.name}', 'src={p.photo}', 'width={', 'height={']) assert.ok(img.includes(attr), `${cls}: ${attr}`);
    }
    assert.match(workspace, /className=\{p\.photo\?'product hasphoto':'product'\}/);
});

test('photo field: accepted types, no forced camera, and nothing leaks into the product form', () => {
    assert.ok(field.includes('accept={PHOTO_ACCEPT}'));
    assert.ok(!/\bcapture\b/.test(field));
    assert.ok(!/<input[^>]*\bname=/.test(field), 'photo inputs must not join the saveProduct FormData');
    assert.ok(!/\brequired\b/.test(field));
    for (const button of field.match(/<button\b[^>]*>/g) || []) assert.ok(button.includes('type="button"'), button);
    assert.ok(field.includes("event.key === 'Enter'") && field.includes('preventDefault()'));
    assert.ok(field.includes('role="alert"'));
    assert.ok(workspace.includes("act('setProductPhoto'"));
});

test('compressor honours EXIF orientation and never touches the DOM at import time', () => {
    assert.ok(adapter.includes("imageOrientation: 'from-image'"));
    assert.ok(adapter.includes('URL.revokeObjectURL'));
    const topLevel = adapter.split('\n').filter(line => !/^\s/.test(line) && !/^(import|export|type|async function|function|})/.test(line) && line.trim());
    assert.ok(!topLevel.some(line => /document|window|Image\(/.test(line)), topLevel.join('\n'));
});

test('product grid column counts are unchanged by photos', () => {
    const photoBlock = css.slice(css.indexOf('/* Product photos'));
    assert.ok(!photoBlock.includes('productgrid'));
});

test('printing code never references photos', () => {
    const walk = dir => readdirSync(dir).flatMap(name => {
        const path = new URL(name, dir);
        return statSync(path).isDirectory() ? walk(new URL(`${name}/`, dir)) : [path];
    });
    for (const path of walk(new URL('../lib/printing/', import.meta.url))) assert.ok(!/photo/i.test(readFileSync(path, 'utf8')), path.pathname);
});
