const assert = require('assert');
const akraClient = require('../js/supabase-akra-client.js');

async function runTests() {
  console.log('=== TESTING AKRA W5 SUPABASE API CLIENT ADAPTER ===\n');
  const originalFetch = global.fetch;
  let capturedRequest;

  // 1. Record Stock Adjustment through the authenticated akra-api action.
  console.log('[1/2] Testing recordStockAdjustment...');
  global.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return { ok: true, json: async () => ({ success: true, newStock: 46 }) };
  };
  const adjRes = await akraClient.recordStockAdjustment({
    productId: 12,
    productName: 'มายองเนส SE เบสท์ฟู้ดส์ (ลัง12x910g)',
    newStock: 46,
    user: 'W5 Checker'
  }, 'signed-main-token');
  assert.strictEqual(adjRes.status, 'success');
  assert.strictEqual(adjRes.newStock, 46);
  const adjustmentBody = JSON.parse(capturedRequest.init.body);
  assert.deepStrictEqual(adjustmentBody, {
    action: 'adjustStock', token: 'signed-main-token', productId: 12,
    productName: 'มายองเนส SE เบสท์ฟู้ดส์ (ลัง12x910g)', newStock: 46, user: 'W5 Checker'
  });
  console.log('  -> adjustStock uses the signed Main token and current W5 payload');

  // 2. Query Adjustment History from the same authoritative W5 snapshot.
  console.log('\n[2/2] Testing getAdjustmentHistory...');
  global.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return { ok: true, json: async () => ({ success: true, history: [
      { type: 'adjust', productName: 'สินค้า', qty: 2, user: 'W5 Checker' },
      { type: 'out', productName: 'สินค้าอื่น', qty: 1, user: 'Staff' }
    ] }) };
  };
  const histRes = await akraClient.getAdjustmentHistory('signed-main-token', 10);
  assert.strictEqual(histRes.status, 'success');
  assert.deepStrictEqual(histRes.history, [{ type: 'adjust', productName: 'สินค้า', qty: 2, user: 'W5 Checker' }]);
  assert.strictEqual(JSON.parse(capturedRequest.init.body).action, 'getData');
  console.log('  -> History is read from getData and filtered to W5 adjustments');

  global.fetch = originalFetch;
  await assert.rejects(() => akraClient.recordStockAdjustment({ productId: 1, newStock: 1 }), /authenticated Main session/);
  console.log('\n🌟 AKRA W5 SUPABASE API CLIENT ADAPTER TESTS PASSED 100%! 🌟');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
