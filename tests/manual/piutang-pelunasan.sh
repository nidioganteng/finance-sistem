#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji manual: POST /api/piutang/pelunasan
# Jalankan SETELAH server PHP aktif: php -S localhost:8000 api/router.php
#
# Semua noBukti ber-prefiks TEST- agar mudah dibersihkan dengan cleanup.sh
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
PASS=0; FAIL=0

# ── Helper ────────────────────────────────────────────────────────────────────

# login <email> <password> → cetak token
login() {
  curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))"
}

# http_status <token> <method> <path> <body>
http_status() {
  curl -s -o /dev/null -w "%{http_code}" \
    -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d "$4"
}

# http_body <token> <method> <path> <body>
http_body() {
  curl -s \
    -X "$2" "$BASE/$3" \
    -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' \
    -d "$4"
}

# mysql_q <query> → hasil satu kolom satu baris, angka dibulatkan ke integer
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

echo "═══════════════════════════════════════════════════════"
echo " Uji POST /api/piutang/pelunasan"
echo "═══════════════════════════════════════════════════════"

# ── Login ─────────────────────────────────────────────────────────────────────
echo ""
echo "── Login sebagai manajer ──"
TOKEN=$(login "manajer@gaharusempana.com" "password123")
if [ -z "$TOKEN" ]; then
  echo "GAGAL: tidak bisa login. Pastikan server berjalan."
  exit 1
fi
echo "  Token diperoleh."

# ── Skenario 1: Pelunasan normal gaharu←tataring (kasKecil) ──────────────────
echo ""
echo "── Skenario 1: pelunasan normal gaharu←tataring (kasKecil) ──"

NB1="TEST-PLN-S1-$(date +%s)"
BODY1="{\"currentEntityKey\":\"gaharu\",\"counterpartyEntityKey\":\"tataring\",
        \"balanceType\":\"piutang\",\"tanggal\":\"2026-10-14\",\"noBukti\":\"$NB1\",
        \"keterangan\":\"Uji S1\",\"nominal\":5000000,\"jenisKasSumber\":\"kasKecil\"}"

STATUS1=$(http_status "$TOKEN" POST "api/piutang/pelunasan" "$BODY1")
check "HTTP status 201" "$STATUS1" "201"

# Hitung baris yang terbentuk
ROWS1=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE noBukti='$NB1'")
check "Tepat 4 baris terbentuk" "$ROWS1" "4"

# Verifikasi 4 COA yang benar
for COA in "113" "1200" "312" "1300"; do
  CNT=$(mq "SELECT COUNT(*) FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB1' AND c.code='$COA'")
  check "COA $COA ada" "$CNT" "1"
done

# Verifikasi arah debit/kredit
DR_113=$(mq  "SELECT debit  FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB1' AND c.code='113'")
KR_113=$(mq  "SELECT kredit FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB1' AND c.code='113'")
check "113 PIUTANG TB: debit=0"       "$DR_113" "0"
check "113 PIUTANG TB: kredit=5000000" "$KR_113" "5000000"

DR_1200=$(mq "SELECT debit  FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB1' AND c.code='1200'")
check "1200 Kas Kecil GS: debit=5000000" "$DR_1200" "5000000"

DR_312=$(mq  "SELECT debit  FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB1' AND c.code='312'")
check "312 Hutang GS: debit=5000000" "$DR_312" "5000000"

KR_1300=$(mq "SELECT kredit FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB1' AND c.code='1300'")
check "1300 Kas Kecil TB: kredit=5000000" "$KR_1300" "5000000"

# ── Skenario 2: Jenis kas tidak didukung → 422, tidak ada data setengah jadi ──
echo ""
echo "── Skenario 2: jenisKasSumber=bankBuku → 422, tidak ada data ──"

NB2="TEST-PLN-S2-$(date +%s)"
BODY2="{\"currentEntityKey\":\"gaharu\",\"counterpartyEntityKey\":\"tataring\",
        \"balanceType\":\"piutang\",\"tanggal\":\"2026-10-14\",\"noBukti\":\"$NB2\",
        \"keterangan\":\"Uji S2\",\"nominal\":1000000,\"jenisKasSumber\":\"bankBuku\"}"

STATUS2=$(http_status "$TOKEN" POST "api/piutang/pelunasan" "$BODY2")
check "HTTP status 422" "$STATUS2" "422"

ROWS2=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE noBukti='$NB2'")
check "0 baris di DB (tidak ada data setengah jadi)" "$ROWS2" "0"

