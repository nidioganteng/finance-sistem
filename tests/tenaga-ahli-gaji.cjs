// node tests/tenaga-ahli-gaji.cjs — menggunakan TypeScript dan React yang sudah ada.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function compile(file, mocks = {}) {
  const filename = path.resolve(file);
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : originalRequire(id);
  mod._compile(result.outputText, filename);
  return mod.exports;
}
const helpers = compile('src/lib/tenaga-ahli-gaji.ts');
const { bulanDariSpmk, bulanBerikutnya } = helpers;
assert.deepEqual(bulanDariSpmk('2026-12-15', '2027-02-01'), [
  { bulan: '2026-12', nominal: null, catatan: '' }, { bulan: '2027-01', nominal: null, catatan: '' }, { bulan: '2027-02', nominal: null, catatan: '' },
]);
assert.equal(bulanDariSpmk('2026-01-31', '2026-03-31').length, 3);
assert.equal(bulanDariSpmk('2026-10-01', '2026-10-01').length, 1);
assert.deepEqual(bulanDariSpmk(null, null), []);
assert.deepEqual(bulanDariSpmk('2027-01-01', '2026-01-01'), []);
assert.deepEqual(bulanDariSpmk('2026-13-01', '2027-01-01'), []);
assert.deepEqual(bulanDariSpmk('2000-01-01', '2199-12-31'), []);
assert.deepEqual(bulanDariSpmk('2026-02-29', '2026-03-01'), []);
assert.equal(bulanDariSpmk('2028-02-29', '2028-03-01').length, 2);
assert.equal(bulanBerikutnya('2026-12'), '2027-01');
assert.equal(bulanBerikutnya('2026-02'), '2026-03');
// Render komponen sesungguhnya dengan fixture sintetis, tanpa autentikasi atau database.
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let query = new URLSearchParams();
const { TenagaAhliNegosiasi } = compile('src/components/payroll/TenagaAhliNegosiasi.tsx', {
  'next/navigation': { useRouter: () => ({ push() {}, refresh() {} }), usePathname: () => '/payroll', useSearchParams: () => query },
  '@/lib/actions/payroll': { saveGajiTenagaAhliKontrakAction() { throw new Error('Fixture tidak boleh menulis data'); } },
  '@/lib/tenaga-ahli-gaji': helpers,
});
const contract = { id: 'c', rekananId: 'test-person', projectId: 'test-project', sumber: 'MANUAL', revision: 1,
  namaPekerjaan: 'Ahli struktur', manMonth: 2, gajiRab: 6000000, spmkMulai: '2026-12-01', spmkSelesai: '2027-01-31',
  gajiNegosiasi: 5000000, basisNegosiasi: 'BULAN', jadwal: [
    { bulan: '2026-12', nominal: 5000000, catatan: 'Dokumen <belum> lengkap' }, { bulan: '2027-01', nominal: null, catatan: '' },
  ] };
