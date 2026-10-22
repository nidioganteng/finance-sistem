<?php
// Reuse the complete synthetic hold/release/reversal fixtures; never touches MySQL.
require __DIR__.'/kas-transitory.php';
$pdo->exec("ALTER TABLE Entity ADD COLUMN name TEXT; UPDATE Entity SET name='Fixture Entity'; ALTER TABLE HonorTenagaAhli ADD COLUMN tanggal TEXT; ALTER TABLE HonorTenagaAhli ADD COLUMN uraian TEXT;");
$method='TEST'; $segments=['piutang'];
try { require __DIR__.'/../api/routes/piutang.php'; } catch(TransitoryResponse $response) { /* Register the actual project aggregation helper. */ }
$result=compute_projects_expenses_and_breakdowns($pdo,[['id'=>'P','entityId'=>'A','contractValue'=>100000000]]);
eq((float)$result['P']['expensesSummary']['totalPengeluaran'],6006000.0,'detail proyek sama dengan dana diserahkan, termasuk migrasi reversal lama');
eq((float)$result['P']['expensesSummary']['totalPengeluaran'],sync_project_spend($pdo,'P'),'detail dan cache proyek konsisten');
echo "Detail pengeluaran proyek dan cache konsisten setelah hold, release, dan migrasi reversal.\n";
