#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji anti-double-count dual-source Pendapatan.
#
# Skenario: faktur sudah dijurnal secara manual ke COA PENDAPATAN TANPA
# mengisi Transaction.fakturId (data lama / entri manual).
#
# Cara kerja: INSERT Transaction langsung ke DB (mensimulasikan entri lama),
# bukan lewat API — sehingga fakturId tetap NULL.
#
# Yang diuji:
#   S1: GET laba-rugi SEBELUM: totalPendapatan = P0
#   S2: POST faktur baru (nilaiProyek = X)
#   S3: INSERT Transaction manual ke COA PENDAPATAN, kredit = X, fakturId NULL
#   S4: GET laba-rugi SETELAH:
#       totalPendapatan harus = P0 + X  (bukan P0 + 2X)
#       fakturUnlinked harus = 0  (faktur sudah terdeteksi sebagai "sudah dijurnal")
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
PASS=0; FAIL=0
YEAR=$(date +%Y)
MONTH=$(date +%-m)

ENTITY_ID="cmurrzve80000z3mqg9zl6rne"
# Akun COA PENDAPATAN (kode 400) — dari DB dev
COA_PENDAPATAN_ID="cmv08l3cf001k80ja4nr0474k"
# User ID untuk staffId — manajer keuangan
STAFF_ID="cmurrzvhz0006z3mqngpy7cx8"
# JenisInputId untuk field wajib Transaction
JENIS_INPUT_ID="cmurrzvi6000az3mqlbz89l0m"

login() {
  curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))"
}

http_body() {
  curl -s -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$4"
}

http_status() {
  curl -s -o /dev/null -w "%{http_code}" -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$4"
}

MQ() {
  mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
    --skip-column-names -e "$1" 2>/dev/null
}

check() {
  local label="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label  (got=$got, want=$want)"; FAIL=$((FAIL+1))
  fi
}

echo "═══════════════════════════════════════════════════════════"
echo " Uji anti-double-count: faktur dijurnal manual tanpa fakturId"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "── Login ──"
TOKEN=$(login "manajer@gaharusempana.com" "password123")
[ -z "$TOKEN" ] && echo "GAGAL login." && exit 1
echo "  Token diperoleh."

# S1: baseline total pendapatan sebelum tes
LR_BEFORE=$(http_body "$TOKEN" GET "api/laba-rugi?entityId=$ENTITY_ID&dari=$YEAR-01-01&sampai=$YEAR-12-31" "")
TP_BEFORE=$(echo "$LR_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalPendapatan',0))")
echo ""
echo "── Baseline: totalPendapatan sebelum tes = $TP_BEFORE ──"

# S2: buat faktur baru
echo ""
echo "── S2: POST faktur baru (nilaiProyek akan dijurnal manual tanpa fakturId) ──"
NF="TEST-NODC-$(date +%s)"
# dpp=500000, dppNilaiLain=450450, tarif=11% → nilaiProyek = round(500000*111/100) = 555000
FAKTUR_BODY=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "npwp": "00.000.000.0-000.000",
  "noFaktur": "$NF",
  "masaPajak": $MONTH,
  "tahunPajak": $YEAR,
  "namaRekanan": "Rekanan Test NoDC",
  "namaJkp": "Jasa Test Anti-DoubleCount",
  "dpp": 500000,
  "dppNilaiLain": 450450,
  "tarifPpnPersen": 11,
  "tarifPphPersen": 3.5
}
EOF
)
POST_S=$(http_status "$TOKEN" POST "api/pendapatan/faktur" "$FAKTUR_BODY")
check "POST faktur HTTP 201" "$POST_S" "201"

FAKTUR_ID=$(MQ "SELECT id FROM FakturPendapatan WHERE noFaktur='$NF';")
NILAI_PROYEK=$(MQ "SELECT CAST(nilaiProyek AS SIGNED) FROM FakturPendapatan WHERE id='$FAKTUR_ID';")
echo "  nilaiProyek = $NILAI_PROYEK"

if [ -z "$FAKTUR_ID" ]; then
  echo "GAGAL: Faktur tidak ditemukan di DB."
  exit 1
fi

# S3: INSERT Transaction manual ke COA PENDAPATAN, fakturId = NULL
# (mensimulasikan entri lama yang sudah dibuat sebelum fakturId diisi)
echo ""
echo "── S3: INSERT Transaction manual tanpa fakturId (simulasi data lama) ──"
TX_ID="TEST-NODC-TX-$(date +%s)"
TX_DATE="$YEAR-$(printf '%02d' $MONTH)-15 00:00:00.000"

MQ "INSERT INTO \`Transaction\`
    (id, entityId, jenisInputId, tanggal, noBukti, keterangan,
     coaAccountId, debit, kredit, saldoSetelah, staffId, fakturId, createdAt)
    VALUES (
      '$TX_ID',
      '$ENTITY_ID',
      '$JENIS_INPUT_ID',
      '$TX_DATE',
      'TEST-NODC-BKT',
      'Pendapatan jasa manual tanpa fakturId',
      '$COA_PENDAPATAN_ID',
      0,
      $NILAI_PROYEK,
      $NILAI_PROYEK,
      '$STAFF_ID',
      NULL,
      NOW()
    );"
echo "  Transaction disisipkan (fakturId = NULL)."

# S4: GET laba-rugi setelah insersi
echo ""
echo "── S4: GET laba-rugi setelah insersi → harus P0 + X bukan P0 + 2X ──"
LR_AFTER=$(http_body "$TOKEN" GET "api/laba-rugi?entityId=$ENTITY_ID&dari=$YEAR-01-01&sampai=$YEAR-12-31" "")
TP_AFTER=$(echo "$LR_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalPendapatan',0))")
FU_AFTER=$(echo "$LR_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fakturUnlinked',0))")

DELTA=$(python3 -c "print(round(float('$TP_AFTER') - float('$TP_BEFORE')))")
DOUBLE=$(python3 -c "print(round(2 * $NILAI_PROYEK))")

echo "  totalPendapatan sebelum : $TP_BEFORE"
echo "  totalPendapatan sesudah : $TP_AFTER"
echo "  selisih aktual          : $DELTA"
echo "  nilaiProyek faktur      : $NILAI_PROYEK"
echo "  nilaiProyek × 2 (double): $DOUBLE"
echo "  fakturUnlinked          : $FU_AFTER"

check "totalPendapatan naik tepat 1× nilaiProyek (bukan 2×)" "$DELTA" "$NILAI_PROYEK"
check "fakturUnlinked = 0 (faktur terdeteksi sudah dijurnal)" "$FU_AFTER" "0"

# ── Cleanup ──
echo ""
echo "── Cleanup ──"
MQ "DELETE FROM \`Transaction\` WHERE id='$TX_ID';"
http_status "$TOKEN" DELETE "api/pendapatan/faktur/$FAKTUR_ID" "" > /dev/null
echo "  Transaction dan faktur uji dihapus."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════════"
[ $FAIL -gt 0 ] && exit 1 || exit 0
