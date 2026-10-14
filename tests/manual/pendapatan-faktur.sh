#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji perbaikan modul pendapatan:
#   Gap 1 — rumus nilaiProyek: round(dpp × 111/100)
#   Gap 2 — path kuitansi bruto: nilaiKuitansi sebagai input utama
#   Gap 3 — DELETE faktur melepas Transaction.fakturId terlebih dahulu
#
# Jalankan SETELAH server PHP aktif: php -S localhost:8000 api/router.php
# Semua noBukti ber-prefiks TEST- agar mudah dibersihkan dengan cleanup.sh
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
PASS=0; FAIL=0

login() {
  curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))"
}

http() {
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

mq() {
  mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
    --skip-column-names -e "$1" 2>/dev/null | awk '{printf "%d\n", $1}'
}

mqs() {
  mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
    --skip-column-names -e "$1" 2>/dev/null
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

ENTITY_ID="cmurrzve80000z3mqg9zl6rne"   # gaharu

echo "═══════════════════════════════════════════════════════"
echo " Uji pendapatan: nilaiProyek formula + kuitansi + DELETE"
echo "═══════════════════════════════════════════════════════"

echo ""
echo "── Login ──"
TOKEN=$(login "manajer@gaharusempana.com" "password123")
[ -z "$TOKEN" ] && echo "GAGAL login." && exit 1
echo "  Token diperoleh."

# ── Skenario 1: POST faktur standar → nilaiProyek = round(dpp × 111/100) ─────
echo ""
echo "── Skenario 1: nilaiProyek = round(dpp × 111/100) (bukan dpp + ppn) ──"

NF1="TEST-PDT-S1-$(date +%s)"
# dpp=100000, dppNilaiLain=91667, tarifPpn=11 → nilaiProyek harus 111000 (bukan 110083)
BODY1='{
  "entityId":"'"$ENTITY_ID"'",
  "npwp":"00.000.000.0-000.000",
  "noFaktur":"'"$NF1"'",
  "masaPajak":10,
  "tahunPajak":2026,
  "namaRekanan":"Uji Rekanan S1",
  "namaJkp":"Jasa Uji S1",
  "dpp":100000,
  "dppNilaiLain":91667,
  "tarifPpnPersen":11,
  "tarifPphPersen":3.5
}'

STATUS1=$(http "$TOKEN" POST "api/pendapatan/faktur" "$BODY1")
check "POST HTTP 201" "$STATUS1" "201"

NILAI_PROYEK1=$(mq "SELECT nilaiProyek FROM FakturPendapatan WHERE noFaktur='$NF1'")
check "nilaiProyek = 111000 (round(dpp×111/100))" "$NILAI_PROYEK1" "111000"

PPN1=$(mq "SELECT ppn FROM FakturPendapatan WHERE noFaktur='$NF1'")
check "ppn = 10083 (round(91667×11/100))" "$PPN1" "10083"

LABA1=$(mq "SELECT labaSetelahPajak FROM FakturPendapatan WHERE noFaktur='$NF1'")
# laba = round(dpp - pph) = round(100000 - round(100000×3.5/100)) = round(100000-3500) = 96500
check "labaSetelahPajak = 96500" "$LABA1" "96500"

# ── Skenario 2: POST faktur kuitansi bruto → nilaiProyek = nilaiKuitansi ──────
echo ""
echo "── Skenario 2: path kuitansi bruto → nilaiProyek = nilaiKuitansi ──"

NF2="TEST-PDT-S2-$(date +%s)"
# nilaiKuitansi=111000 → dpp=100000, ppn=round(111000×11/111)=11000, nilaiProyek=111000
BODY2='{
  "entityId":"'"$ENTITY_ID"'",
  "npwp":"00.000.000.0-000.000",
  "noFaktur":"'"$NF2"'",
  "masaPajak":10,
  "tahunPajak":2026,
  "namaRekanan":"Uji Rekanan S2",
  "namaJkp":"Jasa Uji S2 Kuitansi Bruto",
  "dpp":100000,
  "dppNilaiLain":91667,
  "tarifPpnPersen":11,
  "tarifPphPersen":3.5,
  "nilaiKuitansi":111000
}'

STATUS2=$(http "$TOKEN" POST "api/pendapatan/faktur" "$BODY2")
check "POST kuitansi bruto HTTP 201" "$STATUS2" "201"

