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

// Kode COA untuk setiap rekening
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

export type BankCoaMatch = { rekeningId: string; entityKey: string; rekeningNama: string };

export function getBankCoaMap(): Record<string, BankCoaMatch> {
  const map: Record<string, BankCoaMatch> = {};
  for (const [entityKey, rekenings] of Object.entries(REKENING_BY_ENTITY)) {
    for (const rekening of rekenings) {
      const code = REKENING_COA_CODE[rekening.id];
      if (code) map[code] = { rekeningId: rekening.id, entityKey, rekeningNama: rekening.nama };
    }
  }
  return map;
}

export function getRekeningCoaCode(rekeningIdOrNama: string): string | undefined {
  if (REKENING_COA_CODE[rekeningIdOrNama]) return REKENING_COA_CODE[rekeningIdOrNama];
  for (const options of Object.values(REKENING_BY_ENTITY)) {
    const found = options.find(
      (r) => r.nama.toLowerCase() === rekeningIdOrNama.toLowerCase() || r.id === rekeningIdOrNama
    );
    if (found && REKENING_COA_CODE[found.id]) {
      return REKENING_COA_CODE[found.id];
    }
  }
  return undefined;
}

export const ENTITY_NAMES: Record<string, string> = {
  kencana: "Kencana",
  gaharu: "Gaharu",
  tataring: "Tataring",
  ciptaAsri: "Cipta Asri",
  umum: "Umum",
};

export const KAS_BESAR_COA: Record<string, string> = {
  kencana: "110",
  gaharu: "120",
  tataring: "130",
  ciptaAsri: "140",
};

export const KAS_KECIL_COA: Record<string, string> = {
  kencana: "1100",
  gaharu: "1200",
  tataring: "1300",
  ciptaAsri: "1400",
  umum: "1500",
};

// Mengembalikan entityKey jika akun COA tersebut adalah Kas / Bank yang eksklusif milik entitas tertentu.
// Mengembalikan null untuk akun operasional umum, modal, beban, serta hutang & piutang antar entitas (agar bisa diedit oleh semua entitas).
export function getCoaOwnerEntityKey(coaCode: string): string | null {
  for (const [entityKey, code] of Object.entries(KAS_BESAR_COA)) {
    if (code === coaCode) return entityKey;
  }
  for (const [entityKey, code] of Object.entries(KAS_KECIL_COA)) {
    if (code === coaCode) return entityKey;
  }
  const bankMap = getBankCoaMap();
  if (bankMap[coaCode]) {
    return bankMap[coaCode].entityKey;
  }
  if (coaCode === "150") return "umum";
  return null;
}

export type CounterpartyMapping = {
  key: string;
  shortName: string;
  fullName: string;
  piutangCode: string;
  hutangCode: string;
};

export const INTERCOMPANY_MAPPINGS: CounterpartyMapping[] = [
  { key: "kencana", shortName: "KAK", fullName: "Kencana", piutangCode: "111", hutangCode: "311" },
  { key: "gaharu", shortName: "GS", fullName: "Gaharu", piutangCode: "112", hutangCode: "312" },
  { key: "tataring", shortName: "TB", fullName: "Tataring", piutangCode: "113", hutangCode: "313" },
  { key: "ciptaAsri", shortName: "CAD", fullName: "Cipta Asri", piutangCode: "114", hutangCode: "314" },
  { key: "umum", shortName: "KP", fullName: "Kardi Pratama", piutangCode: "115", hutangCode: "315" },
];

export type IntercompanyMirror = {
  targetEntityKey: string;
  targetEntityName: string;
  targetCoaCode: string;
  targetCoaNameSuggestion: string;
};

// Menentukan pasangan akun cermin antar entitas.
// Contoh: Gaharu isi 111 (PIUTANG KAK) -> Targetnya Kencana, akun 312 (Hutang GS).
export function getIntercompanyMirror(
  sourceEntityKey: string,
  coaCode: string
): IntercompanyMirror | null {
  for (const cp of INTERCOMPANY_MAPPINGS) {
    if (cp.key === sourceEntityKey) continue;

    if (coaCode === cp.piutangCode) {
      const sourceCp = INTERCOMPANY_MAPPINGS.find((c) => c.key === sourceEntityKey);
      if (sourceCp) {
        return {
          targetEntityKey: cp.key,
          targetEntityName: cp.fullName,
          targetCoaCode: sourceCp.hutangCode,
          targetCoaNameSuggestion: `Hutang ${sourceCp.shortName}`,
        };
      }
    } else if (coaCode === cp.hutangCode) {
      const sourceCp = INTERCOMPANY_MAPPINGS.find((c) => c.key === sourceEntityKey);
      if (sourceCp) {
        return {
          targetEntityKey: cp.key,
          targetEntityName: cp.fullName,
          targetCoaCode: sourceCp.piutangCode,
          targetCoaNameSuggestion: `PIUTANG ${sourceCp.shortName}`,
        };
      }
    }
  }

  return null;
}

// Mengecek apakah suatu akun COA adalah akun counterparty untuk diri sendiri
// (misal di Gaharu akun 112 PIUTANG GS atau 312 Hutang GS, yang seharusnya diisi oleh entitas lain terhadap Gaharu)
export function isSelfIntercompanyAccount(entityKey: string, coaCode: string): boolean {
  const cp = INTERCOMPANY_MAPPINGS.find((c) => c.key === entityKey);
  if (!cp) return false;
  return coaCode === cp.piutangCode || coaCode === cp.hutangCode;
}
