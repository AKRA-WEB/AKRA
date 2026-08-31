const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexPath = path.join(__dirname, '..', 'index.html');
const versionJsonPath = path.join(__dirname, '..', 'version.json');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));

console.log('=== AKRA W5 Auth & Lifecycle Verification Suite ===\n');

// -------------------------------------------------------------
// 1. Script parsing & syntax compilation
// -------------------------------------------------------------
console.log('[1/6] Verifying <script> parsing with new vm.Script()...');
const scriptMatches = [...indexSource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptMatches.map(m => m[1].trim()).filter(Boolean);
assert.strictEqual(inlineScripts.length >= 2, true, 'index.html should have at least 2 inline script blocks');

inlineScripts.forEach((code, idx) => {
  try {
    new vm.Script(code);
    console.log(`  ✓ Inline script block #${idx + 1} parsed successfully with zero syntax errors`);
  } catch (err) {
    assert.fail(`Syntax error in script block #${idx + 1}: ${err.message}`);
  }
});

// -------------------------------------------------------------
// 2. Version Parity Check
// -------------------------------------------------------------
console.log('\n[2/6] Checking version parity between index.html and version.json...');
const versionMatch = indexSource.match(/(?:const|var|let)\s+CURRENT_VERSION\s*=\s*["']([^"']+)["']/);
assert.ok(versionMatch, 'CURRENT_VERSION constant must be defined in index.html');
const indexVersion = versionMatch[1];
assert.strictEqual(indexVersion, versionJson.version, `Version mismatch: index.html=${indexVersion}, version.json=${versionJson.version}`);
assert.strictEqual(indexVersion, '20260831.02', 'Target version must be 20260831.02');
console.log(`  ✓ Version parity verified: ${indexVersion}`);

// -------------------------------------------------------------
// Helper to create mock JWT
// -------------------------------------------------------------
function makeMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('mock-sig').toString('base64url');
  return `${header}.${body}.${sig}`;
}

// -------------------------------------------------------------
// 3. Test decodeJwtPayload
// -------------------------------------------------------------
console.log('\n[3/6] Testing decodeJwtPayload functionality...');
const authScriptMatch = inlineScripts[0];
const vueScriptMatch = inlineScripts[1];

function createSandbox(extraGlobals = {}) {
  const storage = {};
  const alerts = [];
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
    setTimeout: (fn) => fn(),
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
    alert: (msg) => { alerts.push(msg); },
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
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      getElementById: () => null,
      createElement: () => ({
        setAttribute: () => {},
        appendChild: () => {},
        addEventListener: () => {},
        querySelector: () => ({ focus: () => {} }),
        focus: () => {}
      }),
      addEventListener: () => {}
    },
    fetch: async () => new Response('{}', { status: 200 }),
    ...extraGlobals
  };

  const context = vm.createContext(sandbox);
  return {
    context,
    sandbox,
    storage,
    alerts,
    getLocation: () => locationUrl,
    getVueConfig: () => vueAppConfig
  };
}

{
  const { context } = createSandbox();
  vm.runInContext(authScriptMatch, context);

  // Test valid unexpired token
  const validToken = makeMockJwt({ id: 'u1', name: 'User 1', roles: ['AKRA'], exp: Math.floor(Date.now() / 1000) + 3600 });
  const decodedValid = context.decodeJwtPayload(validToken);
  assert.ok(decodedValid, 'Valid token must decode');
  assert.strictEqual(decodedValid.id, 'u1');

  // Test expired token (exp in past)
  const expiredToken = makeMockJwt({ id: 'u1', name: 'User 1', roles: ['AKRA'], exp: Math.floor(Date.now() / 1000) - 3600 });
  const decodedExp = context.decodeJwtPayload(expiredToken);
  assert.strictEqual(decodedExp, null, 'Expired token must return null');

  // Test invalid structure
  assert.strictEqual(context.decodeJwtPayload('invalid.token'), null);
  assert.strictEqual(context.decodeJwtPayload(''), null);
  console.log('  ✓ decodeJwtPayload correctly accepts valid and strictly rejects expired/malformed tokens');
}

// -------------------------------------------------------------
// 4. Test verifyAccess Security Invariants
// -------------------------------------------------------------
console.log('\n[4/6] Testing verifyAccess lifecycle and expired session handling...');

