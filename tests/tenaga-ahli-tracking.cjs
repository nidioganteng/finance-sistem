const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function compile(file, mocks = {}) {
  const filename = path.resolve(file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const requireModule = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : requireModule(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return mod.exports;
}
const tracking = compile('src/lib/tenaga-ahli-tracking.ts');
const { buildTenagaAhliTracking: build, filterTenagaAhliTracking: filter, summarizeTenagaAhliTracking: sum, groupTenagaAhliTracking: group } = tracking;
const salary = (bulan, nominal, catatan = '') => ({ bulan, nominal, catatan });
const project = (id, jadwal) => ({ projectId: id, projectCode: id.toUpperCase(), projectName: `Proyek ${id}`, projectEntityId: 'A', isTurunLapangan: true, nominalHonorBulanan: 999999999, gajiKontrak: { jadwal, gajiRab: 888888888, gajiNegosiasi: 777777777 } });
const people = [
  { id: 'p1', nik: 'nik-1', nama: 'Ahli Uji', entityId: 'A', entityName: 'Entitas A', proyekList: [
    project('project-1', [salary('2026-02', 10000000), salary('2026-03', 10000000), salary('2026-10', 15000000), salary('2026-11', null, 'Dokumen belum lengkap'), salary('2027-01', 99000000)]),
    project('project-2', [salary('2026-10', 12000000)]),
  ] },
  { id: 'p2', nik: 'nik-2', nama: 'Ahli Kedua', entityId: 'B', entityName: 'Entitas B', proyekList: [{ ...project('project-3', [salary('2026-10', 20000000)]), projectEntityId: 'B', projectEntityName: 'Entitas B' }] },
];
function payment(id, bulan, nominalHonor, extra = {}) {
  return { id, rekananId: 'p1', nik: 'nik-1', nama: 'Ahli Uji', entityId: 'A', entityName: 'Entitas A', projectId: 'project-1', projectCode: 'PROJECT-1', projectName: 'Proyek project-1', tahun: 2026, bulan, tanggal: '2026-10-21', nominalHonor, pph21: 0, nominalBersih: nominalHonor, ...extra };
}
const feb = payment('feb', 2, 10000000);
const payments = [feb, feb, payment('mar-a', 3, 4000000), payment('mar-b', 3, 6000000), payment('oct-a', 10, 5000000), payment('oct-b', 10, 3000000),
  payment('p2', 10, 4000000, { projectId: 'project-2' }), payment('b', 10, 8000000, { rekananId: 'p2', nik: 'nik-2', nama: 'Ahli Kedua', entityId: 'B', entityName: 'Entitas B', projectId: 'project-3' }),
  payment('old', 12, 1000000, { tahun: 2025 }), payment('next', 1, 2000000, { tahun: 2027 }),
  payment('legacy', 10, 2000000, { rekananId: null, nik: 'unregistered', nama: 'Arsip tanpa master', projectId: null }),
];
const rows = build(people, payments);
const october = filter(rows, { entityId: 'A', year: 2026, month: 10 });
assert(october.every(row => row.periode === '2026-10'));
assert.deepEqual([sum(october).gajiTerisi, sum(october).dibayar, sum(october).balance], [27000000, 14000000, 13000000]);
assert.equal(sum(october).jumlahPembayaran, 4);
assert.equal(sum(october).belumAdaGaji, true); // Legacy payment remains visible without fabricating a salary input.
const march = filter(rows, { entityId: 'A', year: 2026, month: 3 });
assert.equal(sum(march).dibayar, 10000000); // Cash date October does not change the March payroll period.
assert.equal(sum(march).jumlahPembayaran, 2);
const annual = filter(rows, { entityId: 'A', year: 2026 });
assert.deepEqual([sum(annual).gajiTerisi, sum(annual).dibayar, sum(annual).balance], [47000000, 34000000, 13000000]);
for (const dimension of ['proyek', 'bulan', 'nama', 'holding']) {
  const groups = group(annual, dimension);
  assert.equal(groups.reduce((total, item) => total + (item.summary.gajiTerisi || 0), 0), sum(annual).gajiTerisi);
  assert.equal(groups.reduce((total, item) => total + item.summary.dibayar, 0), sum(annual).dibayar);
}
assert.equal(sum(filter(rows, { entityId: 'A', year: 2026, month: 2 })).jumlahPembayaran, 1); // Duplicate payment ID counted once.
assert.equal(sum(filter(rows, { year: 2026, month: 10 })).dibayar, 22000000);
assert.equal(sum(filter(rows, { entityId: 'B', year: 2026, month: 10 })).gajiTerisi, 20000000);
assert.equal(filter(rows, { entityId: 'A', year: 2026, month: 1 }).length, 0);
assert.equal(sum(filter(build(people, []), { entityId: 'A', year: 2026 })).dibayar, 0);
assert.equal(sum(filter(rows, { year: 2027, month: 1, entityId: 'A' })).gajiTerisi, 99000000);
assert.equal(sum(filter(rows, { year: 2026, month: 11, entityId: 'A' })).gajiTerisi, null);
const edited = structuredClone(people);
edited[0].proyekList[0].gajiKontrak.jadwal[2].nominal = 31000000;
assert.equal(sum(filter(build(edited, payments), { year: 2026, month: 10, entityId: 'A' })).gajiTerisi, 43000000);
const zero = structuredClone(people);
zero[0].proyekList[0].gajiKontrak.jadwal[0].nominal = 0;
assert.equal(sum(filter(build(zero, payments), { year: 2026, month: 2, entityId: 'A' })).balance, -10000000);
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { TenagaAhliReport } = compile('src/components/payroll/TenagaAhliReport.tsx', {
  '@/lib/tenaga-ahli-tracking': tracking,
  'next/navigation': { usePathname: () => '/payroll', useSearchParams: () => new URLSearchParams() },
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
});
// Screenshot regression: profile in Gaharu, assignment and salary in Cipta Asri.
const crossEntityPeople = [{ id: 'cross', nama: 'Ahli Lintas Entitas', nik: 'cross-nik', entityId: 'gaharu', entityName: 'Gaharu',
  proyekList: [{ ...project('cad-001', [salary('2026-02', 10000000, 'Belum diterima uangnya')]), projectEntityId: 'ciptaAsri', projectEntityName: 'Cipta Asri' }] }];
const crossRows = build(crossEntityPeople, []);
const cipta = filter(crossRows, { entityId: 'ciptaAsri', year: 2026, month: 2 });
assert.deepEqual([sum(cipta).gajiTerisi, sum(cipta).dibayar, sum(cipta).balance, sum(cipta).jumlahKendala], [10000000, 0, 10000000, 1]);
assert.equal(cipta[0].entityName, 'Cipta Asri');
assert.equal(filter(crossRows, { entityId: 'gaharu', year: 2026 }).length, 0);
assert.equal(sum(crossRows).gajiTerisi, 10000000); // Holding counts the assignment only once.
assert.equal(filter(crossRows, { entityId: 'ciptaAsri', year: 2026, month: 10 }).length, 0);
const crossPaid = build(crossEntityPeople, [payment('cross-paid', 2, 4000000, { rekananId: 'cross', nik: 'cross-nik', entityId: 'ciptaAsri', entityName: 'Cipta Asri', projectId: 'cad-001' })]);
assert.equal(crossPaid.length, 1);
assert.deepEqual([sum(crossPaid).gajiTerisi, sum(crossPaid).dibayar, sum(crossPaid).balance], [10000000, 4000000, 6000000]);
const fallbackPeople = structuredClone(crossEntityPeople);
fallbackPeople[0].proyekList[0].projectEntityId = null;
assert.equal(sum(filter(build(fallbackPeople, []), { entityId: 'gaharu', year: 2026 })).gajiTerisi, 10000000);
for (const dimension of ['proyek', 'nama', 'bulan', 'holding']) {
  const html = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows: crossRows, group: dimension, entityId: 'ciptaAsri', entityName: 'Cipta Asri', year: 2026, month: 2, search: '' }));
  assert.match(html, /10\.000\.000/);
  assert.match(html, /0 transaksi tercatat/);
  assert.doesNotMatch(html, /Belum ada gaji terisi atau pembayaran tercatat/);
}
for (const dimension of ['proyek', 'nama', 'holding']) {
  const html = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows, group: dimension, entityId: 'A', entityName: 'Entitas A', year: 2026, month: 10, search: '' }));
  assert.match(html, /Tahun 2026/);
  assert.match(html, dimension === 'holding' ? /42\.000\.000/ : /34\.000\.000/);
  assert.match(html, /Gaji terisi/); assert.match(html, /Sudah dibayar/);
  const monthlyHtml = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows, group: dimension, entityId: 'A', entityName: 'Entitas A', year: 2026, month: 10, search: '', periodScope: 'bulan' }));
  assert.match(monthlyHtml, /Oktober 2026/);
  assert.doesNotMatch(monthlyHtml, /Februari 2026|Maret 2026|Januari 2027/);
  assert.match(monthlyHtml, dimension === 'holding' ? /22\.000\.000/ : /14\.000\.000/);
}
// A February payment remains in both accumulations when the page month is October.
const februaryRows = build(people, [feb]).filter(row => row.periode === '2026-02');
for (const dimension of ['proyek', 'nama']) {
  const props = { rows: februaryRows, group: dimension, entityId: 'A', entityName: 'Entitas A', year: 2026, month: 10, search: '' };
  const html = renderToStaticMarkup(React.createElement(TenagaAhliReport, props));
  assert.match(html, /10\.000\.000/);
  assert.match(html, /1 transaksi tercatat/);
  const monthlyHtml = renderToStaticMarkup(React.createElement(TenagaAhliReport, { ...props, periodScope: 'bulan' }));
  assert.doesNotMatch(monthlyHtml, /10\.000\.000/);
  assert.match(monthlyHtml, /0 transaksi tercatat/);
}
const yearlyHtml = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows, group: 'bulan', entityId: 'A', entityName: 'Entitas A', year: 2026, month: 10, search: '' }));
assert.match(yearlyHtml, /Februari 2026/); assert.match(yearlyHtml, /Maret 2026/); assert.match(yearlyHtml, /Oktober 2026/);
assert.doesNotMatch(yearlyHtml, /Januari 2027/);
console.log('Lulus: total semua rekap konsisten, dua bulan/parsial, edit gaji terbaru, entitas/tahun, gaji belum dibayar, deduplikasi, dan tracking Oktober hanya Oktober.');
