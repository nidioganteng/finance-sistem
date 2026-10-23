const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const filename = path.resolve('src/lib/actions/kas.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
class ApiError extends Error {}
let fail = false, notifications = 0;
global.window = { dispatchEvent: event => { assert.equal(event.type, 'kas:changed'); notifications++; } };
mod.require = name => {
  assert.equal(name, '@/lib/api-client');
  return { ApiError, getPhpToken: async () => 'test-token', phpFetch: async () => { if (fail) throw new ApiError('Gagal'); return { noBukti: 'UG/10231' }; } };
};
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const api = mod.exports;
(async () => {
  await api.generateNoBukti('gaharu', '2026-10-23');
  assert.equal(notifications, 0, 'reading a voucher number does not refresh the ledger');
  for (const call of [() => api.createKasTransaction({}), () => api.createKasTransactionBatch([]), () => api.deleteKasTransactionGroup(['id'], '/bank-buku'), () => api.replaceKasTransaction({}), () => api.updateKasTransactionGroup({})]) {
    fail = false;
    const before = notifications;
    assert.equal((await call()).success, true);
    assert.equal(notifications, before + 1, 'successful mutation invalidates client-loaded cash data');
    fail = true;
    assert.equal((await call()).error, 'Gagal');
    assert.equal(notifications, before + 1, 'failed mutation does not announce a successful change');
  }
  console.log('Cash refresh: create, batch, delete, replace, patch success/error notifications passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
