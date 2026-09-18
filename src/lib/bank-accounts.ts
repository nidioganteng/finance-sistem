export type RekeningOption = { id: string; nama: string };

export const REKENING_BY_ENTITY: Record<string, RekeningOption[]> = {
  kencana:   [
    { id: "kak-bri", nama: "BRI KAK" },
    { id: "kak-bpd", nama: "BPD KAK" },
    { id: "kak-bni", nama: "BNI KAK" },
    { id: "kak-mdr", nama: "MDR KAK" },
  ],
  gaharu:    [
    { id: "gs-bri",  nama: "BRI GS"  },
    { id: "gs-bpd",  nama: "BPD GS"  },
    { id: "gs-bni",  nama: "BNI GS"  },
    { id: "gs-mdr",  nama: "MDR GS"  },
  ],
  tataring:  [
    { id: "tb-bpd",  nama: "BPD TB"  },
    { id: "tb-bni",  nama: "BNI TB"  },
  ],
  ciptaAsri: [{ id: "cad-bpd", nama: "BPD CAD" }],
  umum:      [{ id: "kp-bpd",  nama: "BPD KP"  }],
};

// Kode COA BANK scope untuk setiap rekening
export const REKENING_COA_CODE: Record<string, string> = {
  "kak-bri": "11",
  "kak-bpd": "12",
  "kak-bni": "13",
  "kak-mdr": "14",
  "gs-bri":  "21",
  "gs-bpd":  "22",
  "gs-bni":  "23",
  "gs-mdr":  "24",
  "tb-bpd":  "31",
  "tb-bni":  "32",
  "cad-bpd": "41",
  "kp-bpd":  "51",
};

export function getRekeningNama(entityKey: string, rekeningId: string): string | undefined {
  return REKENING_BY_ENTITY[entityKey]?.find((r) => r.id === rekeningId)?.nama;
}

export function isValidRekening(entityKey: string, rekeningId: string): boolean {
  return REKENING_BY_ENTITY[entityKey]?.some((r) => r.id === rekeningId) ?? false;
}
