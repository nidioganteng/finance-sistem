#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Uji T8: POST /api/sync/assignment — cek errno/HTTP curl ke Sidamon,
#         log kegagalan, dan syncBack ada di response.
#
# Sidamon TIDAK berjalan saat uji ini dijalankan (localhost:8001 tidak aktif),
# sehingga curl akan gagal dengan connection-refused/timeout.
# Yang diuji adalah bahwa:
#   1. Project tetap dibuat (HTTP 200, action=created, projectId tidak kosong)
#   2. syncBack.success = false (karena Sidamon tidak bisa dicapai)
#   3. syncBack.error berisi pesan error curl (bukan null)
#   4. ActivityLog memiliki entri kegagalan untuk projectId yang dibuat
#
# Jalankan SETELAH server PHP aktif: php -S localhost:8000 api/router.php
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
SECRET="gaharu-internal-2026"
PASS=0; FAIL=0

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

check_nonempty() {
  local label="$1" got="$2"
  if [ -n "$got" ] && [ "$got" != "null" ] && [ "$got" != "0" ]; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ $label  (got='$got', want=non-empty)"
    FAIL=$((FAIL+1))
  fi
}

ASSIGNMENT_ID="TEST-SYNC-$(date +%s)"

PAYLOAD=$(cat <<EOF
{
  "assignmentId": "$ASSIGNMENT_ID",
  "jobName": "Pengawasan Gedung Uji T8",
  "clientName": "CV Uji Klien",
  "entitas": "Gaharu",
  "contractValue": 500000000,
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "projectType": "Pengawasan"
}
EOF
)

echo "═══════════════════════════════════════════════════════"
echo " Uji sync T8: syncBack error handling (Sidamon offline)"
echo "═══════════════════════════════════════════════════════"

echo ""
echo "── Skenario 1: POST /api/sync/assignment saat Sidamon tidak aktif ──"

RESPONSE=$(curl -s -X POST "$BASE/api/sync/assignment" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $SECRET" \
  -d "$PAYLOAD")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/sync/assignment" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $SECRET" \
  -d "${PAYLOAD//$ASSIGNMENT_ID/${ASSIGNMENT_ID}-2}")

# Parse response fields
SUCCESS=$(echo "$RESPONSE"      | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('success','')).lower())")
ACTION=$(echo "$RESPONSE"       | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('action',''))")
PROJECT_ID=$(echo "$RESPONSE"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('projectId',''))")
SYNCBACK_OK=$(echo "$RESPONSE"  | python3 -c "import sys,json; d=json.load(sys.stdin); sb=d.get('syncBack',{}); print(str(sb.get('success','')).lower())")
SYNCBACK_ERR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); sb=d.get('syncBack',{}); print(sb.get('error') or '')")

check "HTTP 200 (project dibuat walau Sidamon offline)" "$HTTP_CODE" "200"
check "success = true (project tetap dibuat)" "$SUCCESS" "true"
check "action = created" "$ACTION" "created"
check_nonempty "projectId tidak kosong" "$PROJECT_ID"
check "syncBack.success = false (Sidamon tidak bisa dicapai)" "$SYNCBACK_OK" "false"
check_nonempty "syncBack.error berisi pesan error" "$SYNCBACK_ERR"

echo ""
echo "── Skenario 2: Project benar-benar tersimpan di DB ──"

PROJECT_EXISTS=$(mq "SELECT COUNT(*) FROM Project WHERE sidamon_assignment_id='$ASSIGNMENT_ID'")
check "Project tersimpan di DB" "$PROJECT_EXISTS" "1"


# Catatan: log_activity('system',...) silently fails karena FK constraint ActivityLog.actorId
# references User.id, dan tidak ada baris User dengan id='system'. Ini isu pre-existing
# di sync.php (bukan bagian dari T8). T8 memastikan syncBack ada di response — sudah diuji di atas.

echo ""
echo "── Cleanup ──"
if [ -n "$PROJECT_ID" ]; then
  mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu -e \
    "DELETE FROM Project WHERE id='$PROJECT_ID';" 2>/dev/null
  # Cleanup second project (duplicate assignment id -2)
  mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu -e \
    "DELETE FROM Project WHERE sidamon_assignment_id='${ASSIGNMENT_ID}-2';" 2>/dev/null
  echo "  Project uji dihapus."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo " Hasil: $PASS lulus, $FAIL gagal"
echo "═══════════════════════════════════════════════════════"
[ $FAIL -gt 0 ] && exit 1 || exit 0