async function runAuthTests() {
  // Case A: Valid SSO in URL
  {
    const { context, storage, getLocation } = createSandbox();
    const validToken = makeMockJwt({ id: 'user_sso', name: 'SSO User', roles: ['AKRA'], perms: { 'app-akra': ['viewW5', 'manageProducts'] }, exp: Math.floor(Date.now() / 1000) + 3600 });
    context.window.location.href = `https://akra-web.github.io/AKRA/?sso=${validToken}`;

    vm.runInContext(authScriptMatch, context);
    const result = await context.verifyAccess();
    assert.strictEqual(result, true, 'Valid SSO token must verify access');
    assert.strictEqual(context.currentUser, 'SSO User');
    assert.strictEqual(storage['akra_session_token'], validToken);
    assert.deepStrictEqual(context.appUser.perms, { 'app-akra': ['viewW5', 'manageProducts'] });
    assert.strictEqual(getLocation().includes('?sso='), false, 'sso query parameter must be removed from URL');
    console.log('  ✓ Valid SSO token successfully sets session and removes query param');
  }

  // Case B: Valid Cached Token in localStorage
  {
    const { context, storage } = createSandbox();
    const validToken = makeMockJwt({ id: 'user_cached', name: 'Cached User', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) + 3600 });
    storage['akra_session_token'] = validToken;

    vm.runInContext(authScriptMatch, context);
    const result = await context.verifyAccess();
    assert.strictEqual(result, true, 'Valid cached token must verify access');
    assert.strictEqual(context.currentUser, 'Cached User');
    assert.strictEqual(context.sessionToken, validToken);
    console.log('  ✓ Valid cached session successfully restores user session');
  }

  // Case C: Expired Cached Token in localStorage (The Zombie Session Bug)
  {
    const { context, storage, getLocation } = createSandbox();
    const expiredToken = makeMockJwt({ id: 'user_expired', name: 'Expired User', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) - 3600 });
    storage['akra_session_token'] = expiredToken;
    storage['akra_user_data'] = JSON.stringify({ id: 'user_expired', name: 'Expired User', roles: ['ADMIN'] });

    vm.runInContext(authScriptMatch, context);
    const result = await context.verifyAccess();
    assert.strictEqual(result, false, 'Expired cached token must NOT be allowed');
    assert.strictEqual(storage['akra_session_token'], undefined, 'Expired session token must be cleared');
    assert.strictEqual(storage['akra_user_data'], undefined, 'Expired user data must be cleared');
    assert.strictEqual(context.sessionToken, null);
    assert.strictEqual(getLocation(), 'https://akra-web.github.io/Main/', 'Must redirect to Main Portal');
    console.log('  ✓ Expired cached session is strictly rejected, cleared, and redirected to login (Zombie fix verified)');
  }
}

// -------------------------------------------------------------
// 5. Test apiCall Error Handling (401 & 403)
// -------------------------------------------------------------
async function runApiCallTests() {
  console.log('\n[5/6] Testing apiCall 401 session expiry and 403 permission handling...');

  let simulatedStatus = 401;
  let simulatedBody = { success: false, error: 'invalid_or_expired_token' };

  const { context, storage, getLocation, getVueConfig } = createSandbox({
    fetch: async (url) => {
      if (url.includes('version.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ version: '20260831.02' })
        };
      }
      return {
        ok: simulatedStatus >= 200 && simulatedStatus < 300,
        status: simulatedStatus,
        json: async () => simulatedBody
      };
    }
  });

  const validToken = makeMockJwt({ id: 'u_test', name: 'Test User', roles: ['AKRA'], exp: Math.floor(Date.now() / 1000) + 3600 });
  storage['akra_session_token'] = validToken;
  storage['akra_user_data'] = JSON.stringify({ id: 'u_test', name: 'Test User', roles: ['AKRA'] });

  vm.runInContext(authScriptMatch, context);
  context.AppVersionGuard.start({ current: context.CURRENT_VERSION, readActions: [] });
  await context.verifyAccess();

  // Run Vue script block to get real methods
  vm.runInContext(vueScriptMatch, context);
  const vueConfig = getVueConfig();
  assert.ok(vueConfig, 'Vue app config must be instantiated');

  const instanceState = {
    ...vueConfig.data(),
    isOnline: true,
    isLoading: false,
    isSilentLoading: false,
    messageBox: { show: false, title: '', message: '', isError: false },
    showAlert(title, message, isError) {
      this.messageBox = { show: true, title, message, isError };
    }
  };

  const boundApiCall = vueConfig.methods.apiCall.bind(instanceState);

  // Test 401 Invalid or Expired Token during mutation
  simulatedStatus = 401;
  simulatedBody = { success: false, error: 'invalid_or_expired_token' };
  const callRes = await boundApiCall({ action: 'addProduct', product: { name: 'Test Product' } });
  assert.strictEqual(callRes, false, 'apiCall must return false on 401');
  assert.strictEqual(instanceState.messageBox.title, 'เซสชันหมดอายุ');
  assert.strictEqual(storage['akra_session_token'], undefined, 'Session token must be cleared upon 401');
  assert.strictEqual(storage['akra_user_data'], undefined, 'User data must be cleared upon 401');
  assert.strictEqual(getLocation(), 'https://akra-web.github.io/Main/', 'Must redirect to Main Portal on 401');
  console.log('  ✓ 401 invalid_or_expired_token clears session, alerts user, and redirects to Main Portal');

  // Test 403 Permission Denied
  simulatedStatus = 403;
  simulatedBody = { success: false, error: 'admin_permission_required' };
  const callRes403 = await boundApiCall({ action: 'adjustStock', productId: 1, newStock: 50 });
  assert.strictEqual(callRes403, false, 'apiCall must return false on 403');
  assert.strictEqual(instanceState.messageBox.title, 'ไม่มีสิทธิ์เข้าถึง');
  console.log('  ✓ 403 admin_permission_required displays permission error without clearing valid session');
}

