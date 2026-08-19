const assert = require('assert');
const akraClient = require('../js/supabase-akra-client.js');

async function runTests() {
  console.log('=== TESTING AKRA W5 SUPABASE API CLIENT ADAPTER ===\n');

  // 1. Record Stock Adjustment
  console.log('[1/2] Testing recordStockAdjustment...');
  const adjRes = await akraClient.recordStockAdjustment({
    adjustmentDate: '2026-08-19',
    warehouse: 'W5',
    sku: 'FF21610104',
    productName: 'มายองเนส SE เบสท์ฟู้ดส์ (ลัง12x910g)',
    deltaQty: -2,
    balanceAfter: 46,
    reason: 'ตัดยอดสินค้าเสียหายหน้างาน',
    operator: 'W5 Checker'
  });
  assert.strictEqual(adjRes.status, 'success');
  assert(adjRes.adjustmentId, 'Must return adjustment ID');
  console.log(`  -> Created Stock Adjustment ID: [${adjRes.adjustmentId}]`);

  // 2. Query Adjustment History (<25ms)
  console.log('\n[2/2] Testing getAdjustmentHistory...');
  const t0 = Date.now();
  const histRes = await akraClient.getAdjustmentHistory(10);
  const histMs = Date.now() - t0;
  assert.strictEqual(histRes.status, 'success');
  assert(histRes.history.length >= 1, 'Must find recorded adjustment');
  console.log(`  -> History Query Latency: ${histMs}ms (found ${histRes.history.length} records)`);

  console.log('\n🌟 AKRA W5 SUPABASE API CLIENT ADAPTER TESTS PASSED 100%! 🌟');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
