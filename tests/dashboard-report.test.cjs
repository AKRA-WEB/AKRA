// Actual W5 inline runtime with intercepted transport; no network or database writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(code => code.trim());
scripts.forEach(code => new vm.Script(code));
const owner = { identityId: '10000000-0000-4000-8000-000000000011', sessionVersion: 1, authorizationRevision: 'fixture', name: 'Fixture' };
const snapshotAt = '2026-10-09T07:00:00.000Z', snapshotToken = 'synthetic-stable-snapshot';
function fixture() {
    let config;
    const requests = [], downloads = [];
    const window = { location: { search: '', hostname: 'fixture.invalid' }, isPreviewEnv: false };
    const context = vm.createContext({ console, Date, URL, URLSearchParams, window,
        document: { hidden: false, body: { appendChild() {}, removeChild() {} }, createElement() { const attributes = {}; return { setAttribute(key, value) { attributes[key] = value; }, click() { downloads.push(attributes); } }; } },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, payload: JSON.parse(options.body), resolve, reject })),
        Vue: { createApp(value) { config = value; return { mount() {} }; } }
    });
    scripts.forEach(code => vm.runInContext(code, context));
    context.appUser = { ...owner }; context.sessionToken = 'fixture-token';
    context.AppVersionGuard.blockIfStale = async () => false;
    const app = { ...config.data() };
    for (const [name, method] of Object.entries(config.methods)) app[name] = method.bind(app);
    for (const [name, getter] of Object.entries(config.computed)) Object.defineProperty(app, name, { get: getter.bind(app) });
    app.isAuthorized = true;
    return { context, app, config, requests, downloads, window };
}
const tick = () => new Promise(setImmediate);
const records = Array.from({ length: 205 }, (_, index) => ({ id: 'record-' + index, productId: index % 2 + 1, productName: index === 202 ? '=HYPERLINK("bad"),\nOld product' : 'Product ' + (index % 2 + 1),
    type: index % 3 === 0 ? 'in' : index % 3 === 1 ? 'out' : 'adjust', qty: 2, signedQty: index % 3 === 0 ? 2 : -2, user: index === 202 ? '@danger,"quoted"' : 'Actor',
    date: '09/10/26', time: '14:00:00', eventAt: '2026-10-09T07:00:00Z', eventDate: '2026-10-09', dateSource: 'recorded', createdAt: snapshotAt, unit: null, refGrItemId: index === 202 ? 'gr-old' : null }));
