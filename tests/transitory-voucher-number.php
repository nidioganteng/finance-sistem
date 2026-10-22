<?php
require __DIR__.'/kas-transitory.php';
$pdo->beginTransaction();
$first=transitory_voucher_number($pdo,'HOLD','number-test');
eq((bool)preg_match('/^KTH-[0-9]{6}$/D',$first),true,'nomor singkat dengan urutan database');
eq(transitory_voucher_number($pdo,'HOLD','number-test'),$first,'posting sama tetap nomor sama');
$second=transitory_voucher_number($pdo,'RELEASE','number-test');
eq($second!==$first,true,'pencairan mendapat nomor berbeda');
eq((bool)preg_match('/^KTL-[0-9]{6}$/D',$second),true,'prefix pencairan berbeda dari reversal');
$pdo->commit();
$before=$pdo->query('SELECT id,debit,kredit FROM `Transaction` ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
$sourceBefore=transitory_fingerprint(transitory_source($pdo,'cash')['rows']);
$pdo->beginTransaction();
$converted=transitory_shorten_vouchers($pdo);
eq($converted>0,true,'nomor legacy lama disingkat');
eq(transitory_shorten_vouchers($pdo),0,'penyesuaian berulang tidak mengganti nomor lagi');
$pdo->commit();
eq($pdo->query('SELECT id,debit,kredit FROM `Transaction` ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),$before,'primary key dan nominal transaksi tidak berubah');
eq(transitory_fingerprint(transitory_source($pdo,'cash')['rows']),$sourceBefore,'bukti sumber tetap utuh');
foreach($pdo->query('SELECT accountingNoBukti,reversalNoBukti FROM KasTransitoryEvent')->fetchAll(PDO::FETCH_ASSOC) as $event) {
    foreach($event as $nb) if($nb) {
        $s=$pdo->prepare('SELECT COUNT(*) FROM `Transaction` WHERE noBukti=?'); $s->execute([$nb]);
        eq((int)$s->fetchColumn()>0,true,'referensi event tetap menuju bukti yang benar');
    }
}
echo "Nomor bukti singkat, unik, idempotent, dan referensi riwayat lulus.\n";
