<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$auth_user = require_auth();
$sub = $segments[1] ?? null; // 'chart' | 'chart-by-year' | null

// GET /api/dashboard/chart?entityKeys[]=...&year=2024&version=INTERNAL
// Returns 12 MonthRow objects: [{ month: 'Jan', gaharu: 1000, kencana: 2000 }, ...]
if ($method === 'GET' && $sub === 'chart') {
    $entityKeysRaw = $_GET['entityKeys'] ?? [];
    if (is_string($entityKeysRaw)) $entityKeysRaw = [$entityKeysRaw];
    $entityKeys = array_values(array_filter(array_map('trim', (array)$entityKeysRaw)));
    $year    = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $version = $_GET['version'] ?? 'INTERNAL';

    if (empty($entityKeys)) error_response('entityKeys wajib diisi.', 400);

    $reportCatFilter = $version === 'UMUM'
        ? "c.report_category IN ('UMUM','SEMUA')"
        : "c.report_category IN ('INTERNAL','SEMUA')";

    $pdo = get_pdo();
    $keyPlaceholders = implode(',', array_fill(0, count($entityKeys), '?'));

    $stmt = $pdo->prepare(
        "SELECT e.`key` AS entityKey, MONTH(t.tanggal) AS bulan,
                SUM(t.kredit) AS pendapatan
         FROM Transaction t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         JOIN Entity e ON t.entityId = e.id
         WHERE e.`key` IN ($keyPlaceholders)
           AND YEAR(t.tanggal) = ?
           AND c.kategori = 'PENDAPATAN'
           AND $reportCatFilter
         GROUP BY e.`key`, MONTH(t.tanggal)"
    );
    $stmt->execute(array_merge($entityKeys, [$year]));
    $raw = $stmt->fetchAll();

    // Build entity-key → month-index map
    $byEntityMonth = [];
    foreach ($raw as $row) {
        $byEntityMonth[$row['entityKey']][(int)$row['bulan']] = (float)$row['pendapatan'];
    }

    // Month names
    $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

    // Pivot to 12 MonthRow objects
    $result = [];
    for ($m = 1; $m <= 12; $m++) {
        $row = ['month' => $monthNames[$m - 1]];
        foreach ($entityKeys as $key) {
            $row[$key] = $byEntityMonth[$key][$m] ?? 0;
        }
        $result[] = $row;
    }

    json_response($result);
}

// GET /api/dashboard/chart-by-year?entityIds[]=...&years[]=2023&years[]=2024&version=INTERNAL
// Returns 12 MonthRow objects: [{ month: 'Jan', '2023': 1000, '2024': 2000 }, ...]
if ($method === 'GET' && $sub === 'chart-by-year') {
    $entityIdsRaw = $_GET['entityIds'] ?? [];
    if (is_string($entityIdsRaw)) $entityIdsRaw = [$entityIdsRaw];
    $entityIds = array_values(array_filter(array_map('trim', (array)$entityIdsRaw)));

    $yearsRaw = $_GET['years'] ?? [];
    if (is_string($yearsRaw)) $yearsRaw = [$yearsRaw];
    $years = array_values(array_filter(array_map('intval', (array)$yearsRaw)));

    $version = $_GET['version'] ?? 'INTERNAL';

    if (empty($entityIds) || empty($years)) error_response('entityIds and years wajib diisi.', 400);

    $reportCatFilter = $version === 'UMUM'
        ? "c.report_category IN ('UMUM','SEMUA')"
        : "c.report_category IN ('INTERNAL','SEMUA')";

    $pdo = get_pdo();
    $idPlaceholders  = implode(',', array_fill(0, count($entityIds), '?'));
    $yearPlaceholders = implode(',', array_fill(0, count($years), '?'));

    $stmt = $pdo->prepare(
        "SELECT YEAR(t.tanggal) AS tahun, MONTH(t.tanggal) AS bulan,
                SUM(t.kredit) AS pendapatan
         FROM Transaction t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($idPlaceholders)
           AND YEAR(t.tanggal) IN ($yearPlaceholders)
           AND c.kategori = 'PENDAPATAN'
           AND $reportCatFilter
         GROUP BY YEAR(t.tanggal), MONTH(t.tanggal)"
    );
    $stmt->execute(array_merge($entityIds, $years));
    $raw = $stmt->fetchAll();

    // Build year → month map
    $byYearMonth = [];
    foreach ($raw as $row) {
        $byYearMonth[(int)$row['tahun']][(int)$row['bulan']] = (float)$row['pendapatan'];
    }

    $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    $result = [];
    for ($m = 1; $m <= 12; $m++) {
        $row = ['month' => $monthNames[$m - 1]];
        foreach ($years as $y) {
            $row[(string)$y] = $byYearMonth[$y][$m] ?? 0;
        }
        $result[] = $row;
    }

    json_response($result);
}

