const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexPath = path.join(__dirname, '..', 'index.html');
const versionJsonPath = path.join(__dirname, '..', 'version.json');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));

console.log('=== AKRA W5 Integrated UI & Workflow Verification Suite ===\n');

// 1. Script compilation
console.log('[1/5] Verifying all inline <script> blocks with node:vm...');
const scriptMatches = [...indexSource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptMatches.map(m => m[1].trim()).filter(Boolean);
assert.strictEqual(inlineScripts.length >= 2, true, 'index.html must have at least 2 inline script blocks');
inlineScripts.forEach((code, idx) => {
  new vm.Script(code, { filename: `inline-${idx + 1}.js` });
  console.log(`  ✓ Script block #${idx + 1} compiled with 0 syntax errors`);
});

// 2. Version Parity
console.log('\n[2/5] Checking version parity...');
const versionMatch = indexSource.match(/(?:const|var|let)\s+CURRENT_VERSION\s*=\s*["']([^"']+)["']/);
assert.ok(versionMatch, 'CURRENT_VERSION constant must be defined');
assert.strictEqual(versionMatch[1], versionJson.version, 'Version mismatch');
assert.strictEqual(versionMatch[1], '20260831.02', 'Target version must be 20260831.02');
console.log(`  ✓ Version verified: ${versionMatch[1]}`);

// Sandbox setup
const authScript = inlineScripts[0];
const vueScript = inlineScripts[1];

function createSandbox(extraGlobals = {}) {
  const storage = {};
  let locationUrl = 'https://akra-web.github.io/AKRA/';
  let vueAppConfig = null;

  const sandbox = {
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Buffer,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Error,
    Math,
    parseInt,
    parseFloat,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},
    Vue: {
      createApp: (cfg) => {
        vueAppConfig = cfg;
        return { mount: () => cfg };
      }
    },
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
    },
    alert: () => {},
    window: {
      self: 1,
      top: 1,
      location: {
        get href() { return locationUrl; },
        set href(v) { locationUrl = v; },
        get search() {
          const idx = locationUrl.indexOf('?');
          return idx !== -1 ? locationUrl.substring(idx) : '';
        },
        get pathname() { return '/AKRA/'; },
        get hostname() { return 'akra-web.github.io'; },
        replace(v) { locationUrl = v; }
      },
      history: {
        replaceState: (_state, _title, path) => {
          locationUrl = 'https://akra-web.github.io' + path;
        }
      },
      scrollTo: () => {},
      addEventListener: () => {}
    },
    document: {
      title: 'AKRA W5',
      body: { appendChild: () => {}, removeChild: () => {} },
      head: { appendChild: () => {} },
      getElementById: () => null,
      createElement: () => ({
        setAttribute: () => {},
        appendChild: () => {},
        addEventListener: () => {},
        click: () => {},
        focus: () => {}
      }),
      addEventListener: () => {}
    },
    fetch: async () => new Response('{}', { status: 200 }),
    ...extraGlobals
  };

  const context = vm.createContext(sandbox);
  return { context, storage, getVueConfig: () => vueAppConfig };
}

function makeMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('mock-sig').toString('base64url');
  return `${header}.${body}.${sig}`;
}

