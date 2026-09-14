export type RekeningOption = { id: string; nama: string };

// Data acuan dari Bagan Akun klien (CLAUDE_BANKBUKU.md)
export const REKENING_BY_ENTITY: Record<string, RekeningOption[]> = {
  kencana:   [{ id: "kak-bri", nama: "BRI KAK" }, { id: "kak-bpd", nama: "BPD KAK" }],
  gaharu:    [{ id: "gs-bri",  nama: "BRI GS"  }, { id: "gs-bpd",  nama: "BPD GS"  }],
  tataring:  [{ id: "tb-bpd",  nama: "BPD TB"  }],
  ciptaAsri: [{ id: "cad-bpd", nama: "BPD CAD" }],
  umum:      [{ id: "kp-bpd",  nama: "BPD KP"  }],
};

// Kode COA untuk setiap rekening (kode ini harus ada di CoaAccount)
export const REKENING_COA_CODE: Record<string, string> = {
  "kak-bri": "1-201",
  "kak-bpd": "1-202",
  "gs-bri":  "1-101",
  "gs-bpd":  "1-102",
  "tb-bpd":  "1-301",
  "cad-bpd": "1-401",
  "kp-bpd":  "1-501",
};

// Peta nama rekening → kode COA (dipakai seed & display fallback)
export const REKENING_NAMA_TO_COA_CODE: Record<string, string> = {
  "BRI KAK": "1-201",
  "BPD KAK": "1-202",
  "BRI GS":  "1-101",
  "BPD GS":  "1-102",
  "BPD TB":  "1-301",
  "BPD CAD": "1-401",
  "BPD KP":  "1-501",
};

export function getRekeningNama(entityKey: string, rekeningId: string): string | undefined {
  return REKENING_BY_ENTITY[entityKey]?.find((r) => r.id === rekeningId)?.nama;
}

export function isValidRekening(entityKey: string, rekeningId: string): boolean {
  return REKENING_BY_ENTITY[entityKey]?.some((r) => r.id === rekeningId) ?? false;
}
