#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji A3: PUT /api/pendapatan/faktur/:id — tarif PPN harus pakai nilai
# tersimpan di DB jika client tidak mengirim tarifPpnPersen.
#
#   S1: Faktur lama tarifPpn=11 → edit namaRekanan saja (tanpa tarif)
#       → ppn harus tetap dihitung pakai 11%, bukan tarif terbaru 12%
#   S2: Faktur baru tarifPpn=12 → ppn harus dihitung pakai 12%
#   S3: Edit eksplisit kirim tarifPpnPersen=11 → ppn pakai 11%
#
# Jalankan SETELAH server PHP aktif: php -S localhost:8000 api/router.php
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

mq() {
  mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
    --skip-column-names -e "$1" 2>/dev/null | awk '{printf "%d\n", $1}'
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

echo "═══════════════════════════════════════════════════════════"
echo " Uji A3: PUT faktur pakai tarif tersimpan, bukan tarif baru"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "── Login ──"
TOKEN=$(login "manajer@gaharusempana.com" "password123")
[ -z "$TOKEN" ] && echo "GAGAL login." && exit 1
echo "  Token diperoleh."

# ── Skenario 1: Faktur lama (tarifPpn=11) → edit namaRekanan, tarif tidak dikirim ──
echo ""
echo "── S1: Faktur tarifPpn=11 → PUT namaRekanan saja → ppn harus tetap pakai 11% ──"

NF1="TEST-A3-S1-$(date +%s)"
# dpp=200000, dppNilaiLain=180180, tarifPpn=11 → ppn = round(180180×11/100) = 19820
BODY_POST1=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "npwp": "00.000.000.0-000.000",
  "noFaktur": "$NF1",
  "masaPajak": 6,
  "tahunPajak": 2023,
  "namaRekanan": "Rekanan Lama",
  "namaJkp": "Jasa Konsultasi 2023",
  "dpp": 200000,
  "dppNilaiLain": 180180,
  "tarifPpnPersen": 11,
  "tarifPphPersen": 3.5
}
EOF
)

STATUS1=$(http_status "$TOKEN" POST "api/pendapatan/faktur" "$BODY_POST1")
check "POST faktur tarifPpn=11 HTTP 201" "$STATUS1" "201"

FAKTUR_ID1=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT id FROM FakturPendapatan WHERE noFaktur='$NF1';" 2>/dev/null)
PPN_AWAL=$(mq "SELECT ppn FROM FakturPendapatan WHERE id='$FAKTUR_ID1'")
# ppn = round(180180 × 11 / 100) = round(19819.8) = 19820
check "ppn awal = 19820 (tarif 11%)" "$PPN_AWAL" "19820"

# PUT: hanya ubah namaRekanan, tidak kirim tarifPpnPersen
BODY_PUT1=$(cat <<EOF
{
  "namaRekanan": "Rekanan Lama (diupdate)",
  "dpp": 200000,
  "dppNilaiLain": 180180
}
EOF
)

STATUS_PUT1=$(http_status "$TOKEN" PUT "api/pendapatan/faktur/$FAKTUR_ID1" "$BODY_PUT1")
check "PUT namaRekanan saja HTTP 200" "$STATUS_PUT1" "200"

PPN_SETELAH1=$(mq "SELECT ppn FROM FakturPendapatan WHERE id='$FAKTUR_ID1'")
NAMA_SETELAH1=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT namaRekanan FROM FakturPendapatan WHERE id='$FAKTUR_ID1';" 2>/dev/null)

check "ppn tetap 19820 setelah edit (tarif 11% tersimpan, bukan 12% terbaru)" "$PPN_SETELAH1" "19820"
check "namaRekanan berhasil diupdate" "$NAMA_SETELAH1" "Rekanan Lama (diupdate)"

TARIF_TERSIMPAN1=$(mq "SELECT tarifPpnPersen FROM FakturPendapatan WHERE id='$FAKTUR_ID1'")
check "tarifPpnPersen di DB masih 11" "$TARIF_TERSIMPAN1" "11"

# ── Skenario 2: Faktur baru (tarifPpn=12) → ppn harus 12% ──
echo ""
echo "── S2: Faktur baru tarifPpn=12 → ppn harus pakai 12% ──"

NF2="TEST-A3-S2-$(date +%s)"
# dpp=100000, dppNilaiLain=89286, tarifPpn=12 → ppn = round(89286×12/100) = 10714
BODY_POST2=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "npwp": "00.000.000.0-000.000",
  "noFaktur": "$NF2",
  "masaPajak": 3,
  "tahunPajak": 2026,
  "namaRekanan": "Rekanan Baru",
  "namaJkp": "Jasa Pengawasan 2026",
  "dpp": 100000,
  "dppNilaiLain": 89286,
  "tarifPpnPersen": 12,
  "tarifPphPersen": 3.5
}
EOF
)

STATUS2=$(http_status "$TOKEN" POST "api/pendapatan/faktur" "$BODY_POST2")
check "POST faktur tarifPpn=12 HTTP 201" "$STATUS2" "201"

FAKTUR_ID2=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT id FROM FakturPendapatan WHERE noFaktur='$NF2';" 2>/dev/null)
PPN2=$(mq "SELECT ppn FROM FakturPendapatan WHERE id='$FAKTUR_ID2'")
# ppn = round(89286 × 12 / 100) = round(10714.32) = 10714
check "ppn = 10714 (tarif 12%)" "$PPN2" "10714"

# ── Skenario 3: Edit eksplisit dengan tarifPpnPersen=11 → harus pakai 11% ──
echo ""
echo "── S3: PUT dengan tarifPpnPersen=11 eksplisit → ppn harus pakai 11% ──"

BODY_PUT3=$(cat <<EOF
{
  "dpp": 100000,
  "dppNilaiLain": 89286,
  "tarifPpnPersen": 11
}
EOF
)

STATUS_PUT3=$(http_status "$TOKEN" PUT "api/pendapatan/faktur/$FAKTUR_ID2" "$BODY_PUT3")
check "PUT dengan tarifPpn=11 eksplisit HTTP 200" "$STATUS_PUT3" "200"

PPN3=$(mq "SELECT ppn FROM FakturPendapatan WHERE id='$FAKTUR_ID2'")
# ppn = round(89286 × 11 / 100) = round(9821.46) = 9821
check "ppn = 9821 setelah edit eksplisit tarif 11%" "$PPN3" "9821"

TARIF3=$(mq "SELECT tarifPpnPersen FROM FakturPendapatan WHERE id='$FAKTUR_ID2'")
check "tarifPpnPersen tersimpan = 11 setelah edit" "$TARIF3" "11"

# ── Cleanup ──
echo ""
echo "── Cleanup ──"
for FID in "$FAKTUR_ID1" "$FAKTUR_ID2"; do
  [ -n "$FID" ] && http_status "$TOKEN" DELETE "api/pendapatan/faktur/$FID" "" > /dev/null
done
echo "  Faktur uji dihapus."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════════"
[ $FAIL -gt 0 ] && exit 1 || exit 0
