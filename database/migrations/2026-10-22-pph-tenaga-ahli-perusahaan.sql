-- Kebijakan perusahaan: PPh honor hanya untuk pelaporan, tidak memotong gaji diterima.
-- Nominal honor dan PPh historis dipertahankan; hanya nilai gaji diterima disesuaikan.
UPDATE HonorTenagaAhli SET nominalBersih = nominalHonor, updatedAt = CURRENT_TIMESTAMP
WHERE nominalBersih <> nominalHonor;
