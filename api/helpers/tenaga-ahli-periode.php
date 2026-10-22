<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// Ubah hanya bulan kosong saat tanggal master berubah. Pembayaran/catatan dan
// bulan tambahan di luar referensi lama tetap disimpan.
function tenaga_ahli_jadwal_masa_tugas(array $contract,string $start,string $end): ?string {
    $json=$contract['jadwalJson']??null;
    if($json===null) return null;
    $oldStart=substr($contract['spmkMulai']??'',0,7);
    $oldEnd=substr($contract['spmkSelesai']??'',0,7);
    if(!$oldStart || !$oldEnd) return $json;
    if(($contract['spmkMulai']??null)===$start && ($contract['spmkSelesai']??null)===$end) return $json;
    $from=substr($start,0,7); $to=substr($end,0,7); $rows=[];
    foreach(json_decode($json,true,512,JSON_THROW_ON_ERROR) as $row) {
        $month=$row['bulan'];
        $extension=$oldStart && $oldEnd && ($month<$oldStart || $month>$oldEnd);
        if(($month>=$from && $month<=$to) || $extension || ($row['nominal']??null)!==null || trim($row['catatan']??'')!=='' || !empty($row['pph21'])) $rows[$month]=$row;
    }
    $cursor=new DateTimeImmutable($from.'-01'); $last=new DateTimeImmutable($to.'-01'); $count=0;
    while($cursor<=$last) {
        if(++$count>600) throw new InvalidArgumentException('Masa tugas maksimal 600 bulan.');
        $month=$cursor->format('Y-m');
        // Bulan yang sengaja dihapus di dalam masa lama tidak dibuat ulang.
        if((!$oldStart || !$oldEnd || $month<$oldStart || $month>$oldEnd) && !isset($rows[$month])) $rows[$month]=['bulan'=>$month,'nominal'=>null,'pph21'=>null,'catatan'=>''];
        $cursor=$cursor->modify('+1 month');
    }
    ksort($rows);
    return json_encode(array_values($rows),JSON_THROW_ON_ERROR);
}
