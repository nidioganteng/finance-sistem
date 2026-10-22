<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

const TRANSITORY_COA_ID = 'system-kas-transitory';
const TRANSITORY_COA_CODE = '159-TR';

function transitory_ensure_voucher_sequence(PDO $pdo): void {
    $id=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY':'INTEGER PRIMARY KEY AUTOINCREMENT';
    $pdo->exec("CREATE TABLE IF NOT EXISTS KasTransitoryVoucher (id $id, postingKey VARCHAR(191) NOT NULL UNIQUE)");
}

function transitory_voucher_number(PDO $pdo,string $phase,string $key): string {
    $prefix=['HOLD'=>'KTH','RELEASE'=>'KTL','REVERSAL'=>'KTR','LEGACY_COMPENSATION'=>'KTC'][$phase]??null;
    if(!$prefix || !$pdo->inTransaction()) throw new LogicException('Nomor bukti wajib dialokasikan dalam transaksi.');
    $postingKey=$phase.':'.$key;
    $s=$pdo->prepare('SELECT id FROM KasTransitoryVoucher WHERE postingKey=?'); $s->execute([$postingKey]);
    $id=$s->fetchColumn();
    if($id===false) {
        $pdo->prepare('INSERT INTO KasTransitoryVoucher (postingKey) VALUES (?)')->execute([$postingKey]);
        $id=$pdo->lastInsertId();
    }
    return $prefix.'-'.str_pad((string)$id,6,'0',STR_PAD_LEFT);
}

function transitory_shorten_vouchers(PDO $pdo): int {
    if(!$pdo->inTransaction()) throw new LogicException('Penyesuaian nomor wajib dalam transaksi.');
    $rows=$pdo->query("SELECT id,entityId,noBukti,extraFieldsJson FROM `Transaction` WHERE JSON_VALUE(extraFieldsJson,'$.transitoryAccounting') IS NOT NULL OR JSON_VALUE(extraFieldsJson,'$.transitoryReversalId') IS NOT NULL ORDER BY tanggal,noBukti,id".transitory_lock($pdo))->fetchAll(PDO::FETCH_ASSOC);
    $groups=[];
    foreach($rows as $r) {
        if(preg_match('/^KT[HLRC]-[0-9]+$/D',$r['noBukti'])) continue;
        $key=json_encode([$r['entityId'],$r['noBukti']]);
        $groups[$key][]=$r;
    }
    foreach($groups as $rows) {
        $first=$rows[0]; $extra=json_decode($first['extraFieldsJson'],true)?:[];
        $phase=$extra['transitoryPhase']??'REVERSAL';
        $nb=transitory_voucher_number($pdo,$phase,'legacy-'.hash('sha256',json_encode([$first['entityId'],$first['noBukti']])));
        $s=$pdo->prepare('UPDATE `Transaction` SET noBukti=? WHERE id=?');
        foreach($rows as $r) $s->execute([$nb,$r['id']]);
        foreach(['accountingNoBukti','reversalNoBukti'] as $field) {
            $s=$pdo->prepare("UPDATE KasTransitoryEvent SET $field=? WHERE $field=? AND transitoryId IN (SELECT id FROM KasTransitory WHERE entityId=?)");
            $s->execute([$nb,$first['noBukti'],$first['entityId']]);
        }
    }
    return count($groups);
}

