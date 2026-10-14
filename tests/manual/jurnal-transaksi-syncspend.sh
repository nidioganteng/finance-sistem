#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji sync_project_spend via POST & DELETE /api/jurnal-transaksi
# Jalankan SETELAH server PHP aktif: php -S localhost:8000 api/router.php
#
# Semua noBukti ber-prefiks TEST- agar mudah dibersihkan dengan cleanup.sh
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
PASS=0; FAIL=0

login() {
  curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))"
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

# Konstanta
PROJECT_ID="c831dbaa-4ab5-4815-818a-7f58edacd735"
BEBAN_COA_ID="cmv08l3cg001m80jaglyb1zk0"   # code 511 Gaji, kategori BEBAN
KAS_COA_ID="cmv08l3c2000f80jajp68zwpf"      # code 120 Kas GS

echo "═══════════════════════════════════════════════════════"
echo " Uji sync_project_spend via jurnal-transaksi"
echo "═══════════════════════════════════════════════════════"

echo ""
echo "── Login ──"
TOKEN=$(login "manajer@gaharusempana.com" "password123")
if [ -z "$TOKEN" ]; then
  echo "GAGAL: tidak bisa login."
  exit 1
fi
echo "  Token diperoleh."

# Catat spend awal
SPEND_AWAL=$(mq "SELECT COALESCE(spend,0) FROM Project WHERE id='$PROJECT_ID'")
echo ""
echo "  Project.spend awal: $SPEND_AWAL"

# ── Skenario 1: POST jurnal dengan BEBAN + KAS → spend harus bertambah ────────
echo ""
echo "── Skenario 1: POST jurnal beban 5.000.000 ke proyek ──"

NB1="TEST-JTS-S1-$(date +%s)"
ROWS='[{"coaAccountId":"'$BEBAN_COA_ID'","debit":5000000,"kredit":0,"keterangan":"Uji beban S1"},{"coaAccountId":"'$KAS_COA_ID'","debit":0,"kredit":5000000,"keterangan":"Uji beban S1"}]'
BODY1='{"entityKey":"gaharu","tanggal":"2026-10-14","noBukti":"'$NB1'","keterangan":"Uji S1","projectId":"'$PROJECT_ID'","rows":'"$ROWS"'}'

STATUS1=$(http_status "$TOKEN" POST "api/jurnal-transaksi" "$BODY1")
check "HTTP status 200" "$STATUS1" "200"

SPEND_SESUDAH=$(mq "SELECT COALESCE(spend,0) FROM Project WHERE id='$PROJECT_ID'")
echo "  Project.spend sesudah POST: $SPEND_SESUDAH"

TX_COUNT=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE noBukti='$NB1'")
check "Ada baris transaksi tersimpan" "$([ $TX_COUNT -gt 0 ] && echo yes || echo no)" "yes"

# Ambil txIds untuk delete
TX_IDS=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT id FROM \`Transaction\` WHERE noBukti='$NB1'" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
TX_IDS_JSON=$(echo "$TX_IDS" | python3 -c "import sys; ids=sys.stdin.read().strip().split(','); print('[\"'+'\",\"'.join(ids)+'\"]')" 2>/dev/null)

# ── Skenario 2: DELETE jurnal → spend harus berkurang 5000000 ─────────────────
echo ""
echo "── Skenario 2: DELETE jurnal → spend berkurang 5000000 ──"

BODY2='{"txIds":'"$TX_IDS_JSON"'}'
STATUS2=$(http_status "$TOKEN" DELETE "api/jurnal-transaksi" "$BODY2")
check "DELETE HTTP status 200" "$STATUS2" "200"

SPEND_SETELAH_DEL=$(mq "SELECT COALESCE(spend,0) FROM Project WHERE id='$PROJECT_ID'")
echo "  Project.spend setelah DELETE: $SPEND_SETELAH_DEL"

# Selisih (POST - DELETE) harus tepat 5000000 — baris BEBAN 5M di-hapus dari spend
SELISIH_DELTA=$((SPEND_SESUDAH - SPEND_SETELAH_DEL))
check "Delta spend (POST→DELETE) = 5000000" "$SELISIH_DELTA" "5000000"

TX_COUNT_AFTER=$(mq "SELECT COUNT(*) FROM \`Transaction\` WHERE noBukti='$NB1'")
check "Semua baris transaksi terhapus" "$TX_COUNT_AFTER" "0"

# ── Ringkasan ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════"
[ $FAIL -gt 0 ] && exit 1 || exit 0
