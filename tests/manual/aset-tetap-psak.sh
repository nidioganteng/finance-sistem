#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji aset-tetap: 4 kategori PSAK, TANAH tidak disusutkan, field baru.
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
PASS=0; FAIL=0

login() {
  curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))"
}

http_status() {
  curl -s -o /dev/null -w "%{http_code}" \
    -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d "$4"
}

http_body() {
  curl -s -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d "$4"
}

check() {
  local label="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ $label  (got=$got, want=$want)"
    FAIL=$((FAIL+1))
  fi
}

ENTITY_ID="cmurrzve80000z3mqg9zl6rne"
YEAR=$(date +%Y)

echo "═══════════════════════════════════════════════════════════"
echo " Uji aset-tetap: 4 kategori PSAK + TANAH guard"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "── Login ──"
TOKEN=$(login "manajer@gaharusempana.com" "password123")
[ -z "$TOKEN" ] && echo "GAGAL login." && exit 1
echo "  Token diperoleh."

# ── S1: POST dengan kategori lama harus gagal ──
echo ""
echo "── S1: POST kategori lama 'GEDUNG' harus 400 ──"
BODY_GEDUNG=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "kode": "TEST-GEDUNG-LAMA",
  "nama": "Gedung Lama",
  "kategori": "GEDUNG",
  "tanggalPerolehan": "2020-01-01",
  "hargaPerolehan": 500000000,
  "umurBulan": 240
}
EOF
)
S1=$(http_status "$TOKEN" POST "api/aset-tetap" "$BODY_GEDUNG")
check "POST kategori GEDUNG (lama) → 400" "$S1" "400"

# ── S2: POST TANAH → umurBulan dipaksa 0 ──
echo ""
echo "── S2: POST TANAH → umurBulan harus 0 meski input 120 ──"
BODY_TANAH=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "kode": "TEST-TANAH-$(date +%s)",
  "nama": "Tanah Test PSAK",
  "kategori": "TANAH",
  "tanggalPerolehan": "2015-06-01",
  "hargaPerolehan": 800000000,
  "umurBulan": 120
}
EOF
)
S2=$(http_status "$TOKEN" POST "api/aset-tetap" "$BODY_TANAH")
check "POST TANAH HTTP 201" "$S2" "201"

# Ambil ID aset tanah yang baru dibuat
TANAH_KODE=$(echo "$BODY_TANAH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('kode',''))")
TANAH_ID=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT id FROM AsetTetap WHERE kode LIKE 'TEST-TANAH-%' ORDER BY createdAt DESC LIMIT 1;" 2>/dev/null)
TANAH_UMUR=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT umurBulan FROM AsetTetap WHERE id='$TANAH_ID';" 2>/dev/null)
check "TANAH umurBulan disimpan sebagai 0" "$TANAH_UMUR" "0"

# ── S3: GET list harus punya rekapPerKategori ──
echo ""
echo "── S3: GET /api/aset-tetap?entityId=...&year=$YEAR → rekapPerKategori ada ──"
GET_BODY=$(http_body "$TOKEN" GET "api/aset-tetap?entityId=$ENTITY_ID&year=$YEAR" "")
HAS_REKAP=$(echo "$GET_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if 'rekapPerKategori' in d else 'no')
")
check "Response punya rekapPerKategori" "$HAS_REKAP" "yes"

HAS_ASET_KEY=$(echo "$GET_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if 'aset' in d else 'no')
")
check "Response punya key 'aset'" "$HAS_ASET_KEY" "yes"

# ── S4: Field baru di item aset ──
echo ""
echo "── S4: Item aset harus punya akumulasiPenyusutanAwalTahun & nilaiBukuAwalTahun ──"
ASET_ARRAY=$(echo "$GET_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items = d.get('aset', [])
# cari tanah yang baru saja dibuat
tanah = [a for a in items if a.get('kategori')=='TANAH']
if tanah:
    a = tanah[0]
    print(a.get('akumulasiPenyusutanAwalTahun','MISSING'), a.get('nilaiBukuAwalTahun','MISSING'), a.get('bebanPenyusutan','MISSING'))
else:
    print('no_tanah no_tanah no_tanah')
")
AKUM_AWAL=$(echo "$ASET_ARRAY" | awk '{print $1}')
NILAI_BUKU_AWAL=$(echo "$ASET_ARRAY" | awk '{print $2}')
BEBAN_TANAH=$(echo "$ASET_ARRAY" | awk '{print $3}')
check "TANAH akumulasiPenyusutanAwalTahun = 0" "$AKUM_AWAL" "0"
check "TANAH bebanPenyusutan = 0" "$BEBAN_TANAH" "0"

# ── S5: PUT TANAH dengan umurBulan eksplisit → dipaksa 0 ──
echo ""
echo "── S5: PUT TANAH dengan umurBulan=240 → harus disimpan 0 ──"
if [ -n "$TANAH_ID" ]; then
  PUT_BODY='{"umurBulan": 240}'
  PUT_S=$(http_status "$TOKEN" PUT "api/aset-tetap/$TANAH_ID" "$PUT_BODY")
  check "PUT TANAH HTTP 200" "$PUT_S" "200"
  TANAH_UMUR_SETELAH=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
    --skip-column-names -e "SELECT umurBulan FROM AsetTetap WHERE id='$TANAH_ID';" 2>/dev/null)
  check "TANAH umurBulan tetap 0 setelah PUT dengan umurBulan=240" "$TANAH_UMUR_SETELAH" "0"
fi

# ── S6: POST BANGUNAN (kategori PSAK baru) harus berhasil ──
echo ""
echo "── S6: POST kategori BANGUNAN (PSAK) harus 201 ──"
BODY_BGN=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "kode": "TEST-BGN-$(date +%s)",
  "nama": "Bangunan Test PSAK",
  "kategori": "BANGUNAN",
  "tanggalPerolehan": "2020-01-01",
  "hargaPerolehan": 500000000,
  "umurBulan": 240
}
EOF
)
S6=$(http_status "$TOKEN" POST "api/aset-tetap" "$BODY_BGN")
check "POST BANGUNAN HTTP 201" "$S6" "201"

BGN_ID=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT id FROM AsetTetap WHERE kode LIKE 'TEST-BGN-%' ORDER BY createdAt DESC LIMIT 1;" 2>/dev/null)

# ── Cleanup ──
echo ""
echo "── Cleanup ──"
for AID in "$TANAH_ID" "$BGN_ID"; do
  [ -n "$AID" ] && http_status "$TOKEN" DELETE "api/aset-tetap/$AID" "" > /dev/null
done
echo "  Aset uji dihapus."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════════"
[ $FAIL -gt 0 ] && exit 1 || exit 0
