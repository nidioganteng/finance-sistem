<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__.'/../helpers/kas-transitory.php';
require_once __DIR__.'/../helpers/kas-helpers.php';
$user=require_auth(); $pdo=get_pdo();
if(!in_array($user['role']??'', ['SUPER_ADMIN','MANAJER_KEUANGAN','STAF_KEUANGAN'],true)) return error_response('Akses Kas Transitory ditolak.',403);
transitory_ensure($pdo);
try {
    if($method==='GET') {
        $entity=transitory_text($_GET['entityId']??null,'Entitas',191); transitory_access($pdo,$user,$entity);
        $s=$pdo->prepare('SELECT k.*,p.code AS projectCode,p.name AS projectName FROM KasTransitory k LEFT JOIN Project p ON p.id=k.projectId WHERE k.entityId=? ORDER BY k.createdAt DESC,k.id'); $s->execute([$entity]);
        $items=[]; $held=0; $released=0; $reversed=0; $overdue=0; $unbalanced=0;
        foreach($s->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $events=transitory_events($pdo,$row['id']); $summary=transitory_totals($row,$events,transitory_today()); $snapshot=json_decode($row['sourceSnapshot'],true);
            $ok=false; $issue='';
            try {
                $source=transitory_source($pdo,$row['sourceTransactionId']);
                $ok=transitory_fingerprint($source['rows'])===($snapshot['hash']??'') && transitory_allocated($pdo,$source['id'])<=transitory_cents($source['kredit']);
                if(!$ok) $issue='Nominal atau rincian bukti cash out berubah.';
            } catch(Throwable $e) { $issue=$e->getMessage(); }
            if($summary['remaining']<0) { $ok=false; $issue='Saldo ditahan negatif.'; }
            try { transitory_check_payroll($pdo,$row); } catch(RuntimeException $e) { $ok=false; $issue=$e->getMessage(); }
            $held+=$summary['remaining']; $released+=$summary['released']; $reversed+=$summary['reversed'];
            if($summary['status']==='OVERDUE') $overdue++; if(!$ok) $unbalanced++;
            unset($row['sourceSnapshot']); $row['amount']=(float)$row['amount']; $row['revision']=(int)$row['revision'];
            $items[]=array_merge($row,$summary,['balanced'=>$ok,'balanceIssue'=>$issue,'events'=>$events]);
        }
        // Hanya kas entry: baris jurnal/mirror tidak menggandakan pilihan sumber.
        $s=$pdo->prepare('SELECT t.*,p.code AS projectCode,p.name AS projectName FROM `Transaction` t LEFT JOIN Project p ON p.id=t.projectId WHERE t.entityId=? AND t.kredit>0 ORDER BY t.tanggal DESC,t.id'); $s->execute([$entity]); $sources=[];
        foreach($s->fetchAll(PDO::FETCH_ASSOC) as $candidate) {
            $extra=json_decode($candidate['extraFieldsJson']??'{}',true)?:[];
            if(empty($extra['isKasEntry']) || !empty($extra['transitoryReversalId'])) continue;
            try { $source=transitory_source($pdo,$candidate['id']); } catch(InvalidArgumentException $e) { continue; }
            $available=transitory_cents($source['kredit'])-transitory_allocated($pdo,$source['id']);
            if($available<=0) continue;
            $sources[]=['id'=>$source['id'],'noBukti'=>$source['noBukti'],'date'=>substr($source['tanggal'],0,10),'description'=>$source['keterangan'],'amount'=>(float)$source['kredit'],'available'=>$available/100,'projectCode'=>$candidate['projectCode'],'projectName'=>$candidate['projectName']];
        }
        $payroll=[];
        $s=$pdo->prepare('SELECT id,nama,bulan,tahun,nominalHonor FROM HonorTenagaAhli WHERE entityId=? ORDER BY tahun DESC,bulan DESC,nama'); $s->execute([$entity]);
        foreach($s->fetchAll() as $r) $payroll[]=['id'=>$r['id'],'type'=>'HONOR','name'=>$r['nama'],'month'=>(int)$r['bulan'],'year'=>(int)$r['tahun'],'amount'=>(float)$r['nominalHonor']];
        $s=$pdo->prepare('SELECT g.id,p.nama,g.bulan,g.tahun,g.totalGajiBersih FROM GajiPegawaiBulanan g JOIN Pegawai p ON p.id=g.pegawaiId WHERE g.entityId=? ORDER BY g.tahun DESC,g.bulan DESC,p.nama'); $s->execute([$entity]);
        foreach($s->fetchAll() as $r) $payroll[]=['id'=>$r['id'],'type'=>'PEGAWAI','name'=>$r['nama'],'month'=>(int)$r['bulan'],'year'=>(int)$r['tahun'],'amount'=>(float)$r['totalGajiBersih']];
        return json_response(['today'=>transitory_today(),'items'=>$items,'sources'=>$sources,'payroll'=>$payroll,'summary'=>['held'=>$held,'released'=>$released,'reversed'=>$reversed,'overdue'=>$overdue,'unbalanced'=>$unbalanced]]);
    }
    if($method==='POST') {
        $action=$segments[2]??''; $id=$segments[1]??'';
        $pdo->beginTransaction();
        try {
            if(!$id) { $result=transitory_create($pdo,$user,$body); $label='Hold Kas Transitory'; }
            elseif(in_array($action,['release','reversal'],true)) { $result=transitory_record_event($pdo,$user,$id,strtoupper($action),$body); $label=$action==='release'?'Release Kas Transitory':'Reversal Kas Transitory'; }
            else throw new RuntimeException('Endpoint tidak ditemukan.',404);
            $pdo->commit();
        } catch(Throwable $e) { if($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        log_activity($user['id'],$label,'FINANCIAL_CHANGE',['id'=>$result,'transitoryId'=>$id?:$result]);
        return json_response(['success'=>true,'id'=>$result]);
    }
    return error_response('Endpoint tidak ditemukan.',404);
} catch(InvalidArgumentException $e) { return error_response($e->getMessage(),422); }
catch(PDOException $e) {
    if((string)$e->getCode()==='40001' || in_array((int)($e->errorInfo[1]??0),[1205,1213],true)) return error_response('Data sedang diproses pengguna lain. Muat ulang lalu ulangi penyimpanan.',409);
    throw $e;
}
catch(RuntimeException $e) { $code=(int)$e->getCode(); if(!in_array($code,[403,404,409],true)) throw $e; return error_response($e->getMessage(),$code); }
