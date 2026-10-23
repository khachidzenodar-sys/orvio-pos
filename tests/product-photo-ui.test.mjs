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

test('product grid column counts do not depend on photos', () => {
    // The tile layout sets the columns for every menu; the photo rules themselves must not.
    const photoBlock = css.slice(css.indexOf('/* Product photos'), css.indexOf('/* Product tiles'));
    assert.ok(!photoBlock.includes('grid-template-columns'));
});

test('printing code never references photos', () => {
    const walk = dir => readdirSync(dir).flatMap(name => {
        const path = new URL(name, dir);
        return statSync(path).isDirectory() ? walk(new URL(`${name}/`, dir)) : [path];
    });
    for (const path of walk(new URL('../lib/printing/', import.meta.url))) assert.ok(!/photo/i.test(readFileSync(path, 'utf8')), path.pathname);
});

// Runs the real accept()/reload() bodies from pos-workspace.tsx against a stubbed /api/pos.
import ts from 'typescript';
function workspaceReload(responses) {
    const src = read('../components/pos-workspace.tsx');
    const accept = src.match(/ const accept=(.*?);\r?\n/s)[1], reload = src.match(/ const reload=(.*?);\r?\n/s)[1];
    const js = ts.transpile(`(env)=>{const {latest,setData,setError,setNeedsLogin,isDemo,demo,window,fetch}=env;const accept=${accept};const reload=${reload};return reload;}`, {target: ts.ScriptTarget.ES2022});
    const env = {latest: {current: null}, shown: null, errors: [], reloads: 0, urls: [], isDemo: false, demo: null, setNeedsLogin() {},
        setData: d => { env.shown = d; }, setError: e => { env.errors.push(e); },
        window: {location: {reload: () => { env.reloads++; }}},
        fetch: async url => { env.urls.push(url); const body = responses.shift(); return {status: 200, ok: true, json: async () => body}; }};
    return {env, run: (0, eval)(js)(env)};
}

test('reload: unchanged keeps the screen, but an unchanged answer for another account reloads the page', async () => {
    const state = {products: []};
    const {env, run} = workspaceReload([
        {userId: 'a', version: 3, configured: true, state},
        {unchanged: true, userId: 'a', version: 3},
        {unchanged: true, userId: 'b', version: 3}]);
    await run();
    assert.equal(env.shown.userId, 'a');
    await run();
    assert.equal(env.urls[1], '/api/pos?since=3');
    assert.equal(env.reloads, 0);
    assert.equal(env.shown.userId, 'a');
    await run();
    assert.equal(env.reloads, 1, 'account switch at the same version must reload');
    assert.deepEqual(env.errors, []);
});

test('photo field: save errors show next to the PIN controls and a failed pick drops the old preview', () => {
    assert.match(field, /catch \(e\) \{ setPending\(null\); setRemoving\(false\); setPin\(''\); setLocalError/);
    const confirm = field.slice(field.indexOf('className="photoconfirm"'));
    assert.ok(confirm.includes('{localError && errorBox}'), 'save errors render inside .photoconfirm');
    assert.ok(field.includes("scrollIntoView({block: 'nearest'})"));
    // The workspace surfaces act() failures to the field instead of only the modal's bottom error box.
    assert.match(workspace, /if\(!d\)\{setError\(''\);throw Error\(lastError\.current\);\}/);
});

test('product tiles put a landscape photo on top and the name and price below', () => {
    const photoBlock = css.slice(css.indexOf('/* Product photos'));
    const tiles = css.slice(css.indexOf('/* Product tiles'));
    assert.match(tiles, /\.product\{display:flex;flex-direction:column;justify-content:flex-start/);
    assert.match(tiles, /\.productphoto,\.productplaceholder\{[^}]*aspect-ratio:4\/3/);
    assert.match(workspace, /<span className="productinfo"><h3>\{p\.name\}<\/h3><b>\{money\(p\.price\)\}<\/b><\/span>/);
    assert.match(photoBlock, /\.menuname\{display:flex;align-items:center/);
});
