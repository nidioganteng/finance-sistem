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
const periode = compile('src/lib/tenaga-ahli-periode.ts');
const tracking = compile('src/lib/tenaga-ahli-tracking.ts', { './tenaga-ahli-periode': periode });
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
  assert.doesNotMatch(html, /catatan kendala pada periode ini/);
}
for (const dimension of ['proyek', 'nama', 'holding']) {
  const html = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows, group: dimension, entityId: 'A', entityName: 'Entitas A', year: 2026, month: 10, search: '' }));
  assert.match(html, dimension === 'nama' ? /Januari – Oktober 2026/ : /Tahun 2026/);
  assert.match(html, dimension === 'proyek' ? /34\.000\.000/ : /42\.000\.000/);
  assert.match(html, /Gaji terisi/); assert.match(html, /Sudah dibayar/);
  const monthlyHtml = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows, group: dimension, entityId: 'A', entityName: 'Entitas A', year: 2026, month: 10, search: '', periodScope: 'bulan' }));
  assert.match(monthlyHtml, /Oktober 2026/);
  assert.doesNotMatch(monthlyHtml, /Februari 2026|Maret 2026|Januari 2027/);
  assert.match(monthlyHtml, dimension === 'proyek' ? /14\.000\.000/ : /22\.000\.000/);
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
const multiPeople = [{ id: 'multi', nik: 'multi-nik', nama: 'Ahli Dua Entitas', entityId: 'A', entityName: 'Gaharu', proyekList: [
  { ...project('gh-001', [salary('2026-02', 10000000)]), projectEntityId: 'A', projectEntityName: 'Gaharu' },
  { ...project('kn-001', [salary('2026-02', 15000000)]), projectEntityId: 'B', projectEntityName: 'Kencana' },
] }, { id: 'new', nik: 'new-nik', nama: 'Ahli Belum Digaji', entityId: 'A', proyekList: [
  { ...project('gh-002', []), projectEntityName: 'Gaharu' },
] }];
const multiRows = build(multiPeople, []);
const allPeople = tracking.groupTenagaAhliPeople(multiRows, multiPeople);
assert.equal(allPeople.length, 2);
assert.equal(allPeople.find(item => item.key === 'multi-nik').assignments.length, 2);
assert.equal(allPeople.find(item => item.key === 'multi-nik').summary.gajiTerisi, 25000000);
assert.equal(allPeople.find(item => item.key === 'new-nik').summary.gajiTerisi, null);
for (const [entityId, code, amount] of [['A', 'gh-001', 10000000], ['B', 'kn-001', 15000000]]) {
  const scoped = tracking.groupTenagaAhliPeople(filter(multiRows, { entityId, year: 2026 }), multiPeople, entityId);
  const person = scoped.find(item => item.key === 'multi-nik');
  assert.equal(person.assignments.length, 1);
  assert.equal(person.assignments[0].projectId, code);
  assert.equal(person.summary.gajiTerisi, amount);
}
const globalHtml = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows: multiRows, people: multiPeople, entities: [{ id: 'A', key: 'gaharu', name: 'Gaharu' }, { id: 'B', key: 'kencana', name: 'Kencana' }], group: 'nama', entityId: 'A', entityName: 'Gaharu', year: 2026, month: 2, search: '' }));
assert.match(globalHtml, /Semua entitas/); assert.match(globalHtml, /Ahli Belum Digaji/);
assert.doesNotMatch(globalHtml, /GH-001|KN-001|Tracking bulan ini/); assert.match(globalHtml, /25\.000\.000/);
assert.match(globalHtml, /2 proyek · 2 input/);
const entitySelect = globalHtml.match(/<select aria-label="Entitas akumulasi tenaga ahli"[^>]*>(.*?)<\/select>/)[1];
assert.match(entitySelect, /value="all"[^>]*>Semua entitas/);
assert.match(entitySelect, /value="current">Gaharu/);
assert.equal((entitySelect.match(/<option/g) || []).length, 2);
assert.doesNotMatch(entitySelect, /Kencana/);
const navigationMocks = { usePathname: () => '/payroll', useSearchParams: () => new URLSearchParams('entity=gaharu') };
const entityProps = { rows: multiRows, people: multiPeople, entities: [{ id: 'A', key: 'gaharu', name: 'Gaharu' }, { id: 'B', key: 'kencana', name: 'Kencana' }], group: 'nama', entityId: 'A', entityName: 'Gaharu', year: 2026, month: 2, search: '' };
const scopedReport = compile('src/components/payroll/TenagaAhliReport.tsx', {
  react: { ...React, useState: initial => React.useState(initial === 'all' ? 'current' : initial) },
  '@/lib/tenaga-ahli-tracking': tracking, 'next/navigation': navigationMocks,
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
}).TenagaAhliReport;
const scopedHtml = renderToStaticMarkup(React.createElement(scopedReport, entityProps));
assert.match(scopedHtml, /10\.000\.000/); assert.match(scopedHtml, /1 proyek · 1 input/);
assert.match(scopedHtml, /Ahli Belum Digaji/);
assert.doesNotMatch(scopedHtml, /15\.000\.000/);
const switchedHtml = renderToStaticMarkup(React.createElement(scopedReport, { ...entityProps, entityId: 'B', entityName: 'Kencana' }));
assert.match(switchedHtml, /15\.000\.000/);
assert.doesNotMatch(switchedHtml, /Ahli Belum Digaji/);
const switchedSelect = switchedHtml.match(/<select aria-label="Entitas akumulasi tenaga ahli"[^>]*>(.*?)<\/select>/)[1];
assert.match(switchedSelect, /value="current"[^>]*>Kencana/); assert.doesNotMatch(switchedSelect, /Gaharu/);
const expandedReport = compile('src/components/payroll/TenagaAhliReport.tsx', {
  react: { ...React, useState: initial => React.useState(initial === null ? 'multi-nik' : initial) },
  '@/lib/tenaga-ahli-tracking': tracking, 'next/navigation': navigationMocks,
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
}).TenagaAhliReport;
const expandedHtml = renderToStaticMarkup(React.createElement(expandedReport, entityProps));
assert.match(expandedHtml, /GH-001/); assert.match(expandedHtml, /KN-001/);
assert.match(expandedHtml, /Proyek \/ entitas/);
assert.doesNotMatch(expandedHtml, /Bulan \/ tenaga ahli|Tracking bulan ini/);
function renderProjectDetails(personKey, projectIds, props = entityProps) {
  const Report = compile('src/components/payroll/TenagaAhliReport.tsx', {
    react: { ...React, useState: initial => React.useState(initial === null ? personKey : typeof initial === 'object' ? Object.fromEntries(projectIds.map(id => [JSON.stringify([personKey, id]), true])) : initial) },
    '@/lib/tenaga-ahli-tracking': tracking, 'next/navigation': navigationMocks,
    'next/link': { default: ({ children, ...linkProps }) => React.createElement('a', linkProps, children) },
  }).TenagaAhliReport;
  return renderToStaticMarkup(React.createElement(Report, props));
}
const gaharuDetailHtml = renderProjectDetails('multi-nik', ['gh-001']);
assert.match(gaharuDetailHtml, /Bulan \/ tenaga ahli/);
assert.match(gaharuDetailHtml, /entity=gaharu[^" ]*proyekAhliId=gh-001/);
assert.doesNotMatch(gaharuDetailHtml, /entity=kencana[^" ]*proyekAhliId=kn-001/);
const bothDetailsHtml = renderProjectDetails('multi-nik', ['gh-001', 'kn-001']);
assert.match(bothDetailsHtml, /entity=kencana[^" ]*proyekAhliId=kn-001/);
assert.match(bothDetailsHtml, /entity=gaharu[^" ]*proyekAhliId=gh-001/);
const emptyProjectHtml = renderProjectDetails('new-nik', ['gh-002']);
assert.match(emptyProjectHtml, /GH-002/);
assert.match(emptyProjectHtml, /Belum ada gaji terisi atau pembayaran pada periode ini/);
assert.equal(tracking.groupTenagaAhliPeople([], multiPeople, undefined, 'tidak cocok').length, 0);
const negotiatedPeople = [{ ...people[0], proyekList: [{ ...project('project-1', [salary('2026-02', 10000000), salary('2026-03', 10000000), salary('2026-04', null)]), gajiKontrak: { gajiNegosiasi: 35000000, gajiRab: 50000000, jadwal: [salary('2026-02', 10000000), salary('2026-03', 10000000), salary('2026-04', null)] } }] }];
const negotiatedRows = build(negotiatedPeople, [feb, payment('mar-full', 3, 10000000)]);
assert.deepEqual([sum(negotiatedRows).totalNegosiasi, sum(negotiatedRows).dibayarKontrak, sum(negotiatedRows).balanceNegosiasi], [35000000, 20000000, 15000000]);
const februaryOnly = filter(negotiatedRows, { entityId: 'A', year: 2026, month: 2 });
assert.deepEqual([sum(februaryOnly).dibayar, sum(februaryOnly).balanceNegosiasi], [10000000, 15000000]);
const emptyApril = filter(negotiatedRows, { entityId: 'A', year: 2026, month: 4 });
assert.equal(sum(emptyApril).gajiTerisi, null);
assert.equal(sum(emptyApril).balanceNegosiasi, 15000000);
const completedRows = build(negotiatedPeople, [feb, payment('mar-full', 3, 10000000), payment('rest', 4, 15000000)]);
assert.equal(sum(completedRows).balanceNegosiasi, 0);
for (const dimension of ['nama', 'proyek', 'bulan', 'holding']) {
  const html = renderToStaticMarkup(React.createElement(TenagaAhliReport, { rows: negotiatedRows, people: negotiatedPeople, group: dimension, entityId: 'A', entityName: 'Gaharu', year: 2026, month: 2, search: '' }));
  assert.match(html, /Balance negosiasi/); assert.match(html, /35\.000\.000/); assert.match(html, /15\.000\.000/);
}
const taxPayments = [
  payment('tax-feb', 2, 10000000, { pph21: 300000 }),
  payment('tax-feb', 2, 10000000, { pph21: 300000 }),
  payment('tax-mar', 3, 10000000, { pph21: 200000 }),
  payment('tax-oct', 10, 15000000, { pph21: 900000 }),
  payment('tax-old', 12, 1000000, { tahun: 2025, pph21: 123456 }),
  payment('tax-next', 1, 1000000, { tahun: 2027, pph21: 654321 }),
  payment('tax-other', 3, 20000000, { rekananId: 'p2', nik: 'nik-2', nama: 'Ahli Kedua', projectId: 'project-3', entityId: 'B', entityName: 'Entitas B', pph21: 700000 }),
];
const taxRows = build(people, taxPayments);
const throughMarch = filter(taxRows, { year: 2026, untilMonth: 3, entityId: 'A', search: 'Ahli Uji' });
assert.deepEqual([sum(throughMarch).dibayar, sum(throughMarch).pph, sum(throughMarch).netto, sum(throughMarch).jumlahPembayaran], [20000000, 500000, 20000000, 2]);
assert(throughMarch.every(row => row.periode >= '2026-01' && row.periode <= '2026-03'));
assert.equal(sum(filter(taxRows, { year: 2026, untilMonth: 2, entityId: 'A' })).pph, 300000);
assert.equal(sum(filter(taxRows, { year: 2026, untilMonth: 1, entityId: 'A' })).pph, 0);
assert.equal(sum(filter(taxRows, { year: 2026, untilMonth: 12, entityId: 'A' })).pph, 1400000);
assert.equal(sum(filter(taxRows, { year: 2026, untilMonth: 3 })).pph, 1200000);
assert.equal(sum(filter(taxRows, { year: 2026, month: 3, entityId: 'A' })).pph, 200000);
assert.equal(group(throughMarch, 'nama')[0].summary.pph, 500000);
const taxHtml = renderProjectDetails('nik-1', ['project-1'], { rows: taxRows, people, group: 'nama', entityId: 'A', entityName: 'Entitas A', year: 2026, month: 3, search: 'Ahli Uji' });
assert.match(taxHtml, /Januari – Maret 2026/);
assert.match(taxHtml, /Sampai bulan dipilih/);
assert.match(taxHtml, /Total PPh perusahaan/);
assert.match(taxHtml, /500\.000/);
assert.match(taxHtml, /300\.000/);
assert.match(taxHtml, /200\.000/);
assert.match(taxHtml, /Februari 2026|Maret 2026/);
assert.doesNotMatch(taxHtml, /Oktober 2026|Januari 2027|Ahli Kedua|900\.000/);
assert.match(taxHtml, /tanpa mengurangi gaji diterima/);
const datedPeople = [{ ...people[0], proyekList: [{ ...people[0].proyekList[0], tanggalMulaiTugas: '2026-02-21', tanggalSelesaiTugas: '2026-03-21', gajiKontrak: null }] }];
assert.equal(tracking.groupTenagaAhliPeople([], datedPeople, 'A', '', { year: 2026, month: 1 }).length, 0);
assert.equal(tracking.groupTenagaAhliPeople([], datedPeople, 'A', '', { year: 2026, month: 2 }).length, 1);
assert.equal(tracking.groupTenagaAhliPeople([], datedPeople, 'A', '', { year: 2026, month: 3 }).length, 1);
assert.equal(tracking.groupTenagaAhliPeople([], datedPeople, 'A', '', { year: 2026, month: 4 }).length, 0);
assert.equal(tracking.groupTenagaAhliPeople([], datedPeople, 'A', '', { year: 2026, untilMonth: 4 }).length, 1);
assert.equal(tracking.groupTenagaAhliPeople(throughMarch, datedPeople, 'A', '', { year: 2026, untilMonth: 4 })[0].summary.dibayar, 20000000);
const futureEmpty = [{ ...datedPeople[0], proyekList: [{ ...datedPeople[0].proyekList[0], tanggalMulaiTugas: '2026-05-01', tanggalSelesaiTugas: '2026-06-30' }] }];
assert.equal(tracking.groupTenagaAhliPeople([], futureEmpty, 'A', '', { year: 2026, untilMonth: 4 }).length, 0);
console.log('Lulus: rekap gaji/PPh kumulatif per nama, rincian bulanan, batas bulan/tahun, pencarian, entitas, tanpa pemotongan PPh, deduplikasi, dan tracking.');
