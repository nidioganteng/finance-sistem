const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(expanded = false) {
  const filename = path.resolve('src/components/kas/KasScreenClient.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  let index = 0;
  const mocks = {
    react: { ...React, useState: initial => React.useState(index++ === 1 && expanded ? 0 : initial) },
    'next/navigation': { useRouter: () => ({}), usePathname: () => '/kas-kecil', useSearchParams: () => new URLSearchParams() },
    '@/lib/use-page-transition': { usePageTransition: () => [false, () => {}] },
    './KasTransactionForm': { KasTransactionForm: () => null }, './DeleteConfirmModal': { DeleteConfirmModal: () => null },
    '@/lib/actions/kas': {}, '@/components/shared/LoadingOverlay': { LoadingOverlay: () => null }, '@/components/shared/DatePicker': { DatePicker: () => null },
    '@/lib/dashboard-data': { formatRupiah: amount => `Rp ${amount.toLocaleString('id-ID')}` },
  };
  const original = mod.require.bind(mod); mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports.KasScreenClient;
}
const row = { tanggal: '2026-10-22', tanggalRaw: '2026-10-22', noBukti: 'LAYOUT-001', keterangan: 'Pengeluaran', akunTags: ['PIUTANG CAD', 'By Umum'], masuk: 0, keluar: 140000, masukFmt: 'Rp 0', keluarFmt: 'Rp 140.000', saldoFmt: 'Rp -140.000', allTxIds: [], coaRows: [
  { id: 'a', coaAccountId: 'a', coaName: 'PIUTANG CAD', nominal: 90000, isDebit: true, itemDescription: 'OSA 3 Orang dengan uraian panjang yang boleh turun ke beberapa baris' },
  { id: 'b', coaAccountId: 'b', coaName: 'By Umum', nominal: 50000, isDebit: true, itemDescription: 'Beli sunlight <uji>' },
] };
const props = { entityKey: 'kencana', jenisInputKey: 'kasKecil', pagePath: '/kas-kecil', coaOptions: [], saldoFmt: 'Rp -140.000', ledger: [row] };
const render = (data = row, expanded = false) => renderToStaticMarkup(React.createElement(load(expanded), { ...props, ledger: [data] }));
const bodyRows = html => [...html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(match => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cell[1]));
let html = render(); let cells = bodyRows(html);
assert.equal(cells.length, 2);
assert.match(cells[0][2], /OSA 3 Orang/); assert.match(cells[0][3], /PIUTANG CAD/); assert.match(cells[0][5], /Rp 90\.000/);
assert.match(cells[1][0], /Beli sunlight &lt;uji&gt;/); assert.match(cells[1][1], /By Umum/); assert.match(cells[1][3], /Rp 50\.000/);
assert.doesNotMatch(cells[0][3], /OSA/); assert.doesNotMatch(cells[1][1], /sunlight/);
assert.equal((html.match(/LAYOUT-001/g) || []).length, 1); assert.match(html, /rowSpan="2"/i);
const incoming = bodyRows(render({ ...row, masuk: 140000, keluar: 0 }));
assert.match(incoming[0][4], /Rp 90\.000/); assert.match(incoming[1][2], /Rp 50\.000/);
const many = { ...row, coaRows: [...row.coaRows, { id: 'c', coaAccountId: 'c', coaName: 'Akun Ketiga', nominal: 10000, isDebit: true, itemDescription: 'Uraian ketiga' }] };
assert.match(render(many), /\+1 akun lainnya/);
const expanded = bodyRows(render(many, true)); assert.equal(expanded.length, 3); assert.match(expanded[2][1], /Akun Ketiga/); assert.match(expanded[2][3], /Rp 10\.000/);
const fallback = bodyRows(render({ ...row, coaRows: [] })); assert.equal(fallback.length, 1); assert.match(fallback[0][2], /Pengeluaran/); assert.match(fallback[0][5], /Rp 140\.000/);
console.log('Lulus: uraian di Keterangan, akun/nominal satu baris, bukti/saldo satu kali, transaksi masuk, akun tambahan, dan fallback.');