// 3. Test Vue State & UI Filter Logic
console.log('\n[3/5] Testing Catalog filtering and computed metrics...');
async function runWorkflowTests() {
  const capturedCalls = [];

  const sampleProducts = [
    { id: 101, name: "^Z/วิปปิ้งครีม Rich's โกลด์ (ลัง12x907g)", stock: 120, unit: 'ลัง' },
    { id: 102, name: '^Z/สตรอเบอร์รี่ แช่แข็ง Castella เกรดA (ลัง10x1kg)', stock: 8, unit: 'ลัง' },
    { id: 103, name: '^Z/มอสเซเรล่าชีส แบบขูด Valla (ลัง12x1kg)', stock: 15, unit: 'ลัง' },
    { id: 104, name: 'Y/S)แป้ง ว่าว (กระสอบ 22.5kg)', stock: 50, unit: 'กระสอบ' },
    { id: 105, name: 'Y/ล]เนยเทียม เซสท์ เหลือง ตัก (ลัง15kg)', stock: 30, unit: 'ลัง' },
    { id: 106, name: 'Z/นมข้นจืด พาเลซ แดง (ถาด48กป.)', stock: 60, unit: 'ถาด' },
    { id: 107, name: 'ถ้วยฟอยล์ พร้อมอบ Star *แยกฝา* (ลัง12x50pcs)', stock: 0, unit: 'ลัง' }
  ];

  const { context, storage, getVueConfig } = createSandbox({
    fetch: async (url, options) => {
      if (url.includes('version.json')) {
        return { ok: true, status: 200, json: async () => ({ version: '20260831.02' }) };
      }
      const body = options && options.body ? JSON.parse(options.body) : {};
      capturedCalls.push({ url, options, body });
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
  });

  const validToken = makeMockJwt({ id: 'u_tester', name: 'Tester User', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) + 3600 });
  storage['akra_session_token'] = validToken;
  storage['akra_user_data'] = JSON.stringify({ id: 'u_tester', name: 'Tester User', roles: ['ADMIN'] });

  vm.runInContext(authScript, context);
  context.AppVersionGuard.start({ current: context.CURRENT_VERSION, readActions: [] });
  await context.verifyAccess();

  vm.runInContext(vueScript, context);
  const vueConfig = getVueConfig();
  assert.ok(vueConfig, 'Vue app config must be initialized');

  const instance = {
    ...vueConfig.data(),
    products: JSON.parse(JSON.stringify(sampleProducts)),
    history: [],
    pickList: [],
    isOnline: true,
    isLoading: false,
    isSilentLoading: false,
    isSubmitting: false,
    loggedInUser: 'Tester User',
    isAdmin: true
  };

  Object.keys(vueConfig.methods).forEach(k => {
    instance[k] = vueConfig.methods[k].bind(instance);
  });

  Object.keys(vueConfig.computed).forEach(k => {
    Object.defineProperty(instance, k, {
      get: () => vueConfig.computed[k].call(instance)
    });
  });

  // Test Metrics
  assert.strictEqual(instance.totalItemsInStock, 283);
  assert.strictEqual(instance.lowStockItems.length, 3); // 8, 15, 0 (< 20)
  assert.strictEqual(instance.filteredCatalogProducts.length, 7);

  // Test Category Classifier: Whipped cream & Frozen products -> 'chilled'
  assert.strictEqual(instance.getProductCategory(sampleProducts[0]), 'chilled');
  assert.strictEqual(instance.getProductCategoryName(sampleProducts[0]), 'แช่เย็น');
  assert.strictEqual(instance.getProductCategory(sampleProducts[1]), 'chilled');
  assert.strictEqual(instance.getProductCategory(sampleProducts[2]), 'chilled');
  assert.strictEqual(instance.getProductCategory(sampleProducts[3]), 'flour');
  assert.strictEqual(instance.getProductCategory(sampleProducts[4]), 'butter');
  assert.strictEqual(instance.getProductCategory(sampleProducts[5]), 'dairy_sugar');
  assert.strictEqual(instance.getProductCategory(sampleProducts[6]), 'packaging_misc');

  // Test Category Filter for 'chilled'
  instance.selectedCategory = 'chilled';
  assert.strictEqual(instance.filteredCatalogProducts.length, 3);

  // Test Category Filter for 'flour'
  instance.selectedCategory = 'flour';
  assert.strictEqual(instance.filteredCatalogProducts.length, 1);
  assert.strictEqual(instance.filteredCatalogProducts[0].name, 'Y/S)แป้ง ว่าว (กระสอบ 22.5kg)');

  instance.selectedCategory = 'all';
  instance.searchTransactionList = 'วิปปิ้ง';
  assert.strictEqual(instance.filteredCatalogProducts.length, 1);
  assert.strictEqual(instance.filteredCatalogProducts[0].name, "^Z/วิปปิ้งครีม Rich's โกลด์ (ลัง12x907g)");

  instance.searchTransactionList = '';
  console.log('  ✓ Catalog category filter (แช่เย็น / แป้ง / เนย / นม / บรรจุภัณฑ์), search, and KPI calculations pass');

  // 4. Test 1-Tap Quick Stepper Withdrawal
  console.log('\n[4/5] Testing 1-Tap Quick Stepper Withdrawal flow...');
  const targetProduct = instance.products.find(p => p.id === 104);
  instance.openWithdrawStepper(targetProduct);

  assert.strictEqual(instance.stepperModal.show, true);
  assert.strictEqual(instance.stepperModal.qty, 1);
  assert.strictEqual(instance.stepperRemainingStock, 49);

  instance.stepperAdd(5); // qty -> 6
  assert.strictEqual(instance.stepperModal.qty, 6);
  assert.strictEqual(instance.stepperRemainingStock, 44);

  instance.stepperMinus(); // qty -> 5
  assert.strictEqual(instance.stepperModal.qty, 5);

  instance.stepperPlus(); // qty -> 6
  assert.strictEqual(instance.stepperModal.qty, 6);

  await instance.confirmQuickWithdraw();
  assert.strictEqual(targetProduct.stock, 44, 'Stock must decrease by 6');
  assert.strictEqual(instance.stepperModal.show, false, 'Modal must close on confirm');
  assert.strictEqual(instance.history.length, 1, 'History record must be appended');
  assert.strictEqual(instance.history[0].type, 'out');
  assert.strictEqual(instance.history[0].qty, 6);

  const txCall = capturedCalls.find(c => c.body.action === 'transaction' && c.body.productId === 104);
  assert.ok(txCall, 'Transaction mutation must be dispatched to Supabase akra-api');
  assert.strictEqual(txCall.body.type, 'out');
  assert.strictEqual(txCall.body.qty, 6);
  console.log('  ✓ 1-Tap Stepper withdrawal executes and reduces stock accurately');

  // 5. Test Pick List & Admin Adjust Stock
  console.log('\n[5/5] Testing Pick List & Admin Stock Adjustment...');
  
  // Pick List add
  instance.form.productId = 101;
  instance.form.qty = 10;
  await instance.processAddPickList(instance.products.find(p => p.id === 101));
  assert.strictEqual(instance.pickList.length, 1);
  assert.strictEqual(instance.pickList[0].qty, 10);

  // Submit pick
  instance.openPickModal(instance.pickList[0]);
  instance.pickModal.actualQty = 10;
  await instance.submitPick();
  assert.strictEqual(instance.pickList.length, 0, 'Pick list item must be cleared after fulfillment');
  assert.strictEqual(instance.products.find(p => p.id === 101).stock, 110, 'Stock must decrease by picked qty');

  // Admin Adjust Stock
  instance.openAdjustModal(targetProduct);
  instance.adjustModal.newStock = 60;
  await instance.saveAdjustStock();
  assert.strictEqual(targetProduct.stock, 60, 'Product stock must be adjusted to 60');

  console.log('  ✓ Pick List order fulfillment and Admin adjustStock succeed');
}

async function main() {
  await runWorkflowTests();
  console.log('\n============================================================');
  console.log('🎉 ALL INTEGRATED UI & WORKFLOW TESTS PASSED 100% (5/5)!');
  console.log('============================================================\n');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
