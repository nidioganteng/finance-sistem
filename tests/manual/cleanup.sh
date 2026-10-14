#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Hapus semua data uji ber-prefiks TEST- dari tabel Transaction.
# JANGAN jalankan tanpa persetujuan. Hanya menghapus noBukti = 'TEST-%'.
# ─────────────────────────────────────────────────────────────────────────────

echo "Akan menghapus Transaction dengan noBukti LIKE 'TEST-%' dari simatra_gaharu."
echo "Ketik 'ya' untuk lanjut:"
read -r confirm
if [ "$confirm" != "ya" ]; then
  echo "Dibatalkan."
  exit 0
fi

COUNT=$(mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  --skip-column-names -e "SELECT COUNT(*) FROM \`Transaction\` WHERE noBukti LIKE 'TEST-%';" 2>/dev/null)
echo "Jumlah baris yang akan dihapus: $COUNT"

mysql -h 127.0.0.1 -P 3307 -u root --password= simatra_gaharu \
  -e "DELETE FROM \`Transaction\` WHERE noBukti LIKE 'TEST-%';" 2>/dev/null

echo "Selesai."