NILAI_PROYEK2=$(mq "SELECT nilaiProyek FROM FakturPendapatan WHERE noFaktur='$NF2'")
check "nilaiProyek = nilaiKuitansi (111000)" "$NILAI_PROYEK2" "111000"

PPN2=$(mq "SELECT ppn FROM FakturPendapatan WHERE noFaktur='$NF2'")
# ppn = round(111000 × 11/111) = round(11000) = 11000
check "ppn = round(111000×11/111) = 11000" "$PPN2" "11000"

LABA2=$(mq "SELECT labaSetelahPajak FROM FakturPendapatan WHERE noFaktur='$NF2'")
# laba = round(dpp - pph) = round(100000 - 3500) = 96500
check "labaSetelahPajak = 96500 (dpp-pph, bukan nilaiKuitansi-ppn-pph)" "$LABA2" "96500"

# ── Skenario 3: DELETE faktur → Transaction.fakturId dilepas ──────────────────
echo ""
echo "── Skenario 3: DELETE faktur → Transaction.fakturId = NULL ──"

NF3="TEST-PDT-S3-$(date +%s)"
BODY3='{
  "entityId":"'"$ENTITY_ID"'",
  "npwp":"00.000.000.0-000.000",
  "noFaktur":"'"$NF3"'",
  "masaPajak":10,
  "tahunPajak":2026,
  "namaRekanan":"Uji Rekanan S3",
  "namaJkp":"Jasa Uji S3",
  "dpp":50000,
  "dppNilaiLain":45833,
  "tarifPpnPersen":11,
  "tarifPphPersen":3.5
}'
STATUS3=$(http "$TOKEN" POST "api/pendapatan/faktur" "$BODY3")
check "POST faktur S3 HTTP 201" "$STATUS3" "201"

FAKTUR_ID3=$(mqs "SELECT id FROM FakturPendapatan WHERE noFaktur='$NF3'")
check "FakturPendapatan tersimpan" "$([ -n '$FAKTUR_ID3' ] && echo yes || echo no)" "yes"

# Buat Transaction yang merujuk ke faktur ini langsung di DB (simulasi jurnal-transaksi)
TX_ID3=$(python3 -c "import uuid; print(str(uuid.uuid4()))")
BEBAN_COA="cmv08l3cg001m80jaglyb1zk0"
mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu -e "
  INSERT INTO \`Transaction\`
    (id, entityId, coaAccountId, noBukti, tanggal, debit, kredit, saldoSetelah,
     keterangan, fakturId, jenisInputId, staffId, createdAt)
  VALUES
    ('$TX_ID3', '$ENTITY_ID', '$BEBAN_COA', 'TEST-TX-S3', NOW(), 50000, 0, 50000,
     'Uji S3 linked tx', '$FAKTUR_ID3',
     (SELECT id FROM JenisInputTransaksi LIMIT 1),
     (SELECT id FROM User LIMIT 1),
     NOW())
" 2>/dev/null

TX_HAS_FAKTUR=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE id='$TX_ID3' AND fakturId IS NOT NULL")
check "Transaction.fakturId tersambung ke faktur" "$TX_HAS_FAKTUR" "1"

# DELETE faktur
STATUS_DEL=$(http "$TOKEN" DELETE "api/pendapatan/faktur/$FAKTUR_ID3" "")
check "DELETE faktur HTTP 200" "$STATUS_DEL" "200"

FAKTUR_GONE=$(mq "SELECT COUNT(*) FROM FakturPendapatan WHERE id='$FAKTUR_ID3'")
check "FakturPendapatan terhapus" "$FAKTUR_GONE" "0"

TX_FAKTUR_NULL=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE id='$TX_ID3' AND fakturId IS NULL")
check "Transaction.fakturId = NULL setelah DELETE faktur" "$TX_FAKTUR_NULL" "1"

# Cleanup S3 Transaction
mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu -e "
  DELETE FROM \`Transaction\` WHERE id='$TX_ID3';
" 2>/dev/null

# Cleanup S1 dan S2
http "$TOKEN" DELETE "api/pendapatan/faktur/$(mqs "SELECT id FROM FakturPendapatan WHERE noFaktur='$NF1'")" "" > /dev/null
http "$TOKEN" DELETE "api/pendapatan/faktur/$(mqs "SELECT id FROM FakturPendapatan WHERE noFaktur='$NF2'")" "" > /dev/null

echo ""
echo "═══════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════"
[ $FAIL -gt 0 ] && exit 1 || exit 0
