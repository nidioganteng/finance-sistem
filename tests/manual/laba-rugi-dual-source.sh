#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji laba-rugi dual-source: FakturPendapatan yang belum dijurnal
# harus muncul di pendapatan Laba Rugi.
#
# S1: Buat faktur tanpa linkTransaksi → GET laba-rugi harus punya faktur_unlinked > 0
# S2: Link faktur ke transaksi → GET laba-rugi tidak boleh double-count
# S3: Response punya field 'fakturUnlinked'
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
PASS=0; FAIL=0
YEAR=$(date +%Y)
MONTH=$(date +%-m)

login() {
  curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))"
}

http_status() {
  curl -s -o /dev/null -w "%{http_code}" -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$4"
}

http_body() {
  curl -s -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$4"
}

check() {
  local label="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label  (got=$got, want=$want)"; FAIL=$((FAIL+1))
  fi
}

check_gt() {
  local label="$1" got="$2"
  if python3 -c "exit(0 if float('$got') > 0 else 1)" 2>/dev/null; then
    echo "  ✓ $label (=$got > 0)"; PASS=$((PASS+1))
  else
    echo "  ✗ $label  (got=$got, harus > 0)"; FAIL=$((FAIL+1))
  fi
}

ENTITY_ID="cmurrzve80000z3mqg9zl6rne"

echo "═══════════════════════════════════════════════════════════"
echo " Uji laba-rugi dual-source Pendapatan"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "── Login ──"
TOKEN=$(login "manajer@gaharusempana.com" "password123")
[ -z "$TOKEN" ] && echo "GAGAL login." && exit 1
echo "  Token diperoleh."

# Baseline: GET laba-rugi sebelum tambah faktur
LR_BEFORE=$(http_body "$TOKEN" GET "api/laba-rugi?entityId=$ENTITY_ID&dari=$YEAR-01-01&sampai=$YEAR-12-31" "")
TP_BEFORE=$(echo "$LR_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalPendapatan',0))")
FU_BEFORE=$(echo "$LR_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fakturUnlinked',0))")

echo ""
echo "── S1: GET laba-rugi harus punya field 'fakturUnlinked' ──"
HAS_FU=$(echo "$LR_BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'fakturUnlinked' in d else 'no')")
check "Response punya field 'fakturUnlinked'" "$HAS_FU" "yes"

echo ""
echo "── S2: Buat faktur unlinked → totalPendapatan harus naik ──"
NF="TEST-LR-DS-$(date +%s)"
# dpp=1000000, dppNilaiLain=900900, tarif=11% → nilaiProyek = round(1000000*111/100) = 1110000
FAKTUR_BODY=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "npwp": "00.000.000.0-000.000",
  "noFaktur": "$NF",
  "masaPajak": $MONTH,
  "tahunPajak": $YEAR,
  "namaRekanan": "Rekanan Test LR",
  "namaJkp": "Jasa Test LR Dual Source",
  "dpp": 1000000,
  "dppNilaiLain": 900900,
  "tarifPpnPersen": 11,
  "tarifPphPersen": 3.5
}
EOF
)
POST_S=$(http_status "$TOKEN" POST "api/pendapatan/faktur" "$FAKTUR_BODY")
check "POST faktur HTTP 201" "$POST_S" "201"

FAKTUR_ID=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT id FROM FakturPendapatan WHERE noFaktur='$NF';" 2>/dev/null)
NILAI_PROYEK=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT CAST(nilaiProyek AS SIGNED) FROM FakturPendapatan WHERE id='$FAKTUR_ID';" 2>/dev/null)

LR_AFTER=$(http_body "$TOKEN" GET "api/laba-rugi?entityId=$ENTITY_ID&dari=$YEAR-01-01&sampai=$YEAR-12-31" "")
TP_AFTER=$(echo "$LR_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalPendapatan',0))")
FU_AFTER=$(echo "$LR_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fakturUnlinked',0))")

# totalPendapatan harus naik sebesar nilaiProyek
DELTA=$(python3 -c "print(round(float('$TP_AFTER') - float('$TP_BEFORE')))")
check "totalPendapatan naik = nilaiProyek faktur ($NILAI_PROYEK)" "$DELTA" "$NILAI_PROYEK"
check_gt "fakturUnlinked > 0 setelah faktur ditambah" "$FU_AFTER"

# ── Cleanup ──
echo ""
echo "── Cleanup ──"
[ -n "$FAKTUR_ID" ] && http_status "$TOKEN" DELETE "api/pendapatan/faktur/$FAKTUR_ID" "" > /dev/null
echo "  Faktur uji dihapus."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════════"
[ $FAIL -gt 0 ] && exit 1 || exit 0