function transitory_ensure_account(PDO $pdo): void {
    $stmt=$pdo->prepare('SELECT id,code,kategori,reportType,report_category FROM CoaAccount WHERE id=? OR code=?');
    $stmt->execute([TRANSITORY_COA_ID,TRANSITORY_COA_CODE]); $rows=$stmt->fetchAll(PDO::FETCH_ASSOC);
    if($rows) {
        if(count($rows)!==1 || $rows[0]['id']!==TRANSITORY_COA_ID || $rows[0]['code']!==TRANSITORY_COA_CODE || $rows[0]['kategori']!=='ASET' || $rows[0]['reportType']!=='ARUS_KAS' || $rows[0]['report_category']!=='SEMUA') throw new RuntimeException('Konfigurasi akun Kas Transitory tidak sesuai. Periksa akun sistem 159-TR.');
        return;
    }
    $pdo->prepare('INSERT INTO CoaAccount (id,code,name,kategori,reportType,report_category,urutan,createdAt) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')->execute([TRANSITORY_COA_ID,TRANSITORY_COA_CODE,'Kas Transitory (Dana Ditahan)','ASET','ARUS_KAS','SEMUA',159]);
}
function transitory_posting_exists(PDO $pdo): bool {
    if($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql') return (bool)$pdo->query("SHOW TABLES LIKE 'KasTransitory'")->fetchColumn();
    return (bool)$pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='KasTransitory'")->fetchColumn();
}
function transitory_guard_coa(array $ids): void {
    if(in_array(TRANSITORY_COA_ID,$ids,true)) throw new RuntimeException('Akun Kas Transitory hanya dapat digunakan melalui modul Kas Transitory; dana ditahan bukan sumber biaya operasional.',409);
}

// Posting terhubung ke bukti asal; tanggal pembukuan selalu tanggal cash out awal.
function transitory_post(PDO $pdo,array $hold,array $source,int $amount,string $phase,string $actor,string $eventId): string {
    if(!$pdo->inTransaction()) throw new LogicException('Posting transitory wajib dalam transaksi.');
    $kind=get_or_create_jurnal_transaksi_jenis($pdo);
    $nb=transitory_voucher_number($pdo,$phase,$eventId);
    $extra=['transitoryAccounting'=>true,'transitoryId'=>$hold['id'],'transitoryPhase'=>$phase,'sourceTransactionId'=>$source['id'],'sourceNoBukti'=>$source['noBukti'],'accountingDate'=>$hold['sourceDate']];
    if($phase!=='RELEASE') $extra['transitoryInternalTransfer']=true;
    $legs=[];
    if($phase==='HOLD' || $phase==='RELEASE') {
        $originals=array_values(array_filter($source['rows'],fn($r)=>empty((json_decode($r['extraFieldsJson']??'{}',true)?:[])['autoPostedFromJurnal'])));
        $scaled=transitory_scaled_legs($originals,$amount/transitory_cents($source['kredit']));
        foreach($scaled as $leg) {
            $r=$leg['row'];
            if($r['coaAccountId']===$source['coaAccountId']) continue;
            if($leg['debit']===0 && $leg['credit']===0) continue;
            $legs[]=['coa'=>$r['coaAccountId'],'debit'=>$phase==='HOLD'?$leg['debit']:$leg['credit'],'credit'=>$phase==='HOLD'?$leg['credit']:$leg['debit'],'project'=>$r['projectId']??null];
        }
        $legs[]=['coa'=>TRANSITORY_COA_ID,'debit'=>$phase==='HOLD'?$amount:0,'credit'=>$phase==='RELEASE'?$amount:0,'project'=>$hold['projectId']];
    } else {
        $legs[]=['coa'=>$source['coaAccountId'],'debit'=>$amount,'credit'=>0,'project'=>$hold['projectId']];
        $legs[]=['coa'=>TRANSITORY_COA_ID,'debit'=>0,'credit'=>$amount,'project'=>$hold['projectId']];
    }
    if(array_sum(array_column($legs,'debit'))!==array_sum(array_column($legs,'credit'))) throw new RuntimeException('Posting Kas Transitory tidak seimbang.');
    $insert=$pdo->prepare('INSERT INTO `Transaction` (id,entityId,jenisInputId,tanggal,noBukti,keterangan,coaAccountId,debit,kredit,saldoSetelah,extraFieldsJson,staffId,projectId,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    foreach($legs as $leg) $insert->execute([uuid4(),$hold['entityId'],$kind,$hold['sourceDate'].' 00:00:00',$nb,"Kas Transitory $phase: ".$hold['recipient'].' / '.$hold['sourceNoBukti'],$leg['coa'],$leg['debit']/100,$leg['credit']/100,0,json_encode($extra),$actor,$leg['project'],date('Y-m-d H:i:s')]);
    // Reversal adalah pemindahan kembali dari kas ditahan ke kas utama, bukan pendapatan.
    if($phase==='REVERSAL') {
        $e=json_decode($source['extraFieldsJson']??'{}',true)?:[];
        $e=array_merge($e,$extra,['isKasEntry'=>true,'autoPostedFromJurnal'=>true]);
        $insert->execute([uuid4(),$hold['entityId'],$source['jenisInputId'],$hold['sourceDate'].' 00:00:00',$nb,'Pengembalian Kas Transitory: '.$hold['recipient'],$source['coaAccountId'],$amount/100,0,0,json_encode($e),$actor,$hold['projectId'],date('Y-m-d H:i:s')]);
        $e['isKasEntry']=false;
        $insert->execute([uuid4(),$hold['entityId'],$source['jenisInputId'],$hold['sourceDate'].' 00:00:00',$nb,'Pengembalian Kas Transitory: '.$hold['recipient'],TRANSITORY_COA_ID,0,$amount/100,0,json_encode($e),$actor,$hold['projectId'],date('Y-m-d H:i:s')]);
    }
    foreach(array_unique(array_filter(array_column($source['rows'],'projectId'))) as $project) sync_project_spend($pdo,$project);
    return $nb;
}

// Arus kas bruto mengabaikan pemindahan internal; pengeluaran diakui oleh posting RELEASE.
function transitory_cash_sql(PDO $pdo,string $side,string $alias='t'): string {
    if(!in_array($side,['debit','kredit'],true) || !preg_match('/^[a-zA-Z]+$/D',$alias)) throw new LogicException('Ekspresi kas tidak valid.');
    if(!transitory_posting_exists($pdo)) return "$alias.$side";
    $internal="COALESCE(JSON_VALUE($alias.extraFieldsJson, '$.transitoryInternalTransfer'),'') IN ('true','1') OR JSON_VALUE($alias.extraFieldsJson, '$.transitoryReversalId') IS NOT NULL";
    if($side==='debit') return "CASE WHEN $internal THEN 0 ELSE $alias.debit END";
    $allocation="COALESCE((SELECT SUM(k.amount) FROM KasTransitory k JOIN `Transaction` src ON src.id=k.sourceTransactionId WHERE k.accountingVersion=2 AND src.entityId=$alias.entityId AND src.noBukti=$alias.noBukti AND src.tanggal=$alias.tanggal AND src.coaAccountId=$alias.coaAccountId),0)";
    return "CASE WHEN $internal THEN 0 ELSE $alias.kredit - CASE WHEN $alias.kredit>0 THEN $allocation ELSE 0 END END";
}

function transitory_cash_summary(PDO $pdo,array $entities,string $until): array {
    $result=['held'=>0.0,'ledgerHeld'=>0.0,'balanced'=>true];
    if(!$entities || !transitory_posting_exists($pdo)) return $result;
    $ph=implode(',',array_fill(0,count($entities),'?'));
    $s=$pdo->prepare("SELECT k.* FROM KasTransitory k WHERE k.entityId IN ($ph) AND k.sourceDate<=?"); $s->execute(array_merge($entities,[$until]));
    foreach($s->fetchAll(PDO::FETCH_ASSOC) as $row) $result['held']+=transitory_totals($row,transitory_events($pdo,$row['id']),$until)['remaining'];
    $s=$pdo->prepare("SELECT COALESCE(SUM(debit-kredit),0) FROM `Transaction` WHERE entityId IN ($ph) AND coaAccountId=? AND tanggal<=? AND (extraFieldsJson IS NULL OR COALESCE(JSON_VALUE(extraFieldsJson,'$.autoPostedFromJurnal'),'') NOT IN ('true','1'))"); $s->execute(array_merge($entities,[TRANSITORY_COA_ID,$until.' 23:59:59']));
    $result['ledgerHeld']=(float)$s->fetchColumn(); $result['balanced']=abs($result['held']-$result['ledgerHeld'])<0.01;
    return $result;
}

function transitory_company_cash(PDO $pdo,string $entity,int $year,string $version='INTERNAL'): array {
    $cat=$version==='UMUM'?"c.report_category IN ('UMUM','SEMUA')":"c.report_category IN ('INTERNAL','SEMUA')";
    $s=$pdo->prepare("SELECT c.id FROM CoaAccount c WHERE c.kategori='ASET' AND c.id<>? AND $cat AND (c.reportType='ARUS_KAS' OR LOWER(c.name) LIKE '%kas%' OR LOWER(c.name) LIKE '%bank%' OR LOWER(c.name) LIKE '%bri%' OR LOWER(c.name) LIKE '%bpd%' OR LOWER(c.name) LIKE '%bni%' OR LOWER(c.name) LIKE '%mdr%')");
    $s->execute([TRANSITORY_COA_ID]); $ids=$s->fetchAll(PDO::FETCH_COLUMN); $available=0.0; $opening=0.0;
    if($ids) {
        $ph=implode(',',array_fill(0,count($ids),'?'));
        $s=$pdo->prepare("SELECT COALESCE(SUM(nominal),0) FROM SaldoAwal WHERE entityId=? AND year=? AND coaAccountId IN ($ph)"); $s->execute(array_merge([$entity,$year],$ids)); $available=(float)$s->fetchColumn(); $opening=$available;
        $s=$pdo->prepare("SELECT COALESCE(SUM(debit-kredit),0) FROM `Transaction` WHERE entityId=? AND tanggal BETWEEN ? AND ? AND coaAccountId IN ($ph) AND (extraFieldsJson IS NULL OR COALESCE(JSON_VALUE(extraFieldsJson,'$.autoPostedFromJurnal'),'') NOT IN ('true','1'))");
        $s->execute(array_merge([$entity,"$year-01-01 00:00:00","$year-12-31 23:59:59"],$ids)); $available+=(float)$s->fetchColumn();
    }
    $held=transitory_cash_summary($pdo,[$entity],"$year-12-31");
    $previous=transitory_cash_summary($pdo,[$entity],($year-1).'-12-31');
    return ['kasTersedia'=>$available,'kasDitahan'=>$held['ledgerHeld'],'kasTotal'=>$available+$held['ledgerHeld'],'kasAwal'=>$opening+$previous['ledgerHeld'],'kasTransitoryBalanced'=>$held['balanced']];
}

function transitory_asset_line(array $lines,float $balance): array {
    $lines=array_values(array_filter($lines,fn($r)=>($r['code']??'')!==TRANSITORY_COA_CODE));
    if(abs($balance)>=0.005) $lines[]=['id'=>TRANSITORY_COA_ID,'code'=>TRANSITORY_COA_CODE,'name'=>'Kas Transitory (Dana Ditahan)','kategori'=>'ASET','saldo'=>$balance,'isContra'=>false];
    return $lines;
}

function transitory_migrate_accounting(PDO $pdo,string $id): void {
    if(!$pdo->inTransaction()) throw new LogicException('Migrasi wajib dalam transaksi.');
    $s=$pdo->prepare('SELECT * FROM KasTransitory WHERE id=?'.transitory_lock($pdo)); $s->execute([$id]); $hold=$s->fetch(PDO::FETCH_ASSOC);
    if(!$hold || (int)$hold['accountingVersion']===2) return;
    $source=transitory_source($pdo,$hold['sourceTransactionId'],true); $snapshot=json_decode($hold['sourceSnapshot'],true,512,JSON_THROW_ON_ERROR);
    if(transitory_fingerprint($source['rows'])!==$snapshot['hash']) throw new RuntimeException('Bukti asal berubah; migrasi dibatalkan untuk menjaga riwayat.');
    $pdo->prepare('UPDATE KasTransitory SET accountingVersion=2,revision=revision+1 WHERE id=?')->execute([$id]);
    transitory_post($pdo,$hold,$source,transitory_cents($hold['amount']),'HOLD',$hold['createdBy'],$id);
    foreach(transitory_events($pdo,$id) as $event) {
        if($event['kind']==='REVERSAL' && $event['reversalNoBukti']) {
            $s=$pdo->prepare('SELECT * FROM `Transaction` WHERE entityId=? AND noBukti=? ORDER BY id'.transitory_lock($pdo)); $s->execute([$hold['entityId'],$event['reversalNoBukti']]); $old=$s->fetchAll(PDO::FETCH_ASSOC);
            if(!$old) throw new RuntimeException('Bukti reversal lama tidak ditemukan; migrasi dibatalkan.');
            $insert=$pdo->prepare('INSERT INTO `Transaction` (id,entityId,jenisInputId,tanggal,noBukti,keterangan,coaAccountId,debit,kredit,saldoSetelah,extraFieldsJson,staffId,projectId,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $compensationNb=transitory_voucher_number($pdo,'LEGACY_COMPENSATION',$event['id']);
            foreach($old as $r) {
                $e=json_decode($r['extraFieldsJson']??'{}',true)?:[];
                $e=array_merge($e,['transitoryAccounting'=>true,'transitoryId'=>$id,'transitoryInternalTransfer'=>true,'transitoryPhase'=>'LEGACY_COMPENSATION']);
                $insert->execute([uuid4(),$r['entityId'],$r['jenisInputId'],$r['tanggal'],$compensationNb,'Koreksi alur transitory lama / '.$event['reversalNoBukti'],$r['coaAccountId'],$r['kredit'],$r['debit'],0,json_encode($e),$event['actorId'],$r['projectId'],date('Y-m-d H:i:s')]);
            }
        }
        $nb=transitory_post($pdo,$hold,$source,transitory_cents($event['amount']),$event['kind'],$event['actorId'],$event['id']);
        $pdo->prepare('UPDATE KasTransitoryEvent SET accountingNoBukti=? WHERE id=?')->execute([$nb,$event['id']]);
    }
}
