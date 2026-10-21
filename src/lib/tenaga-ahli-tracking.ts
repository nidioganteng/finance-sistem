import type { RekananTenagaAhliItem } from "./payroll";

export type TenagaAhliPayment = {
  id: string;
  rekananId: string | null;
  nik: string | null;
  nama: string;
  entityId: string;
  entityName: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  tahun: number;
  bulan: number;
  tanggal: string;
  nominalHonor: number;
  pph21: number;
  nominalBersih: number;
};

export type TenagaAhliTrackingRow = {
  id: string;
  personId: string | null;
  personKey: string;
  nama: string;
  nik: string | null;
  projectId: string | null;
  projectCode: string | null;
  projectName: string;
  entityId: string;
  entityName: string;
  periode: string;
  gajiTerisi: number | null;
  catatan: string;
  payments: TenagaAhliPayment[];
};

export function buildTenagaAhliTracking(people: RekananTenagaAhliItem[], payments: TenagaAhliPayment[]) {
  const map = new Map<string, TenagaAhliTrackingRow>();
  const identity = (person: string, project: string | null, period: string, entity: string) => JSON.stringify([person, project, period, entity]);
  for (const person of people) {
    for (const project of person.proyekList || []) {
      for (const row of project.gajiKontrak?.jadwal || []) {
        if (row.nominal === null && !row.catatan.trim()) continue;
        const entityId = person.entityId || project.projectEntityId || "";
        const id = identity(person.id, project.projectId, row.bulan, entityId);
        map.set(id, { id, personId: person.id, personKey: person.nik || person.id, nama: person.nama, nik: person.nik,
          projectId: project.projectId, projectCode: project.projectCode || null, projectName: project.projectName || "Proyek",
          entityId, entityName: person.entityName || project.projectEntityName || "Entitas",
          periode: row.bulan, gajiTerisi: row.nominal, catatan: row.catatan, payments: [] });
      }
    }
  }
  // Satu pembayaran hanya dihitung sekali, termasuk riwayat lama yang juga ditemukan lewat NIK.
  for (const payment of new Map(payments.map(item => [item.id, item])).values()) {
    const person = people.find(item => item.id === payment.rekananId)
      || people.find(item => item.nik && item.nik === payment.nik && item.proyekList?.some(project => project.projectId === payment.projectId))
      || people.find(item => item.nik && item.nik === payment.nik);
    const personId = person?.id || null;
    const period = `${payment.tahun}-${String(payment.bulan).padStart(2, "0")}`;
    const id = identity(personId || payment.rekananId || `legacy:${payment.nik || payment.nama}`, payment.projectId, period, payment.entityId);
    let row = map.get(id);
    if (!row) {
      row = { id, personId, personKey: person?.nik || payment.nik || personId || payment.nama,
        nama: person?.nama || payment.nama, nik: person?.nik || payment.nik,
        projectId: payment.projectId, projectCode: payment.projectCode,
        projectName: payment.projectName || "Non-proyek", entityId: payment.entityId, entityName: payment.entityName,
        periode: period, gajiTerisi: null, catatan: "", payments: [] };
      map.set(id, row);
    }
    row.payments.push(payment);
  }
  return [...map.values()].sort((a, b) => a.periode.localeCompare(b.periode) || a.nama.localeCompare(b.nama));
}

export function filterTenagaAhliTracking(rows: TenagaAhliTrackingRow[], options: {
  year: number; month?: number; entityId?: string; search?: string;
}) {
  const period = options.month ? `${options.year}-${String(options.month).padStart(2, "0")}` : String(options.year);
  const search = (options.search || "").toLocaleLowerCase("id-ID").trim();
  return rows.filter(row => (options.month ? row.periode === period : row.periode.startsWith(`${period}-`))
    && (!options.entityId || row.entityId === options.entityId)
    && (!search || `${row.nama} ${row.nik || ""} ${row.projectCode || ""} ${row.projectName} ${row.entityName} ${row.catatan}`.toLocaleLowerCase("id-ID").includes(search)));
}

export function summarizeTenagaAhliTracking(rows: TenagaAhliTrackingRow[]) {
  const inputs = rows.filter(row => row.gajiTerisi !== null);
  const gajiTerisi = inputs.length ? inputs.reduce((total, row) => total + (row.gajiTerisi || 0), 0) : null;
  const payments = [...new Map(rows.flatMap(row => row.payments).map(item => [item.id, item])).values()];
  const dibayar = payments.reduce((total, item) => total + item.nominalHonor, 0);
  return { gajiTerisi, dibayar, pph: payments.reduce((total, item) => total + item.pph21, 0),
    netto: payments.reduce((total, item) => total + item.nominalBersih, 0),
    balance: gajiTerisi === null ? null : gajiTerisi - dibayar,
    jumlahInput: inputs.length, jumlahPembayaran: payments.length,
    belumAdaGaji: rows.some(row => row.gajiTerisi === null && row.payments.length > 0),
    jumlahKendala: rows.filter(row => row.catatan.trim()).length };
}

export function groupTenagaAhliTracking(rows: TenagaAhliTrackingRow[], group: "proyek" | "bulan" | "nama" | "holding") {
  const groups = new Map<string, { key: string; label: string; rows: TenagaAhliTrackingRow[] }>();
  for (const row of rows) {
    const key = group === "proyek" ? row.projectId || "non-proyek" : group === "bulan" ? row.periode
      : group === "holding" ? row.entityId : row.personKey;
    const label = group === "proyek" ? `${row.projectCode ? `${row.projectCode} · ` : ""}${row.projectName}`
      : group === "bulan" ? row.periode : group === "holding" ? row.entityName : row.nama;
    const value = groups.get(key) || { key, label, rows: [] };
    value.rows.push(row); groups.set(key, value);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)).map(item => ({ ...item, summary: summarizeTenagaAhliTracking(item.rows) }));
}
