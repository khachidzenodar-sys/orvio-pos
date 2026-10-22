import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {loadDomain} from './helpers/load-domain.mjs';

const require = createRequire(import.meta.url);

// Render the shipped TSX components with React's real HTML escaping and markup.
function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = {exports: {}};
  new Function('require', 'module', 'exports', source)(
    name => name in imports ? imports[name] : require(name), module, module.exports,
  );
  return module.exports;
}

const domain = loadDomain(evaluate);
const {CashLineDetails, KitchenLineDetails} = evaluate('../components/product-options.tsx', {
  '@/lib/pos': domain,
});
const render = (Component, line) => renderToStaticMarkup(createElement(Component, {line}));
const line = {
  id: 'line-1', productId: 'product-1', name: 'ტესტის კერძი',
  quantity: 3, price: 2150, basePrice: 1800,
  addons: [
    {id: 'cheese', name: 'დამატებითი ყველი', price: 200},
    {id: 'sauce', name: 'დამატებითი სოუსი', price: 150},
  ],
  note: 'ხახვის გარეშე; სოუსი ცალკე',
  departmentIds: ['kitchen'], sentQuantity: 3, voidQuantity: 0,
};

test('cash details disclose the base and each paid add-on per unit, followed by the free note', () => {
  const html = render(CashLineDetails, line);
  assert.ok(html.includes('საბაზო ფასი: 18.00 ₾'));
  assert.ok(html.includes('ფასიანი დანამატი: დამატებითი ყველი <b>+2.00 ₾</b> / ერთ.'));
  assert.ok(html.includes('ფასიანი დანამატი: დამატებითი სოუსი <b>+1.50 ₾</b> / ერთ.'));
  assert.ok(html.includes('შენიშვნა: ხახვის გარეშე; სოუსი ცალკე'));
  assert.doesNotMatch(html, /54\.00|6\.00|4\.50/, 'the detail prices must not be multiplied by quantity');

  const {basePrice: _base, ...withoutBaseSnapshot} = line;
  assert.equal(render(CashLineDetails, withoutBaseSnapshot), html,
    'older option lines derive the base from the composed unit price');
});

test('kitchen details keep preparation names and the note while omitting all fixture prices', () => {
  const html = render(KitchenLineDetails, line);
  assert.ok(html.includes('ფასიანი დანამატი: დამატებითი ყველი'));
  assert.ok(html.includes('ფასიანი დანამატი: დამატებითი სოუსი'));
  assert.ok(html.includes('შენიშვნა: ხახვის გარეშე; სოუსი ცალკე'));
  assert.doesNotMatch(html, /₾|18\.00|21\.50|2\.00|1\.50|1800|2150|200|150/);
  assert.doesNotMatch(html, /საბაზო ფასი|\/ ერთ\./);
});

test('cash and kitchen output escape user-authored add-on names and notes as text', () => {
  const unsafe = {
    ...line,
    addons: [{id: 'unsafe', name: '<img src=x onerror="alert(1)"> & ყველი', price: 200}],
    note: '<script>alert("note")</script> & სოუსი',
  };
  for (const Component of [CashLineDetails, KitchenLineDetails]) {
    const html = render(Component, unsafe);
    assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; ყველი'));
    assert.ok(html.includes('&lt;script&gt;alert(&quot;note&quot;)&lt;/script&gt; &amp; სოუსი'));
    assert.doesNotMatch(html, /<img\b|<script\b/);
  }
});

test('legacy plain order and ticket lines render without optional add-on or base-price fields', () => {
  const {addons: _addons, basePrice: _base, ...legacy} = line;
  for (const Component of [CashLineDetails, KitchenLineDetails]) {
    const html = render(Component, legacy);
    assert.ok(html.includes('შენიშვნა: ხახვის გარეშე; სოუსი ცალკე'));
    assert.doesNotMatch(html, /ფასიანი დანამატი|საბაზო ფასი|NaN|undefined|₾/);
    assert.doesNotThrow(() => render(Component, {...legacy, note: ''}));
  }
});