function report(filters, rows = records) {
    const { offset = 0, limit = 50 } = filters;
    return { snapshotAt, snapshotToken, total: rows.length, timeZone: 'Asia/Bangkok', filters,
        page: { offset, limit, hasMore: offset + limit < rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null },
        history: rows.slice(offset, offset + limit), summary: { movementCount: rows.length, productCount: 2, userCount: 2, byType: { in: 69, out: 68, adjust: 68 }, byUnit: [{ unit: null, movementCount: rows.length, inQty: null, outQty: null, adjustQty: null, netQty: null }] },
        trends: [{ date: '2026-10-09', movementCount: rows.length, inCount: 69, outCount: 68, adjustCount: 68 }],
        productSummary: [{ productId: 1, productName: 'Product 1', unit: null, movementCount: rows.length, inQty: 138, outQty: 136, adjustQty: -136, netQty: -134 }],
        options: { products: [{ id: 1, name: 'Current name', active: true, unit: 'ลัง' }, { id: 2, name: 'Inactive name', active: false, unit: 'ชิ้น' }], users: ['Actor'], range: { firstDate: '2020-01-01', lastDate: '2026-10-09' } },
        inventory: { asOf: snapshotAt, summary: { productCount: 3, zeroStockCount: 1, lowStockCount: 1, byUnit: [{ unit: 'ลัง', stock: 19, productCount: 2 }, { unit: 'ชิ้น', stock: 35, productCount: 1 }] }, products: [{ id: 1, name: 'Current name', stock: 19, unit: 'ลัง' }, { id: 2, name: 'Other unit', stock: 35, unit: 'ชิ้น' }, { id: 3, name: 'No stock', stock: 0, unit: 'ลัง' }] }
    };
}
function respond(f, index, value, status = 200) { f.requests[index].resolve({ ok: status < 400, status, json: async () => value }); }
async function load(f, rows) {
    const pending = f.app.applyDashboardFilters(); await tick();
    const index = f.requests.length - 1; respond(f, index, { success: true, dashboard: report(f.requests[index].payload.filters, rows) }); await pending;
}
test('Bangkok presets include day/month/leap boundaries; invalid custom range sends zero requests', async () => {
    const f = fixture();
    const date = (preset, iso) => JSON.parse(vm.runInContext(`JSON.stringify(w5DashboardDates('${preset}', Date.parse('${iso}')))`, f.context));
    assert.deepEqual(date('today', '2026-10-08T17:01:00Z'), { startDate: '2026-10-09', endDate: '2026-10-09' });
    assert.deepEqual(date('yesterday', '2026-10-08T17:01:00Z'), { startDate: '2026-10-08', endDate: '2026-10-08' });
    assert.deepEqual(date('7d', '2026-01-02T00:00:00Z'), { startDate: '2025-12-27', endDate: '2026-01-02' });
    assert.deepEqual(date('30d', '2026-01-02T00:00:00Z'), { startDate: '2025-12-04', endDate: '2026-01-02' });
    assert.deepEqual(date('lastMonth', '2024-03-02T00:00:00Z'), { startDate: '2024-02-01', endDate: '2024-02-29' });
    assert.deepEqual(date('thisMonth', '2026-01-02T00:00:00Z'), { startDate: '2026-01-01', endDate: '2026-01-02' });
    assert.deepEqual(date('all', '2026-01-02T00:00:00Z'), { startDate: '', endDate: '' });
    f.app.dashboardFilters.preset = 'custom';
    for (const [startDate, endDate] of [['2026-02-30', '2026-03-01'], ['2026-10-09', '2026-10-08'], ['', '2026-10-09']]) {
        Object.assign(f.app.dashboardFilters, { startDate, endDate }); await f.app.applyDashboardFilters();
        assert.ok(f.app.dashboardValidation); assert.equal(f.requests.length, 0);
    }
});
test('full aggregates remain independent of 50-row history; exact combined filters, old product drilldown and independent current units', async () => {
    const f = fixture();
    Object.assign(f.app.dashboardFilters, { preset: 'all', type: 'adjust', user: 'Actor', productId: 2, query: 'old,%_\\' });
    await load(f);
    const filters = f.requests[0].payload.filters;
    assert.equal(f.requests[0].payload.action, 'getDashboard'); assert.equal(f.requests[0].options.headers.Authorization, 'Bearer fixture-token');
    assert.equal(filters.startDate, null); assert.equal(filters.endDate, null); assert.equal(filters.type, 'adjust'); assert.equal(filters.user, 'Actor'); assert.equal(filters.productId, 2); assert.equal(filters.query, 'old,%_\\');
    assert.equal(f.app.dashboardReport.total, 205); assert.equal(f.app.dashboardReport.history.length, 50); assert.equal(f.app.dashboardReport.summary.movementCount, 205);
    assert.equal(f.app.dashboardReport.summary.byUnit[0].inQty, null); assert.equal(f.app.formatDashboardNumber(null), '—');
    assert.equal(f.app.dashboardInventory.summary.byUnit.length, 2);
    f.app.dashboardStockStatus = 'low'; assert.equal(f.app.dashboardStockProducts.length, 1); assert.equal(f.app.dashboardStockProducts[0].stock, 19);
    f.app.dashboardStockStatus = 'out'; assert.equal(f.app.dashboardStockProducts[0].stock, 0);
    const stock = f.app.dashboardInventory; f.app.dashboardFilters.query = 'changed'; f.app.dashboardFilterChanged();
    assert.equal(f.app.dashboardReport, null); assert.equal(f.app.dashboardInventory, stock);
    const pending = f.app.showDashboardProduct({ productId: 2 }); await tick();
    assert.equal(f.app.dashboardView, 'history'); assert.equal(f.requests[1].payload.filters.productId, 2);
    respond(f, 1, { success: true, dashboard: report(f.requests[1].payload.filters) }); await pending;
    f.app.clearDashboardFilters(); await tick(); assert.equal(f.requests[2].payload.filters.productId, null); assert.equal(f.requests[2].payload.filters.query, '');
    respond(f, 2, { success: true, dashboard: report(f.requests[2].payload.filters) }); await tick();
});
test('paging preserves snapshot pair and reaches record beyond legacy 150; previous page restores stable rows', async () => {
    const f = fixture(); await load(f);
    for (let page = 1; page <= 4; page++) {
        const pending = f.app.changeDashboardPage(1); await tick();
        const filters = f.requests[page].payload.filters;
        assert.equal(filters.offset, page * 50); assert.equal(filters.snapshotAt, snapshotAt); assert.equal(filters.snapshotToken, snapshotToken);
        respond(f, page, { success: true, dashboard: report(filters) }); await pending;
    }
    assert.ok(f.app.dashboardReport.history.some(row => row.id === 'record-202')); assert.equal(f.app.dashboardReport.total, 205);
    const pending = f.app.changeDashboardPage(-1); await tick(); assert.equal(f.requests[5].payload.filters.offset, 150);
    respond(f, 5, { success: true, dashboard: report(f.requests[5].payload.filters) }); await pending; assert.equal(f.app.dashboardReport.history[0].id, 'record-150');
});
test('loading, empty, error/retry and unavailable endpoint never use latest 150-row data', async () => {
    const f = fixture(); f.app.history = records.slice(0, 150);
    const pending = f.app.applyDashboardFilters(); assert.equal(f.app.dashboardLoading, true); await tick();
    respond(f, 0, { success: false, error: 'unknown_action' }, 400); await pending;
    assert.equal(f.app.dashboardReport, null); assert.ok(f.app.dashboardError); assert.equal(f.app.dashboardLoading, false);
    await load(f, []); assert.equal(f.app.dashboardReport.total, 0); assert.equal(f.app.dashboardReport.history.length, 0); assert.equal(f.app.dashboardError, '');
});
test('late response cannot display after rapid filter edits, owner replacement, invalidation or stale version', async () => {
    for (const change of ['filters', 'owner', 'invalidation']) {
        const f = fixture(); const pending = f.app.applyDashboardFilters(); await tick();
        if (change === 'filters') { f.app.dashboardFilters.query = 'new'; f.app.dashboardFilterChanged(); }
        if (change === 'owner') { f.context.appUser = { ...owner, identityId: '10000000-0000-4000-8000-000000000012' }; f.context.sessionToken = 'new-token'; }
        if (change === 'invalidation') f.app.invalidateSession();
        respond(f, 0, { success: true, dashboard: report(f.requests[0].payload.filters) }); await pending;
        assert.equal(f.app.dashboardReport, null); assert.equal(f.app.dashboardInventory, null);
    }
    const f = fixture(); f.context.AppVersionGuard.blockIfStale = async () => true; await f.app.applyDashboardFilters();
    assert.equal(f.requests.length, 0); assert.ok(f.app.dashboardError);
    f.context.AppVersionGuard.blockIfStale = async () => false; f.app.isAuthorized = false; await f.app.applyDashboardFilters(); assert.equal(f.requests.length, 0);
});
test('report authorization denial clears private state; pending mutation prevents an inconsistent report query', async () => {
    for (const status of [401, 403]) {
        const f = fixture(); await load(f);
        const pending = f.app.applyDashboardFilters(); await tick(); respond(f, 1, { success: false, error: 'permission_denied' }, status); await pending;
        assert.equal(f.app.isAuthorized, false); assert.equal(f.app.dashboardInventory, null); assert.equal(f.app.dashboardOptions.users.length, 0);
        await f.app.applyDashboardFilters(); assert.equal(f.requests.length, 2);
    }
    const f = fixture(); f.app.dataMutationPending = true; await f.app.applyDashboardFilters(); assert.equal(f.requests.length, 0); assert.ok(f.app.dashboardError.includes('กำลังบันทึก'));
    f.app.dataMutationPending = false; f.app.dashboardFilters.user = ''; await load(f); assert.equal(f.requests[0].payload.filters.user, '');
});
test('complete CSV requests every stable page, preserves multiline quotes, neutralizes formulas and includes all identities', async () => {
    const f = fixture(); await load(f);
    const pending = f.app.exportDashboardCSV(); await tick();
    for (let page = 0; page < 3; page++) {
        const request = f.requests[page + 1]; assert.equal(request.payload.filters.offset, page * 100); assert.equal(request.payload.filters.snapshotToken, snapshotToken);
        respond(f, page + 1, { success: true, dashboard: report(request.payload.filters) }); await tick();
    }
    await pending; assert.equal(f.downloads.length, 1); assert.equal(f.app.dashboardExportProgress, 205);
    const csv = decodeURIComponent(f.downloads[0].href.split(',').slice(1).join(','));
    for (const row of records) assert.equal(csv.split('"' + row.id + '"').length - 1, 1);
    assert.ok(csv.includes('"\'=HYPERLINK(""bad""),\nOld product"')); assert.ok(csv.includes('"\'@danger,""quoted"""'));
    assert.ok(csv.includes('"-2"')); assert.ok(csv.includes('ไม่ระบุหน่วยเดิม')); assert.ok(csv.includes('gr-old')); assert.ok(csv.startsWith('\uFEFF'));
});
test('CSV cancels on filter/session changes and refuses changed snapshots, duplicates or incomplete result', async () => {
    for (const mode of ['filters', 'session', 'snapshot', 'duplicate', 'incomplete', 'deleted']) {
        const f = fixture(); await load(f); const pending = f.app.exportDashboardCSV(); await tick();
        if (mode === 'filters') f.app.dashboardFilterChanged();
        if (mode === 'session') f.app.invalidateSession();
        let data = report(f.requests[1].payload.filters);
        if (mode === 'snapshot') data.snapshotToken = 'different';
        if (mode === 'duplicate') data.history[1] = data.history[0];
        if (mode === 'incomplete') data.page.hasMore = false;
        respond(f, 1, mode === 'deleted' ? { success: false, error: 'dashboard_snapshot_changed' } : { success: true, dashboard: data }); await pending;
        assert.equal(f.downloads.length, 0); assert.equal(f.app.dashboardExporting, false);
        if (!['filters', 'session'].includes(mode)) assert.ok(f.app.dashboardExportError);
    }
});
test('trend grouping covers full daily response without a hidden truncated tail', () => {
    const f = fixture(); f.app.dashboardReport = report({});
    f.app.dashboardReport.trends = Array.from({ length: 60 }, (_, index) => ({ date: new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10), movementCount: 3, inCount: 1, outCount: 1, adjustCount: 1 }));
    assert.equal(f.app.dashboardTrendLabel, 'รายเดือน'); assert.equal(f.app.dashboardTrends.reduce((sum, row) => sum + row.movementCount, 0), 180);
    assert.equal(f.app.dashboardTrendMax, 93);
    assert.equal(f.app.dashboardTrendBars.reduce((sum, row) => sum + row.movementCount, 0), 180);
    assert.equal(f.app.dashboardTrendBars.length, f.app.dashboardTrends.length);
    f.app.dashboardTrendBars.forEach(bar => {
        assert.equal(bar.segments.reduce((sum, segment) => sum + segment.count, 0), bar.movementCount);
        assert.ok(Math.abs(bar.segments.reduce((sum, segment) => sum + segment.height, 0) - bar.height) < 1e-9);
        assert.equal(bar.segments.map(segment => segment.type).join(','), 'in,out,adjust');
        assert.equal(bar.segments[0].count, bar.inCount); assert.equal(bar.segments[1].count, bar.outCount); assert.equal(bar.segments[2].count, bar.adjustCount);
    });
    assert.equal(f.app.dashboardTrendDateLabels.length, 2);
    assert.equal(f.app.dashboardTrendDateLabels[0].position, 25); assert.equal(f.app.dashboardTrendDateLabels[1].position, 75);
    f.app.dashboardTrendDateLabels.forEach((label, index) => { const bar = f.app.dashboardTrendBars[index]; assert.equal(label.position, (bar.x + bar.width / 2) / 1000 * 100); assert.equal(label.transform, 'translateX(-50%)'); });
    f.app.dashboardTrendDate = '2026-08'; assert.equal(f.app.dashboardSelectedTrend.movementCount, 93);
    assert.equal(f.app.dashboardSelectedTrend.inCount, 31); assert.equal(f.app.dashboardSelectedTrend.outCount, 31); assert.equal(f.app.dashboardSelectedTrend.adjustCount, 31);
});
test('compact trend retains every daily period with sparse labels and exact selectable details; missing selection resets to latest', async () => {
    const f = fixture(); await load(f);
    const daily = Array.from({ length: 29 }, (_, index) => ({ date: '2026-09-' + String(index + 1).padStart(2, '0'), movementCount: index + 3, inCount: index, outCount: 1, adjustCount: 2 }));
    f.app.dashboardReport.trends = daily; f.app.resetDashboardTrendSelection();
    assert.equal(f.app.dashboardTrendLabel, 'รายวัน'); assert.equal(f.app.dashboardTrendBars.length, 29);
    assert.equal(f.app.dashboardTrendBars.reduce((sum, row) => sum + row.movementCount, 0), daily.reduce((sum, row) => sum + row.movementCount, 0));
    f.app.dashboardTrendBars.forEach(bar => {
        assert.equal(bar.segments.reduce((sum, segment) => sum + segment.count, 0), bar.movementCount);
        assert.ok(Math.abs(bar.segments.reduce((sum, segment) => sum + segment.height, 0) - bar.height) < 1e-9);
        assert.ok(bar.segments.every(segment => segment.count > 0 && segment.height > 0));
        assert.ok(Math.abs(bar.segments[bar.segments.length - 1].y - bar.y) < 1e-9);
    });
    assert.equal(f.app.dashboardTrendBars[0].segments.map(segment => segment.type).join(','), 'out,adjust');
    assert.equal(f.app.dashboardTrendDateLabels.length, 5); assert.equal(f.app.dashboardTrendDateLabels[0].date, daily[0].date); assert.equal(f.app.dashboardTrendDateLabels[4].date, daily[28].date);
    assert.equal(f.app.dashboardTrendDate, '2026-09-29');
    f.app.dashboardTrendDate = '2026-09-04';
    assert.equal(f.app.dashboardSelectedTrend.movementCount, 6); assert.equal(f.app.dashboardSelectedTrend.inCount, 3); assert.equal(f.app.dashboardSelectedTrend.outCount, 1); assert.equal(f.app.dashboardSelectedTrend.adjustCount, 2);
    f.app.dashboardTrendDate = 'missing-period'; f.app.resetDashboardTrendSelection(); assert.equal(f.app.dashboardTrendDate, '2026-09-29');
    f.app.dashboardFilterChanged(); assert.equal(f.app.dashboardTrendDate, ''); assert.equal(f.app.dashboardSelectedTrend, null); assert.equal(f.app.dashboardTrendBars.length, 0);
    await load(f); assert.equal(f.app.dashboardTrendDate, '2026-10-09'); assert.equal(f.app.dashboardSelectedTrend.movementCount, 205);
    f.app.dashboardReport.trends = [{ date: '2026-10-10', movementCount: 5, inCount: 0, outCount: 5, adjustCount: 0 }];
    assert.equal(f.app.dashboardTrendBars[0].segments.length, 1); assert.equal(f.app.dashboardTrendBars[0].segments[0].type, 'out');
    assert.equal(f.app.dashboardTrendBars[0].segments[0].height, 160); assert.equal(f.app.dashboardTrendBars[0].segments[0].y, 0);
    f.app.dashboardReport.trends = []; f.app.resetDashboardTrendSelection(); assert.equal(f.app.dashboardTrendDate, ''); assert.equal(f.app.dashboardTrendDateLabels.length, 0);
});