const props = { entityId: 'entity-project', year: 2026, month: 12, canEdit: true, search: '', onAddManual() {}, onRecord() {}, people: [
  { id: 'test-person', nama: 'Freelance Uji', nik: null, npwp: null, kategori: 'Ahli struktur', entityId: 'entity-test', proyekList: [
    { projectId: 'test-project', projectEntityId: 'entity-project', projectCode: 'TEST', projectName: 'Proyek Uji', nominalHonorBulanan: 0, isTurunLapangan: true, gajiKontrak: contract },
  ] },
] };
let html = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, props));
assert.match(html, /Tambah tenaga ahli manual/);
assert.match(html, /Ada kendala/);
assert.match(html, /Freelance Uji/);
assert.match(html, /Tindak lanjut/);
assert.match(html, /Sudah dibayar/);
assert.match(html, /Balance gaji terisi/);
assert.match(renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, { ...props, entityId: 'entity-project' })), /Freelance Uji/);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, { ...props, entityId: 'other' })), /Freelance Uji/);
const paid = { id: 'paid-old', projectId: 'test-project', nominalHonor: 1000000, nominalBersih: 975000, tahun: 2025, bulan: 11 };
const balance = helpers.ringkasanGajiTenagaAhli(contract.jadwal, [paid, paid, { ...paid, id: 'other', projectId: 'other-project', nominalHonor: 9999999 }], 'test-project');
assert.equal(balance.dibayar, 1000000);
assert.equal(balance.dibayarNetto, 975000);
assert.equal(balance.balance, 4000000);
assert.equal(balance.lengkap, false);
assert.equal(helpers.ringkasanGajiTenagaAhli([{ bulan: '2026-12', nominal: null, catatan: '' }], [paid], 'test-project').balance, null);
assert.equal(helpers.ringkasanGajiTenagaAhli([{ bulan: '2026-12', nominal: 0, catatan: '' }], [paid], 'test-project').balance, -1000000);
assert.equal(helpers.penugasanPadaEntitas(props.people[0], props.people[0].proyekList[0], 'entity-test'), false);
assert.equal(helpers.penugasanPadaEntitas(props.people[0], {}, 'entity-test'), true);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, { ...props, entityId: 'entity-test' })), /Freelance Uji/);
assert.equal(helpers.penugasanPadaEntitas(props.people[0], props.people[0].proyekList[0], 'entity-project'), true);
assert.equal(helpers.penugasanPadaEntitas(props.people[0], props.people[0].proyekList[0], 'other'), false);
const multiEntityPerson = { ...props.people[0], proyekList: [props.people[0].proyekList[0], { ...props.people[0].proyekList[0], projectId: 'gaharu-project', projectCode: 'GH-001', projectName: 'Proyek Gaharu', projectEntityId: 'entity-test' }] };
const gaharuList = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, { ...props, entityId: 'entity-test', people: [multiEntityPerson] }));
const projectList = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, { ...props, people: [multiEntityPerson] }));
assert.match(gaharuList, /Freelance Uji/); assert.match(gaharuList, /GH-001/); assert.doesNotMatch(gaharuList, /TEST · Proyek Uji/);
assert.match(projectList, /Freelance Uji/); assert.match(projectList, /TEST/); assert.doesNotMatch(projectList, /GH-001/);
const paidProps = { ...props, people: [{ ...props.people[0], riwayatGaji: [paid] }] };
html = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, paidProps));
assert.doesNotMatch(html, /1\.000\.000/); // Pembayaran November 2025 tidak masuk Desember 2026.
assert.match(html, /5\.000\.000/);
const draftProps = { ...props, people: [{ ...props.people[0], proyekList: [{ ...props.people[0].proyekList[0], gajiKontrak: null }] }] };
html = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, draftProps));
assert.match(html, /aria-label="Gaji negosiasi Freelance Uji"/);
assert.match(html, /Simpan negosiasi/);
query = new URLSearchParams('ahliId=test-person&proyekAhliId=test-project');
html = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, props));
assert.match(html, /Desember 2026/);
const partialProps = { ...props, people: [{ ...props.people[0], riwayatGaji: [{ ...paid, id: 'partial', tahun: 2026, bulan: 12, nominalHonor: 2000000 }] }] };
const partialHtml = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, partialProps));
assert.doesNotMatch(partialHtml, /Catat sisa pembayaran/);
assert.match(partialHtml, /3\.000\.000/);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, paidProps)), /November 2025/);
assert.doesNotMatch(html, /Januari 2027/);
assert.match(html, /Semua bulan kontrak/);
const octoberHtml = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, { ...props, month: 10 }));
assert.doesNotMatch(octoberHtml, /aria-label="Gaji Desember 2026"/);
assert.match(octoberHtml, /Belum ada jadwal untuk Oktober 2026/);
assert.match(html, /placeholder="Belum diisi"/);
assert.match(html, /Dokumen &lt;belum&gt; lengkap/);
assert.doesNotMatch(html, /Catat pembayaran/);
assert.match(html, /Otomatis saat disimpan/);
assert.match(html, /Simpan gaji &amp; pembayaran/);
assert.match(html, /Ada kendala/);
html = renderToStaticMarkup(React.createElement(TenagaAhliNegosiasi, { ...props, canEdit: false }));
assert.doesNotMatch(html, /Catat pembayaran<\/button>/);
assert.doesNotMatch(html, /Simpan perubahan/);
assert.doesNotMatch(html, /Kurangi bulan/);
console.log('Pengujian periode SPMK, tenaga ahli lintas entitas, negosiasi di daftar, balance, riwayat lintas tahun, catatan, dan read-only lulus.');
