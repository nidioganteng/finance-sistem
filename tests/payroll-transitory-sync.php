<?php
require __DIR__.'/kas-transitory.php';
require __DIR__.'/../api/helpers/payroll-journal.php';
function payroll_fixture_rows(PDO $pdo): array {
    return payroll_journal_net_rows($pdo,$pdo->query("SELECT t.* FROM `Transaction` t JOIN CoaAccount c ON c.id=t.coaAccountId WHERE t.entityId='A' AND c.kategori='BEBAN' ORDER BY t.tanggal,t.id")->fetchAll(PDO::FETCH_ASSOC),'A');
}
$rows=payroll_fixture_rows($pdo);
eq(array_sum(array_column($rows,'expenseAmount')),6006000.0,'payroll sama dengan beban bersih GL, bukan total debit');
eq(count($rows),4,'satu baris per bukti asal, tanpa duplikat hold/release/reversal/mirror');
$byProof=array_column($rows,null,'noBukti');
eq($byProof['OUT-1']['expenseAmount'],6000000.0,'pencairan parsial diakui sekali');
eq($byProof['OUT-2']['expenseAmount'],0.0,'pembatalan penuh tanpa beban');
eq($byProof['OUT-3']['expenseAmount'],6000.0,'reversal lama beserta kompensasi tidak menggandakan beban');
eq($byProof['OUT-4']['expenseAmount'],0.0,'dana masih ditahan tidak menjadi beban');
eq(substr($byProof['OUT-1']['tanggal'],0,10),'2001-01-01','tanggal beban mengikuti bukti awal, bukan tanggal penyerahan');

// Kasus screenshot: satu juta masuk hold, dicairkan penuh, tetap satu juta.
$insert->execute(['sync-cash','A','kas','2001-01-02 00:00:00','SYNC-1','Gaji','bank',0,1000000,0,'{"isKasEntry":true}','staff','P','2001-01-02']);
$insert->execute(['sync-cost','A','kas','2001-01-02 00:00:00','SYNC-1','Gaji','cost',1000000,0,0,'{"periodeBulanGaji":12,"periodeTahunGaji":2000}','staff','P','2001-01-02']);
$syncBody=array_merge($body,['sourceTransactionId'=>'sync-cash','amount'=>1000000,'payrollId'=>null,'payrollType'=>null,'requestId'=>uuid4()]);
$syncId=atomic(fn()=>transitory_create($pdo,$admin,$syncBody));
eq(array_column(payroll_fixture_rows($pdo),null,'noBukti')['SYNC-1']['expenseAmount'],0.0,'hold penuh menghapus beban sementara');
$releaseBody=['amount'=>1000000,'eventDate'=>'2001-02-01','receipt'=>'SYNC-R','note'=>'Diserahkan','revision'=>1,'requestId'=>uuid4()];
atomic(fn()=>transitory_record_event($pdo,$admin,$syncId,'RELEASE',$releaseBody));
$sync=array_column(payroll_fixture_rows($pdo),null,'noBukti')['SYNC-1'];
eq($sync['expenseAmount'],1000000.0,'release penuh satu juta bukan dua juta');
eq(json_decode($sync['extraFieldsJson'],true)['periodeTahunGaji'],2000,'rekap tetap mewarisi periode akrual bukti asal');
eq($sync['hasTransitory'],true,'UI diberi penanda penyesuaian transitory');
// Query periode asal tidak menyertakan posting sistem pada tahun berikutnya.
$original=$pdo->query("SELECT * FROM `Transaction` WHERE id='sync-cost'")->fetchAll(PDO::FETCH_ASSOC);
eq(payroll_journal_net_rows($pdo,$original,'A')[0]['expenseAmount'],1000000.0,'pencairan tetap tersinkron saat query hanya mengambil periode akrual asal');
echo "Rekonsiliasi payroll: beban bersih, satu bukti, penahanan, pencairan, pembatalan, dan periode asal lulus.\n";
