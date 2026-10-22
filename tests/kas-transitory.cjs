const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module'); const ts = require('typescript');
const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
function compile(file, mocks = {}) {
  const filename = path.resolve(file); const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); const requireOriginal = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : requireOriginal(id); mod._compile(result.outputText, filename); return mod.exports;
}
const lib = compile('src/lib/kas-transitory.ts', { '@/lib/api-client': {} });
const mocks = { 'next/navigation': { useRouter: () => ({ refresh() {} }) }, '@/lib/kas-transitory': lib, '@/lib/actions/kas-transitory': { saveKasTransitory() { throw new Error('Tidak boleh menulis data dalam render test'); } } };
const { KasTransitoryClient } = compile('src/components/kas-transitory/KasTransitoryClient.tsx', mocks);
const item = { id: 'test-hold', entityId: 'A', sourceTransactionId: 'cash', sourceNoBukti: 'OUT-1', sourceDate: '2026-01-01', projectId: 'P', projectCode: 'GH-001', projectName: 'Proyek A', category: 'GAJI_HOLD', recipient: '<script>Nama</script>', amount: 10000000, location: 'Brankas', reason: 'Menunggu <LPJ>', targetDate: '2026-01-10', revision: 1, remaining: 4000000, released: 6000000, reversed: 0, status: 'OVERDUE', balanced: false, balanceIssue: 'Sumber berubah', events: [{ id: 'event', kind: 'RELEASE', amount: 6000000, eventDate: '2026-01-09', receipt: 'TRF-01', note: 'Sudah diserahkan', reversalNoBukti: null }] };
const data = { today: '2026-10-22', items: [item], sources: [], payroll: [], summary: { held: 4000000, released: 6000000, reversed: 0, overdue: 1, unbalanced: 1 } };
let html = renderToStaticMarkup(React.createElement(KasTransitoryClient, { data, canReverse: true }));
assert.match(html, /Kas Transitory|Dana ditahan/); assert.match(html, /Lewat target/); assert.match(html, /4\.000\.000/); assert.match(html, /6\.000\.000/);
assert.match(html, /Unbalanced/); assert.match(html, /&lt;script&gt;Nama&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>Nama/);
assert.match(html, /disabled=""[^>]*>.*?Cairkan/); assert.match(html, /tidak tersedia untuk operasional/);
let stateIndex = 0;
const { KasTransitoryClient: ExpandedOnly } = compile('src/components/kas-transitory/KasTransitoryClient.tsx', { ...mocks, react: { ...React, useState: initial => React.useState(stateIndex++ === 2 ? item.id : initial) } });
html = renderToStaticMarkup(React.createElement(ExpandedOnly, { data, canReverse: false }));
assert.match(html, /Menunggu &lt;LPJ&gt;/); assert.match(html, /TRF-01/); assert.match(html, /Sudah diserahkan/); assert.match(html, /Sumber berubah/);
assert.doesNotMatch(html, />Reversal<\/button>/);
html = renderToStaticMarkup(React.createElement(KasTransitoryClient, { data: { ...data, items: [] }, canReverse: true }));
assert.match(html, /Belum ada dana ditahan/);
const { PayrollHoldSummary } = compile('src/components/kas-transitory/PayrollHoldSummary.tsx', { 'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) } });
html = renderToStaticMarkup(React.createElement(PayrollHoldSummary, { items: [item], entityKey: 'gaharu' }));
assert.match(html, /Belum ditautkan ke payroll/); assert.match(html, /entity=gaharu/); assert.match(html, /belum diserahkan/);
assert.equal(renderToStaticMarkup(React.createElement(PayrollHoldSummary, { items: [{ ...item, remaining: 0 }], entityKey: 'gaharu' })), '');
console.log('Lulus: render monitoring, balance, status overdue, escaping, riwayat, role reversal, dan penanda hold payroll.');
