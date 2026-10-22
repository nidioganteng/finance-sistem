<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__.'/kas-transitory-accounting.php';

function transitory_ensure(PDO $pdo): void {
    static $done = false;
    if (!$done) {
        $pdo->exec(file_get_contents(__DIR__.'/../../database/migrations/2026-10-22-kas-transitory.sql'));
        if($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql' && !$pdo->query("SHOW COLUMNS FROM KasTransitoryEvent LIKE 'eventOrder'")->fetch()) $pdo->exec('ALTER TABLE KasTransitoryEvent ADD COLUMN eventOrder INT NOT NULL DEFAULT 0');
        if($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql') {
            if(!$pdo->query("SHOW COLUMNS FROM KasTransitory LIKE 'accountingVersion'")->fetch()) $pdo->exec('ALTER TABLE KasTransitory ADD COLUMN accountingVersion INT NOT NULL DEFAULT 1');
            if(!$pdo->query("SHOW COLUMNS FROM KasTransitoryEvent LIKE 'accountingNoBukti'")->fetch()) $pdo->exec('ALTER TABLE KasTransitoryEvent ADD COLUMN accountingNoBukti VARCHAR(255) NULL');
        }
        transitory_ensure_account($pdo);
        transitory_ensure_voucher_sequence($pdo);
        $done = true;
    }
}
function transitory_today(): string { return (new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')))->format('Y-m-d'); }
function transitory_lock(PDO $pdo): string { return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''; }
function transitory_text($value, string $label, int $max = 1000): string {
    if (!is_string($value) || !trim($value) || strlen(trim($value)) > $max) throw new InvalidArgumentException("$label wajib diisi (maksimal $max karakter).");
    return trim($value);
}
function transitory_date($value): string {
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) throw new InvalidArgumentException('Tanggal tidak valid.');
    [$y,$m,$d] = array_map('intval',explode('-',$value));
    if ($y < 2000 || $y > 2199 || !checkdate($m,$d,$y)) throw new InvalidArgumentException('Tanggal tidak valid.');
    return $value;
}
function transitory_cents($value): int {
    if (!is_numeric($value) || !is_finite((float)$value) || (float)$value < 0 || (float)$value > 999999999999.99 || abs((float)$value*100-round((float)$value*100)) > 0.001) throw new InvalidArgumentException('Nominal harus rupiah nonnegatif dengan maksimal dua desimal.');
    return (int)round((float)$value*100);
}
function transitory_access(PDO $pdo, array $user, string $entity): void {
    if (!in_array($user['role']??'', ['SUPER_ADMIN','MANAJER_KEUANGAN','STAF_KEUANGAN'],true)) throw new RuntimeException('Akses Kas Transitory ditolak.',403);
    $stmt=$pdo->prepare('SELECT `key` FROM Entity WHERE id=?'); $stmt->execute([$entity]); $key=$stmt->fetchColumn();
    if (!$key) throw new RuntimeException('Entitas tidak ditemukan.',404);
    if (in_array($user['role'],['SUPER_ADMIN','MANAJER_KEUANGAN'],true)) return;
    $stmt=$pdo->prepare('SELECT 1 FROM UserEntityAccess WHERE userId=? AND entityId=?'); $stmt->execute([$user['id'],$entity]);
    if (!$stmt->fetchColumn()) throw new RuntimeException('Tidak memiliki akses entitas ini.',403);
}
function transitory_rows(PDO $pdo, array $source, bool $lock=false): array {
    $stmt=$pdo->prepare('SELECT * FROM `Transaction` WHERE entityId=? AND noBukti=? AND tanggal=? ORDER BY id'.($lock?transitory_lock($pdo):''));
    $stmt->execute([$source['entityId'],$source['noBukti'],$source['tanggal']]); return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
function transitory_fingerprint(array $rows): string {
    $normalized=[];
    foreach($rows as $row) $normalized[] = [$row['id'],$row['entityId'],$row['jenisInputId'],$row['noBukti'],$row['tanggal'],$row['coaAccountId'],(string)$row['debit'],(string)$row['kredit'],$row['projectId']??null,$row['extraFieldsJson']??null];
    return hash('sha256',json_encode($normalized,JSON_THROW_ON_ERROR));
}
function transitory_source(PDO $pdo, string $id, bool $lock=false): array {
    $stmt=$pdo->prepare('SELECT * FROM `Transaction` WHERE id=?'.($lock?transitory_lock($pdo):'')); $stmt->execute([$id]); $source=$stmt->fetch(PDO::FETCH_ASSOC);
    if (!$source) throw new InvalidArgumentException('Cash out asal tidak ditemukan.');
    $extra=json_decode($source['extraFieldsJson']??'{}',true)?:[];
    if (empty($source['coaAccountId']) || empty($extra['isKasEntry']) || (float)$source['kredit']<=0 || (float)$source['debit']!=0 || empty($source['noBukti']) || !empty($extra['transitoryReversalId'])) throw new InvalidArgumentException('Pilih baris cash out dari kas/bank.');
    $rows=transitory_rows($pdo,$source,$lock); $cashOut=0; $cashIn=0;
    foreach($rows as $r) {
        $e=json_decode($r['extraFieldsJson']??'{}',true)?:[];
        if (!empty($e['crossingGroupId']) || !empty($e['isCrossingEntry']) || !empty($r['fakturId']) || !empty($e['syncFromKasKecil'])) throw new InvalidArgumentException('Bukti crossing, faktur, atau pemindahbukuan tidak dapat dipakai sebagai dana ditahan. Gunakan bukti pembayaran penerima.');
        if (!empty($e['isKasEntry'])) { if ((float)$r['kredit']>0) $cashOut++; if ((float)$r['debit']>0) $cashIn++; }
    }
    $groups=[]; foreach($rows as $r) $groups[$r['jenisInputId']]=($groups[$r['jenisInputId']]??0)+(float)$r['debit']-(float)$r['kredit'];
    foreach($groups as $balance) if(abs($balance)>0.005) throw new InvalidArgumentException('Bukti cash out belum seimbang.');
    if ($cashOut!==1 || $cashIn) throw new InvalidArgumentException('Bukti harus memiliki tepat satu cash out dan bukan transfer internal.');
    $source['rows']=$rows; return $source;
}
function transitory_events(PDO $pdo,string $id): array {
    $s=$pdo->prepare('SELECT * FROM KasTransitoryEvent WHERE transitoryId=? ORDER BY eventOrder,id'); $s->execute([$id]);
    $events=$s->fetchAll(PDO::FETCH_ASSOC); foreach($events as &$e) $e['amount']=(float)$e['amount']; return $events;
}
function transitory_totals(array $row,array $events,string $today): array {
    $released=0; $reversed=0;
    foreach($events as $e) { if($e['kind']==='RELEASE') $released+=transitory_cents($e['amount']); else $reversed+=transitory_cents($e['amount']); }
    $remaining=transitory_cents($row['amount'])-$released-$reversed;
    return ['released'=>$released/100,'reversed'=>$reversed/100,'remaining'=>$remaining/100,'status'=>$remaining>0?($row['targetDate']<$today?'OVERDUE':'HELD'):($reversed>0?'REVERSED':'RELEASED')];
}
function transitory_allocated(PDO $pdo,string $source): int {
    $s=$pdo->prepare('SELECT id,amount FROM KasTransitory WHERE sourceTransactionId=?'.($pdo->inTransaction()?transitory_lock($pdo):'')); $s->execute([$source]); $total=0;
    foreach($s->fetchAll(PDO::FETCH_ASSOC) as $row) $total+=transitory_cents($row['amount']);
    return $total;
}
function transitory_create(PDO $pdo,array $user,array $body): string {
    if(!$pdo->inTransaction()) throw new LogicException('Transaksi wajib aktif.');
    $source=transitory_source($pdo,transitory_text($body['sourceTransactionId']??null,'Cash out asal',191),true);
    transitory_access($pdo,$user,$source['entityId']);
    $s=$pdo->prepare('SELECT * FROM KasTransitory WHERE id=?'); $s->execute([$body['requestId']??'']);
    if($existing=$s->fetch(PDO::FETCH_ASSOC)) {
        foreach(['sourceTransactionId','category','recipient','location','reason','targetDate','payrollType','payrollId'] as $field) if(($existing[$field]??'')!==trim((string)($body[$field]??''))) throw new RuntimeException('ID permintaan sudah digunakan dengan isi berbeda.',409);
        if(transitory_cents($existing['amount'])!==transitory_cents($body['amount']??null)) throw new RuntimeException('ID permintaan sudah digunakan dengan nominal berbeda.',409);
        return $existing['id'];
    }
    $amount=transitory_cents($body['amount']??null);
    if($amount<=0 || transitory_allocated($pdo,$source['id'])+$amount>transitory_cents($source['kredit'])) throw new InvalidArgumentException('Nominal ditahan melebihi sisa cash out yang belum dialokasikan.');
    $category=$body['category']??'';
    if(!in_array($category,['GAJI_HOLD','MARKETING','UANG_MUKA_PROYEK','OPERASIONAL_TERTUNDA'],true)) throw new InvalidArgumentException('Kategori dana tidak valid.');
    $target=transitory_date($body['targetDate']??null);
    if($target<substr($source['tanggal'],0,10)) throw new InvalidArgumentException('Target penyerahan tidak boleh sebelum cash out.');
    $payrollType=null; $payrollId=null;
    if(!empty($body['payrollId'])) {
        $payrollType=$body['payrollType']??'';
        $table=$payrollType==='HONOR'?'HonorTenagaAhli':($payrollType==='PEGAWAI'?'GajiPegawaiBulanan':null);
        if(!$table || $category!=='GAJI_HOLD') throw new InvalidArgumentException('Tautan payroll tidak valid.');
        $s=$pdo->prepare("SELECT * FROM `$table` WHERE id=? AND entityId=?".transitory_lock($pdo)); $s->execute([$body['payrollId'],$source['entityId']]); $payroll=$s->fetch(PDO::FETCH_ASSOC);
        if(!$payroll) throw new InvalidArgumentException('Gaji tidak ditemukan pada entitas cash out.');
        $payrollId=$payroll['id']; $limit=transitory_cents($payroll[$payrollType==='HONOR'?'nominalHonor':'totalGajiBersih']);
        $s=$pdo->prepare('SELECT * FROM KasTransitory WHERE payrollType=? AND payrollId=?'.($pdo->inTransaction()?transitory_lock($pdo):'')); $s->execute([$payrollType,$payrollId]); $used=0;
        foreach($s->fetchAll() as $r) { $used+=transitory_cents($r['amount']); foreach(transitory_events($pdo,$r['id']) as $e) if($e['kind']==='REVERSAL') $used-=transitory_cents($e['amount']); }
        if($used+$amount>$limit) throw new InvalidArgumentException('Total hold melebihi gaji yang diterima pada payroll terkait.');
    }
    $id=transitory_text($body['requestId']??null,'ID permintaan',36);
    if(!preg_match('/^[a-f0-9-]{36}$/D',$id)) throw new InvalidArgumentException('ID permintaan tidak valid.');
    $pdo->prepare('INSERT INTO KasTransitory (id,entityId,sourceTransactionId,sourceNoBukti,sourceDate,sourceSnapshot,projectId,category,recipient,amount,location,reason,targetDate,payrollType,payrollId,createdBy,accountingVersion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([
        $id,$source['entityId'],$source['id'],$source['noBukti'],substr($source['tanggal'],0,10),json_encode(['hash'=>transitory_fingerprint($source['rows']),'rows'=>$source['rows']],JSON_THROW_ON_ERROR),$source['projectId'],$category,
        transitory_text($body['recipient']??null,'Penerima',255),$amount/100,transitory_text($body['location']??null,'Posisi fisik uang',500),transitory_text($body['reason']??null,'Alasan penahanan'),$target,$payrollType,$payrollId,$user['id'],2]);
    $s=$pdo->prepare('SELECT * FROM KasTransitory WHERE id=?'); $s->execute([$id]);
    transitory_post($pdo,$s->fetch(PDO::FETCH_ASSOC),$source,$amount,'HOLD',$user['id'],$id);
    return $id;
}

// Dipanggil sebelum edit/hapus bukti kas/jurnal; tidak membuat tabel pada route lama.
function transitory_guard_transactions(PDO $pdo,array $ids): void {
    if(!$ids) return;
    if($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql' && !$pdo->query("SHOW TABLES LIKE 'KasTransitory'")->fetchColumn()) return;
    $ph=implode(',',array_fill(0,count($ids),'?'));
    if($pdo->inTransaction()) { $lock=$pdo->prepare("SELECT id FROM `Transaction` WHERE id IN ($ph) ORDER BY id".transitory_lock($pdo)); $lock->execute(array_values($ids)); $lock->fetchAll(); }
    $s=$pdo->prepare("SELECT t.extraFieldsJson FROM `Transaction` t WHERE t.id IN ($ph)"); $s->execute(array_values($ids));
    foreach($s->fetchAll(PDO::FETCH_COLUMN) as $json) if(!empty((json_decode($json??'{}',true)?:[])['transitoryReversalId']) || !empty((json_decode($json??'{}',true)?:[])['transitoryAccounting'])) throw new RuntimeException('Bukti reversal transitory tidak boleh diubah atau dihapus.',409);
    $s=$pdo->prepare("SELECT k.id FROM KasTransitory k JOIN `Transaction` src ON src.id=k.sourceTransactionId JOIN `Transaction` t ON t.entityId=src.entityId AND t.noBukti=src.noBukti AND t.tanggal=src.tanggal WHERE t.id IN ($ph) LIMIT 1".($pdo->inTransaction()?transitory_lock($pdo):'')); $s->execute(array_values($ids));
    if($s->fetchColumn()) throw new RuntimeException('Bukti sudah terhubung ke Kas Transitory dan dikunci untuk menjaga riwayat. Gunakan Release atau Reversal di Kas Transitory.',409);
}

function transitory_scaled_legs(array $rows,float $ratio): array {
    $debits=array_sum(array_map(fn($r)=>transitory_cents($r['debit']),$rows));
    $credits=array_sum(array_map(fn($r)=>transitory_cents($r['kredit']),$rows));
    if($debits!==$credits) throw new InvalidArgumentException('Bukti asal tidak seimbang.');
    $target=(int)round($debits*$ratio); $legs=[];
    foreach($rows as $r) $legs[]=['row'=>$r,'debit'=>0,'credit'=>0];
    foreach(['debit'=>'kredit','credit'=>'debit'] as $side=>$original) {
        $fractions=[]; $sum=0;
        foreach($rows as $i=>$r) { $raw=transitory_cents($r[$original])*$ratio; $whole=(int)floor($raw+0.0000001); $legs[$i][$side]=$whole; $sum+=$whole; $fractions[]=['index'=>$i,'fraction'=>$raw-$whole]; }
        usort($fractions,fn($a,$b)=>($b['fraction']<=>$a['fraction'])?:($a['index']<=>$b['index']));
        for($i=0;$i<$target-$sum;$i++) $legs[$fractions[$i]['index']][$side]++;
    }
    return $legs;
}
function transitory_reversal(PDO $pdo,array $row,array $source,int $cents,string $date,string $actor,string $eventId): string {
    $ratio=$cents/transitory_cents($source['kredit']); $groups=[];
    foreach($source['rows'] as $r) $groups[$r['jenisInputId']][]=$r;
    $nb='KTR-'.str_replace('-','',$eventId); $now=date('Y-m-d H:i:s');
    foreach($groups as $rows) {
        $legs=transitory_scaled_legs($rows,$ratio);
        foreach($legs as $leg) {
            $r=$leg['row']; $e=json_decode($r['extraFieldsJson']??'{}',true)?:[];
            $e['transitoryReversalId']=$row['id']; $e['originalTransactionId']=$r['id'];
            $pdo->prepare('INSERT INTO `Transaction` (id,entityId,jenisInputId,tanggal,noBukti,keterangan,coaAccountId,debit,kredit,saldoSetelah,extraFieldsJson,staffId,projectId,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([
                uuid4(),$r['entityId'],$r['jenisInputId'],$date.' 00:00:00',$nb,'Reversal Kas Transitory: '.$row['recipient'].' / '.$row['sourceNoBukti'],$r['coaAccountId'],$leg['debit']/100,$leg['credit']/100,0,json_encode($e),$actor,$r['projectId'],$now]);
        }
    }
    return $nb;
}
function transitory_record_event(PDO $pdo,array $user,string $id,string $kind,array $body): string {
    if(!$pdo->inTransaction()) throw new LogicException('Transaksi wajib aktif.');
    $s=$pdo->prepare('SELECT * FROM KasTransitory WHERE id=?'.transitory_lock($pdo)); $s->execute([$id]); $row=$s->fetch(PDO::FETCH_ASSOC);
    if(!$row) throw new RuntimeException('Dana ditahan tidak ditemukan.',404);
    transitory_access($pdo,$user,$row['entityId']);
    if((int)($row['accountingVersion']??1)!==2) throw new RuntimeException('Data lama memerlukan migrasi pencatatan Kas Transitory sebelum diproses.',409);
    if($kind==='REVERSAL' && !in_array($user['role'],['SUPER_ADMIN','MANAJER_KEUANGAN'],true)) throw new RuntimeException('Reversal hanya untuk manajer keuangan atau admin.',403);
    if(!in_array($kind,['RELEASE','REVERSAL'],true)) throw new InvalidArgumentException('Aksi tidak valid.');
    $request=transitory_text($body['requestId']??null,'ID permintaan',64);
    $s=$pdo->prepare('SELECT * FROM KasTransitoryEvent WHERE requestId=?'); $s->execute([$request]);
    if($existing=$s->fetch(PDO::FETCH_ASSOC)) {
        if($existing['transitoryId']!==$id || $existing['kind']!==$kind || transitory_cents($existing['amount'])!==transitory_cents($body['amount']??null) || $existing['eventDate']!==($body['eventDate']??null) || $existing['receipt']!==trim($body['receipt']??'') || $existing['note']!==trim($body['note']??'')) throw new RuntimeException('ID permintaan sudah digunakan dengan isi berbeda.',409);
        return $existing['id'];
    }
    if((int)($body['revision']??0)!==(int)$row['revision']) throw new RuntimeException('Data berubah. Muat ulang sebelum melanjutkan.',409);
    $summary=transitory_totals($row,transitory_events($pdo,$id),transitory_today());
    $cents=transitory_cents($body['amount']??null);
    if($cents<=0 || $cents>transitory_cents($summary['remaining'])) throw new InvalidArgumentException('Nominal pencairan/reversal melebihi saldo ditahan.');
    $date=transitory_date($body['eventDate']??null);
    if($date<$row['sourceDate'] || $date>transitory_today()) throw new InvalidArgumentException('Tanggal penyerahan tidak boleh sebelum cash out atau di masa depan.');
    transitory_check_payroll($pdo,$row);
    $source=transitory_source($pdo,$row['sourceTransactionId'],true); $snapshot=json_decode($row['sourceSnapshot'],true,512,JSON_THROW_ON_ERROR);
    if(transitory_fingerprint($source['rows'])!==$snapshot['hash']) throw new RuntimeException('Unbalanced: bukti asal berubah. Periksa sumber sebelum pencairan/reversal.',409);
    $receipt=transitory_text($body['receipt']??null,'Nomor bukti / tanda terima',255); $note=transitory_text($body['note']??null,$kind==='REVERSAL'?'Alasan dan persetujuan pembatalan':'Catatan penyerahan');
    $eventId=uuid4(); $nb=transitory_post($pdo,$row,$source,$cents,$kind,$user['id'],$eventId);
    $pdo->prepare('INSERT INTO KasTransitoryEvent (id,transitoryId,kind,eventOrder,amount,eventDate,receipt,note,reversalNoBukti,accountingNoBukti,requestId,actorId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$eventId,$id,$kind,(int)$row['revision'],$cents/100,$date,$receipt,$note,$kind==='REVERSAL'?$nb:null,$nb,$request,$user['id']]);
    $pdo->prepare('UPDATE KasTransitory SET revision=revision+1 WHERE id=?')->execute([$id]);
    if($kind==='REVERSAL' && $row['projectId']) sync_project_spend($pdo,$row['projectId']);
    return $eventId;
}

function transitory_assert_unlinked(PDO $pdo,array $ids): void {
    try { transitory_guard_transactions($pdo,$ids); }
    catch(RuntimeException $e) { error_response($e->getMessage(),409); }
}

function transitory_guard_reference(PDO $pdo,string $entity,string $noBukti): void {
    $s=$pdo->prepare('SELECT id FROM `Transaction` WHERE entityId=? AND noBukti=?'); $s->execute([$entity,$noBukti]);
    transitory_assert_unlinked($pdo,$s->fetchAll(PDO::FETCH_COLUMN));
}
function transitory_check_payroll(PDO $pdo,array $row): void {
    if(empty($row['payrollId'])) return;
    $table=$row['payrollType']==='HONOR'?'HonorTenagaAhli':'GajiPegawaiBulanan';
    $p=$pdo->prepare("SELECT * FROM `$table` WHERE id=? AND entityId=?".($pdo->inTransaction()?transitory_lock($pdo):'')); $p->execute([$row['payrollId'],$row['entityId']]); $payroll=$p->fetch(PDO::FETCH_ASSOC);
    $q=$pdo->prepare('SELECT * FROM KasTransitory WHERE payrollType=? AND payrollId=?'.($pdo->inTransaction()?transitory_lock($pdo):'')); $q->execute([$row['payrollType'],$row['payrollId']]); $allocated=0;
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $related) { $allocated+=transitory_cents($related['amount']); foreach(transitory_events($pdo,$related['id']) as $event) if($event['kind']==='REVERSAL') $allocated-=transitory_cents($event['amount']); }
    if(!$payroll || $allocated>transitory_cents($payroll[$row['payrollType']==='HONOR'?'nominalHonor':'totalGajiBersih'])) throw new RuntimeException('Unbalanced: payroll terkait hilang atau nominalnya kurang dari alokasi hold.',409);
}