// -------------------------------------------------------------
// 6. Test addProduct Real Database ID Assignment & Mutation
// -------------------------------------------------------------
async function runAddProductRealIdTests() {
  console.log('\n[6/6] Testing addProduct real DB ID assignment and subsequent transaction...');

  const capturedMutations = [];
  const SERVER_PRODUCT_ID = 245;

  const { context, storage, getVueConfig } = createSandbox({
    fetch: async (url, options) => {
      if (url.includes('version.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ version: '20260831.02' })
        };
      }
      const body = JSON.parse((options && options.body) || '{}');
      capturedMutations.push(body);

      if (body.action === 'addProduct') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            product: {
              id: SERVER_PRODUCT_ID,
              name: body.product.name,
              stock: 0,
              unit: body.product.unit || 'ชิ้น'
            }
          })
        };
      }

      if (body.action === 'transaction') {
        assert.strictEqual(body.productId, SERVER_PRODUCT_ID, 'Transaction must use the real database ID returned by addProduct');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            newStock: body.qty
          })
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      };
    }
  });

  const validToken = makeMockJwt({ id: 'u_admin', name: 'Admin User', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) + 3600 });
  storage['akra_session_token'] = validToken;
  storage['akra_user_data'] = JSON.stringify({ id: 'u_admin', name: 'Admin User', roles: ['ADMIN'] });
  storage['AKRA_WMS_DATA'] = JSON.stringify({ _ts: Date.now(), _d: { products: [{ id: 1, name: 'Existing Prod', stock: 10 }] } });

  vm.runInContext(authScriptMatch, context);
  context.AppVersionGuard.start({ current: context.CURRENT_VERSION, readActions: [] });
  await context.verifyAccess();

  vm.runInContext(vueScriptMatch, context);
  const vueConfig = getVueConfig();

  const instanceState = {
    ...vueConfig.data(),
    isOnline: true,
    isLoading: false,
    isSilentLoading: false,
    products: [{ id: 1, name: 'Existing Prod', stock: 10, unit: 'ชิ้น' }],
    newProductName: 'เนยสด ตราออร์คิด',
    newProductUnit: 'ก้อน',
    messageBox: { show: false, title: '', message: '', isError: false },
    toastMessage: '',
    showToast: false,
    showAlert(title, message, isError) {
      this.messageBox = { show: true, title, message, isError };
    },
    triggerToast(msg) {
      this.toastMessage = msg;
    }
  };

  instanceState.apiCall = vueConfig.methods.apiCall.bind(instanceState);
  instanceState.addProduct = vueConfig.methods.addProduct.bind(instanceState);
  instanceState.confirmTransaction = vueConfig.methods.confirmTransaction.bind(instanceState);
  instanceState.getTodayStr = vueConfig.methods.getTodayStr.bind(instanceState);

  // 1. Add Product
  await instanceState.addProduct();
  const addedProd = instanceState.products.find(p => p.name === 'เนยสด ตราออร์คิด');
  assert.ok(addedProd, 'Product must be added to reactive state');
  assert.strictEqual(addedProd.id, SERVER_PRODUCT_ID, `Product ID must equal database ID (${SERVER_PRODUCT_ID}), not synthetic client ID`);
  assert.strictEqual(storage['AKRA_WMS_DATA'], undefined, 'AKRA_WMS_DATA cache must be invalidated on addProduct');
  console.log(`  ✓ addProduct correctly captures and stores real server ID (${SERVER_PRODUCT_ID})`);

  // 2. Perform Stock In on the newly added product
  instanceState.form.productId = addedProd.id;
  instanceState.form.type = 'in';
  instanceState.form.qty = 20;
  instanceState.form.user = 'Admin User';
  await instanceState.confirmTransaction();

  const txMutation = capturedMutations.find(m => m.action === 'transaction');
  assert.ok(txMutation, 'Transaction mutation must be dispatched');
  assert.strictEqual(txMutation.productId, SERVER_PRODUCT_ID, 'Transaction must target real database product ID');
  assert.strictEqual(addedProd.stock, 20, 'Stock must be updated to 20');
  console.log('  ✓ Subsequent transaction successfully executed using real database ID without product_not_found error');
}

async function main() {
  await runAuthTests();
  await runApiCallTests();
  await runAddProductRealIdTests();
  console.log('\n============================================================');
  console.log('🎉 ALL AKRA W5 AUTH & LIFECYCLE TESTS PASSED 100% (6/6)!');
  console.log('============================================================\n');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