// GET /api/dashboard?entityKeys[]=gaharu&entityKeys[]=kencana&year=2024&version=INTERNAL
if ($method === 'GET' && !$sub) {
    $entityKeysRaw = $_GET['entityKeys'] ?? [];
    if (is_string($entityKeysRaw)) {
        $entityKeysRaw = [$entityKeysRaw];
    }
    $entityKeys = array_values(array_filter(array_map('trim', (array)$entityKeysRaw)));

    $year    = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $version = $_GET['version'] ?? 'INTERNAL'; // INTERNAL | UMUM

    if (empty($entityKeys)) {
        error_response('entityKeys wajib diisi.', 400);
    }

    $pdo = get_pdo();

    // Ambil entity records
    $inPlaceholders = implode(',', array_fill(0, count($entityKeys), '?'));
    $stmtEnt = $pdo->prepare(
        "SELECT id, `key`, name, legalName, colorHex, isUmum
         FROM Entity
         WHERE `key` IN ($inPlaceholders)"
    );
    $stmtEnt->execute($entityKeys);
    $entities = $stmtEnt->fetchAll();

    if (empty($entities)) {
        error_response('Tidak ada entity yang ditemukan.', 404);
    }

    // Build map key => id
    $entityIdByKey = [];
    foreach ($entities as $e) {
        $entityIdByKey[$e['key']] = $e['id'];
    }
    $entityIds = array_values($entityIdByKey);

    $idPlaceholders = implode(',', array_fill(0, count($entityIds), '?'));

    // Tentukan filter reportCategory berdasarkan versi
    $reportCatFilter = $version === 'UMUM'
        ? "c.report_category IN ('UMUM','SEMUA')"
        : "c.report_category IN ('INTERNAL','SEMUA')";

    $dateStart = "{$year}-01-01";
    $dateEnd   = "{$year}-12-31 23:59:59";

    // Revenue & beban per entity (1 query)
    $params = array_merge($entityIds, [$dateStart, $dateEnd]);
    $stmtRB = $pdo->prepare(
        "SELECT t.entityId,
                SUM(CASE WHEN c.kategori = 'PENDAPATAN' THEN t.kredit - t.debit ELSE 0 END) AS revenue,
                SUM(CASE WHEN c.kategori = 'BEBAN'      THEN t.debit - t.kredit ELSE 0 END) AS beban
         FROM Transaction t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($idPlaceholders)
           AND t.tanggal >= ? AND t.tanggal <= ?
           AND c.kategori IN ('PENDAPATAN','BEBAN')
           AND $reportCatFilter
         GROUP BY t.entityId"
    );
    $stmtRB->execute($params);
    $revenueBeban = $stmtRB->fetchAll();

    // Map entityId => { revenue, beban }
    $rbMap = [];
    foreach ($revenueBeban as $row) {
        $rbMap[$row['entityId']] = [
            'revenue' => (float)$row['revenue'],
            'beban'   => (float)$row['beban'],
        ];
    }

    // Gabungkan ke entities
    foreach ($entities as &$ent) {
        $rb = $rbMap[$ent['id']] ?? ['revenue' => 0, 'beban' => 0];
        $ent['revenue']     = $rb['revenue'];
        $ent['beban']       = $rb['beban'];
        $ent['laba']        = $rb['revenue'] - $rb['beban'];
        $ent['isUmum']      = (bool)$ent['isUmum'];
    }
    unset($ent);

    // Monthly chart (12 bulan)
    $paramsMC = array_merge($entityKeys, [$year]);
    $keyPlaceholders = implode(',', array_fill(0, count($entityKeys), '?'));
    $stmtMC = $pdo->prepare(
        "SELECT t.entityId, e.`key` AS entityKey, e.name AS entityName, e.colorHex,
                MONTH(t.tanggal) AS bulan,
                SUM(t.kredit) AS pendapatan
         FROM Transaction t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         JOIN Entity e ON t.entityId = e.id
         WHERE e.`key` IN ($keyPlaceholders)
           AND YEAR(t.tanggal) = ?
           AND c.kategori = 'PENDAPATAN'
           AND $reportCatFilter
         GROUP BY t.entityId, MONTH(t.tanggal)"
    );
    $stmtMC->execute($paramsMC);
    $mcRaw = $stmtMC->fetchAll();

    // Build per-entity map: entityKey -> [ bulan1..12 ]
    $mcByEntity = [];
    foreach ($mcRaw as $row) {
        $key = $row['entityKey'];
        if (!isset($mcByEntity[$key])) {
            $mcByEntity[$key] = [
                'entityKey'  => $key,
                'entityName' => $row['entityName'],
                'colorHex'   => $row['colorHex'],
                'data'       => array_fill(1, 12, 0),
            ];
        }
        $mcByEntity[$key]['data'][(int)$row['bulan']] = (float)$row['pendapatan'];
    }

    // Normalisasi ke array bulan 1-12
    $monthlyChart = [];
    foreach ($mcByEntity as $ekData) {
        $monthlyChart[] = [
            'entityKey'  => $ekData['entityKey'],
            'entityName' => $ekData['entityName'],
            'colorHex'   => $ekData['colorHex'],
            'months'     => array_values($ekData['data']),
        ];
    }

    // Overdue projects: status ACTIVE, deadline sudah lewat, progress < 80%
    // Progress dihitung dari rata-rata termin percentage yang sudah di-audit
    $stmtProj = $pdo->prepare(
        "SELECT p.id, p.code, p.name, p.deadline, p.contractValue, p.spend,
                e.`key` AS entityKey, e.name AS entityName, e.colorHex,
                COUNT(ter.id) AS totalTermin,
                SUM(CASE WHEN ter.auditedAt IS NOT NULL THEN ter.percentage ELSE 0 END) AS progressPct
         FROM Project p
         JOIN Entity e ON p.entityId = e.id
         LEFT JOIN Termin ter ON ter.projectId = p.id
         WHERE p.entityId IN ($idPlaceholders)
           AND p.status = 'ACTIVE'
           AND p.deadline < NOW()
         GROUP BY p.id
         HAVING progressPct < 80"
    );
    $stmtProj->execute($entityIds);
    $overdueRaw = $stmtProj->fetchAll();

    $overdueProjects = array_map(function ($row) {
        return [
            'id'            => $row['id'],
            'code'          => $row['code'],
            'name'          => $row['name'],
            'deadline'      => $row['deadline'],
            'contractValue' => (float)$row['contractValue'],
            'spend'         => (float)$row['spend'],
            'progressPct'   => (int)$row['progressPct'],
            'entityKey'     => $row['entityKey'],
            'entityName'    => $row['entityName'],
            'colorHex'      => $row['colorHex'],
        ];
    }, $overdueRaw);

    // Unread notifikasi count untuk role user
    $userRole = $auth_user['role'] ?? '';
    $stmtNotif = $pdo->prepare(
        "SELECT COUNT(*) FROM Notifikasi WHERE targetRole = ? AND `read` = 0"
    );
    $stmtNotif->execute([$userRole]);
    $unreadCount = (int)$stmtNotif->fetchColumn();

    json_response([
        'data' => [
            'entities'       => $entities,
            'monthlyChart'   => $monthlyChart,
            'unreadCount'    => $unreadCount,
            'overdueProjects'=> $overdueProjects,
            'year'           => $year,
            'version'        => $version,
        ],
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
