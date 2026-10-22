<?php
// Rekonsiliasi menampilkan satu beban bersih per bukti asal, bukan setiap
// posting HOLD/RELEASE sebagai pembayaran payroll baru. Buku besar tetap utuh.
require_once __DIR__.'/kas-transitory-accounting.php';

function payroll_journal_net_rows(PDO $pdo, array $rows, string $entity): array {
    $key = static fn(array $r, string $proof, string $date): string => json_encode([
        $r['entityId'], $proof, substr($date,0,10), $r['coaAccountId'], $r['projectId'] ?? null,
    ]);
    $holds=[]; $adjustments=[];
    if (transitory_posting_exists($pdo)) {
        $s=$pdo->prepare('SELECT id,sourceNoBukti,sourceDate FROM KasTransitory WHERE entityId=?');
        $s->execute([$entity]);
        foreach($s->fetchAll(PDO::FETCH_ASSOC) as $hold) $holds[$hold['id']]=$hold;
        if($holds) {
            $s=$pdo->prepare("SELECT entityId,noBukti,tanggal,coaAccountId,projectId,debit,kredit,extraFieldsJson FROM `Transaction` WHERE entityId=? AND (JSON_VALUE(extraFieldsJson,'$.transitoryAccounting') IS NOT NULL OR JSON_VALUE(extraFieldsJson,'$.transitoryReversalId') IS NOT NULL)");
            $s->execute([$entity]);
            foreach($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $extra=json_decode($r['extraFieldsJson']??'{}',true)?:[];
                if(!empty($extra['autoPostedFromJurnal'])) continue;
                $hold=$holds[$extra['transitoryId']??$extra['transitoryReversalId']??'']??null;
                if(!$hold) throw new RuntimeException('Referensi jurnal Kas Transitory tidak ditemukan.');
                $k=$key($r,$hold['sourceNoBukti'],$hold['sourceDate']);
                $adjustments[$k]=($adjustments[$k]??0)+(int)round(((float)$r['debit']-(float)$r['kredit'])*100);
            }
        }
    }
    $result=[]; $grouped=[];
    foreach($rows as $r) {
        $extra=json_decode($r['extraFieldsJson']??'{}',true)?:[];
        if(!empty($extra['autoPostedFromJurnal']) || !empty($extra['transitoryAccounting']) || !empty($extra['transitoryReversalId'])) continue;
        $k=$key($r,$r['noBukti'],$r['tanggal']);
        $net=(int)round(((float)$r['debit']-(float)$r['kredit'])*100);
        if(array_key_exists($k,$adjustments) && isset($grouped[$k])) {
            $result[$grouped[$k]]['expenseAmount'] += $net/100;
            continue;
        }
        $r['expenseAmount']=(float)(($net+($adjustments[$k]??0))/100);
        $r['hasTransitory']=array_key_exists($k,$adjustments);
        if($r['hasTransitory']) $grouped[$k]=count($result);
        $result[]=$r;
    }
    return $result;
}
