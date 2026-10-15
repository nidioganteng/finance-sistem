#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Migrasi kategori AsetTetap ke 4 kategori PSAK 16.
#
# Kategori lama → PSAK baru:
#   GEDUNG      → BANGUNAN
#   MESIN       → PERALATAN_KANTOR
#   INVENTARIS  → PERALATAN_KANTOR
#   LAINNYA     → PERALATAN_KANTOR
#   PERALATAN   → PERALATAN_KANTOR
#   (KENDARAAN tetap, TANAH sudah ada)
#
# Juga memaksa umurBulan=0 untuk aset berkategori TANAH (PSAK: tanah tidak disusutkan).
#
# PERINGATAN: Jalankan HANYA di DB dev (127.0.0.1:3307).
#             JANGAN jalankan di DB produksi.
# ─────────────────────────────────────────────────────────────────────────────

DB_HOST="127.0.0.1"
DB_PORT="3307"
DB_USER="root"
DB_PASS=""
DB_NAME="simatra_gaharu"

echo "═══════════════════════════════════════════════════════════"
echo " Migrasi AsetTetap: kategori lama → 4 kategori PSAK"
echo " Target: $DB_HOST:$DB_PORT/$DB_NAME"
echo "═══════════════════════════════════════════════════════════"
echo ""

MQ() {
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --password="$DB_PASS" "$DB_NAME" \
    --skip-column-names -e "$1" 2>/dev/null
}

# Cek berapa baris akan terpengaruh
echo "── Pratinjau perubahan ──"
COUNT_GEDUNG=$(MQ    "SELECT COUNT(*) FROM AsetTetap WHERE kategori='GEDUNG'")
COUNT_MESIN=$(MQ     "SELECT COUNT(*) FROM AsetTetap WHERE kategori='MESIN'")
COUNT_INVENTARIS=$(MQ "SELECT COUNT(*) FROM AsetTetap WHERE kategori='INVENTARIS'")
COUNT_LAINNYA=$(MQ   "SELECT COUNT(*) FROM AsetTetap WHERE kategori='LAINNYA'")
COUNT_PERALATAN=$(MQ "SELECT COUNT(*) FROM AsetTetap WHERE kategori='PERALATAN'")
COUNT_TANAH=$(MQ     "SELECT COUNT(*) FROM AsetTetap WHERE kategori='TANAH' AND umurBulan != 0")

echo "  GEDUNG     → BANGUNAN         : $COUNT_GEDUNG baris"
echo "  MESIN      → PERALATAN_KANTOR : $COUNT_MESIN baris"
echo "  INVENTARIS → PERALATAN_KANTOR : $COUNT_INVENTARIS baris"
echo "  LAINNYA    → PERALATAN_KANTOR : $COUNT_LAINNYA baris"
echo "  PERALATAN  → PERALATAN_KANTOR : $COUNT_PERALATAN baris"
echo "  TANAH umurBulan → 0           : $COUNT_TANAH baris"
echo ""

TOTAL=$((COUNT_GEDUNG + COUNT_MESIN + COUNT_INVENTARIS + COUNT_LAINNYA + COUNT_PERALATAN + COUNT_TANAH))
if [ "$TOTAL" -eq 0 ]; then
  echo "Tidak ada baris yang perlu dimigrasikan. Selesai."
  exit 0
fi

read -rp "Lanjutkan migrasi? (ketik 'ya' untuk konfirmasi): " KONFIRMASI
if [ "$KONFIRMASI" != "ya" ]; then
  echo "Dibatalkan."
  exit 0
fi

echo ""
echo "── Menjalankan migrasi ──"

MQ "UPDATE AsetTetap SET kategori='BANGUNAN'        WHERE kategori='GEDUNG'"
echo "  GEDUNG → BANGUNAN: $COUNT_GEDUNG baris"

MQ "UPDATE AsetTetap SET kategori='PERALATAN_KANTOR' WHERE kategori='MESIN'"
echo "  MESIN → PERALATAN_KANTOR: $COUNT_MESIN baris"

MQ "UPDATE AsetTetap SET kategori='PERALATAN_KANTOR' WHERE kategori='INVENTARIS'"
echo "  INVENTARIS → PERALATAN_KANTOR: $COUNT_INVENTARIS baris"

MQ "UPDATE AsetTetap SET kategori='PERALATAN_KANTOR' WHERE kategori='LAINNYA'"
echo "  LAINNYA → PERALATAN_KANTOR: $COUNT_LAINNYA baris"

MQ "UPDATE AsetTetap SET kategori='PERALATAN_KANTOR' WHERE kategori='PERALATAN'"
echo "  PERALATAN → PERALATAN_KANTOR: $COUNT_PERALATAN baris"

MQ "UPDATE AsetTetap SET umurBulan=0 WHERE kategori='TANAH' AND umurBulan != 0"
echo "  TANAH umurBulan → 0: $COUNT_TANAH baris"

echo ""
echo "── Verifikasi ──"
REMAINING=$(MQ "SELECT COUNT(*) FROM AsetTetap WHERE kategori NOT IN ('TANAH','BANGUNAN','KENDARAAN','PERALATAN_KANTOR')")
TANAH_BROKEN=$(MQ "SELECT COUNT(*) FROM AsetTetap WHERE kategori='TANAH' AND umurBulan != 0")
echo "  Kategori di luar PSAK: $REMAINING (harus 0)"
echo "  TANAH dengan umurBulan!=0: $TANAH_BROKEN (harus 0)"

if [ "$REMAINING" -eq 0 ] && [ "$TANAH_BROKEN" -eq 0 ]; then
  echo ""
  echo "Migrasi berhasil."
  exit 0
else
  echo ""
  echo "PERINGATAN: Ada kategori yang tidak termigrasi."
  exit 1
fi
