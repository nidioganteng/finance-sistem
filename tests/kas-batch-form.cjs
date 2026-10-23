const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const React = require('react');
const filename = path.resolve('src/components/kas/KasBatchTransactionForm.tsx');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
let hooks = [], cursor = 0, effects = [], payloads = [], edits = [], generations = 0, closed = 0, response = { success: true };
const mocks = {
  react: {
    ...React,
    useState: initial => { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; },
    useRef: initial => { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useEffect: (fn, deps) => { const i = cursor++; if (!hooks[i] || deps.some((d, n) => d !== hooks[i][n])) { hooks[i] = deps; effects.push(fn); } },
  },
  'next/navigation': { useRouter: () => ({ push() {}, refresh() {} }) },
  '@/lib/actions/kas': { generateNoBukti: async () => { generations++; return 'UG/10231'; }, replaceKasTransaction: async data => { edits.push(data); return { success: true }; }, createKasTransactionBatch: async data => { payloads.push(data); return response; } },
  '@/components/shared/DatePicker': { DatePicker: () => null }, './CoaCombobox': { CoaCombobox: () => null },
};
const original = mod.require.bind(mod); mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
const props = { entityKey: 'gaharu', jenisInputKey: 'bankBuku', pagePath: '/bank-buku', defaultRekeningId: 'gs-bpd', rekeningOptions: [{ id: 'gs-bpd', nama: 'BPD GS' }], coaOptions: [{ id: 'cost', code: '512', name: 'Transport' }], projectOptions: [{ id: 'P', code: 'GH-01', name: 'Proyek A' }, { id: 'Q', code: 'GH-02', name: 'Proyek B' }], onClose: () => closed++ };
let tree;
function render() { cursor = 0; tree = mod.exports.KasBatchTransactionForm(props); effects.splice(0).forEach(fn => fn()); }
function nodes(node = tree) { if (!node || typeof node !== 'object') return []; return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)]; }
const find = pred => { const result = nodes().find(pred); assert.ok(result, 'Element exists'); return result; };
const byLabel = label => find(n => n.props?.['aria-label'] === label);
const button = text => find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes(text));
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
global.window = { location: { search: '?rekening=gs-bpd&dari=2026-10-01&sampai=2026-10-31' } };
(async () => {
  const allocate = mod.exports.allocateVoucherNumbers;
  assert.deepEqual(allocate('UK/09289', [{ noBukti: '', manualNumber: false }, { noBukti: '', manualNumber: false }]).map(r => r.noBukti), ['UK/09289','UK/092810']);
  assert.deepEqual(allocate('UC/10231', [{ noBukti: 'CA/0001', manualNumber: true }, { noBukti: 'UC/10231', manualNumber: true }, { noBukti: '', manualNumber: false }]).map(r => r.noBukti), ['CA/0001','UC/10231','UC/10232']);
  render(); await flush();
  assert.equal(byLabel('Nomor bukti transaksi 1').props.value, 'UG/10231');
  button('Tambah Transaksi').props.onClick(); render();
  assert.equal(byLabel('Nomor bukti transaksi 2').props.value, 'UG/10232');
  for (let i = 1; i <= 2; i++) {
    byLabel(`Keterangan transaksi ${i}`).props.onChange({ target: { value: `Uraian ${i}` } }); render();
    byLabel(`Nominal transaksi ${i}`).props.onChange({ target: { value: i === 1 ? '100.000' : '250.000' } }); render();
    byLabel(`Proyek transaksi ${i}`).props.onChange({ target: { value: i === 1 ? 'P' : 'Q' } }); render();
    const account = nodes().filter(n => n.type === mocks['./CoaCombobox'].CoaCombobox)[i-1]; account.props.onChange('cost'); render();
  }
  byLabel('Periode akrual transaksi 1').props.onChange({ target: { value: '2026-09' } }); render();
  byLabel('Periode akrual transaksi 2').props.onChange({ target: { value: '2025-12' } }); render();
  // Error preserves all drafts; the next submission sends each voucher separately.
  response = { error: 'Nomor bukti sudah dipakai' };
  button('Simpan Semua').props.onClick(); await flush();
  assert.equal(closed, 0); assert.ok(find(n => n.props?.role === 'alert'));
  assert.equal(byLabel('Keterangan transaksi 2').props.value, 'Uraian 2');
  response = { success: true };
  const save = button('Simpan Semua').props.onClick; save(); save(); await flush();
  assert.equal(payloads.length, 2, 'same-tick double click cannot send twice');
  assert.equal(closed, 1);
  const data = payloads[1];
  assert.deepEqual(data.map(d => [d.noBukti, d.projectId, d.keterangan, d.rows[0].nominal]), [['UG/10231', 'P', 'Uraian 1', 100000], ['UG/10232', 'Q', 'Uraian 2', 250000]]);
  assert.deepEqual(data.map(d => [d.periodeBulanGaji, d.periodeTahunGaji]), [[9,2026],[12,2025]], 'each voucher retains its own accrual period');
  assert.ok(data.every(d => d.rekeningId === 'gs-bpd' && d.entityKey === 'gaharu'));
  const generationCount = generations;
  hooks = []; effects = [];
  props.initialValues = { tanggal: '2026-09-15', noBukti: 'UK/09151', keterangan: 'Keterangan lama', arah: 'keluar', rekeningId: 'gs-bpd', projectId: 'P', crossingEntityKeys: ['kencana'], tanggalNota: '2026-09-14', periodeBulanGaji: 8, periodeTahunGaji: 2026, existingTxIds: ['cash','row1','row2'], rows: [{ coaAccountId: 'cost', nominal: '100000', keterangan: 'Item pertama' }, { coaAccountId: 'cost', nominal: '200000', keterangan: 'Item kedua' }] };
  render(); await flush();
  assert.equal(generations, generationCount, 'edit never generates a new voucher number');
  assert.equal(byLabel('Nomor bukti transaksi 1').props.value, 'UK/09151');
  assert.equal(byLabel('Nomor bukti transaksi 2').props.value, 'UK/09151');
  assert.equal(byLabel('Periode akrual transaksi 1').props.value, '2026-08');
  byLabel('Periode akrual transaksi 1').props.onChange({ target: { value: '2026-07' } }); render();
  byLabel('Keterangan transaksi 1').props.onChange({ target: { value: 'Keterangan baru' } }); render();
  assert.equal(byLabel('Keterangan transaksi 2').props.value, 'Keterangan baru', 'same voucher shares header metadata');
  button('Simpan Perubahan').props.onClick(); await flush();
  assert.equal(edits.length, 1);
  assert.equal(payloads.length, 2, 'edit replaces the voucher rather than creating a batch');
  assert.deepEqual(edits[0].existingTxIds, ['cash','row1','row2']);
  assert.deepEqual(edits[0].rows.map(r => [r.nominal,r.keterangan]), [[100000,'Item pertama'],[200000,'Item kedua']], 'all original account details preserved');
  assert.equal(edits[0].noBukti, 'UK/09151');
  assert.equal(edits[0].tanggal, '2026-09-15');
  assert.equal(edits[0].periodeBulanGaji, 7);
  assert.equal(edits[0].tanggalNota, '2026-09-14');
  assert.deepEqual(edits[0].crossingEntityKeys, ['kencana']);
  console.log('Batch form: independent vouchers, projects, amounts, error preservation and double-click guard passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