# ── Skenario 3: noBukti sama dua kali → 409 di pengiriman kedua ──────────────
echo ""
echo "── Skenario 3: duplikat noBukti → 409 ──"

NB3="TEST-PLN-S3-$(date +%s)"
BODY3="{\"currentEntityKey\":\"gaharu\",\"counterpartyEntityKey\":\"tataring\",
        \"balanceType\":\"piutang\",\"tanggal\":\"2026-10-14\",\"noBukti\":\"$NB3\",
        \"keterangan\":\"Uji S3 pertama\",\"nominal\":2000000,\"jenisKasSumber\":\"kasKecil\"}"

STATUS3A=$(http_status "$TOKEN" POST "api/piutang/pelunasan" "$BODY3")
check "Kirim pertama: HTTP 201" "$STATUS3A" "201"

BODY3B="{\"currentEntityKey\":\"gaharu\",\"counterpartyEntityKey\":\"tataring\",
         \"balanceType\":\"piutang\",\"tanggal\":\"2026-10-14\",\"noBukti\":\"$NB3\",
         \"keterangan\":\"Uji S3 kedua\",\"nominal\":2000000,\"jenisKasSumber\":\"kasKecil\"}"

STATUS3B=$(http_status "$TOKEN" POST "api/piutang/pelunasan" "$BODY3B")
check "Kirim kedua: HTTP 409" "$STATUS3B" "409"

ROWS3=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE noBukti='$NB3'")
check "Hanya 4 baris (bukan 8)" "$ROWS3" "4"

# ── Skenario 4: kencana←gaharu (kasBesar), verifikasi COA Bug A ──────────────
echo ""
echo "── Skenario 4: kencana←gaharu (kasBesar), verifikasi kode COA ──"

NB4="TEST-PLN-S4-$(date +%s)"
BODY4="{\"currentEntityKey\":\"kencana\",\"counterpartyEntityKey\":\"gaharu\",
        \"balanceType\":\"piutang\",\"tanggal\":\"2026-10-14\",\"noBukti\":\"$NB4\",
        \"keterangan\":\"Uji S4 Bug A\",\"nominal\":3000000,\"jenisKasSumber\":\"kasBesar\"}"

STATUS4=$(http_status "$TOKEN" POST "api/piutang/pelunasan" "$BODY4")
check "HTTP status 201" "$STATUS4" "201"

ROWS4=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE noBukti='$NB4'")
check "Tepat 4 baris terbentuk" "$ROWS4" "4"

# COA yang benar setelah Bug A fix: kencana→112(PIUTANG GS), kencana→110(Kas KAK)
#                                    gaharu→311(Hutang KAK),  gaharu→120(Kas GS)
for COA in "112" "110" "311" "120"; do
  CNT=$(mq "SELECT COUNT(*) FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB4' AND c.code='$COA'")
  check "COA $COA ada" "$CNT" "1"
done

# Pastikan kode yang SALAH (Bug A) tidak ada
for WRONG in "111" "312"; do
  CNT=$(mq "SELECT COUNT(*) FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB4' AND c.code='$WRONG'")
  check "COA $WRONG TIDAK ada (Bug A sudah fix)" "$CNT" "0"
done

# Arah debit/kredit
DR_112=$(mq "SELECT debit  FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB4' AND c.code='112'")
KR_112=$(mq "SELECT kredit FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB4' AND c.code='112'")
check "112 PIUTANG GS: debit=0"       "$DR_112" "0"
check "112 PIUTANG GS: kredit=3000000" "$KR_112" "3000000"

DR_110=$(mq "SELECT debit FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB4' AND c.code='110'")
check "110 Kas KAK (kencana): debit=3000000" "$DR_110" "3000000"

DR_311=$(mq "SELECT debit FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB4' AND c.code='311'")
check "311 Hutang KAK (gaharu): debit=3000000" "$DR_311" "3000000"

KR_120=$(mq "SELECT kredit FROM \`Transaction\` t JOIN CoaAccount c ON t.coaAccountId=c.id WHERE t.noBukti='$NB4' AND c.code='120'")
check "120 Kas GS (gaharu): kredit=3000000" "$KR_120" "3000000"

# ── Ringkasan ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "noBukti yang terbentuk (hapus dengan cleanup.sh setelah selesai):"
echo "  $NB1  $NB3  $NB4"
[ $FAIL -gt 0 ] && exit 1 || exit 0
