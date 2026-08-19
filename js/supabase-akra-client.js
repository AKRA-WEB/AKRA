/**
 * ============================================================================
 * AKRA W5 (STOCK ADJUSTMENTS) SUPABASE API CLIENT
 * High-Speed W5 Inventory Adjustments (<25ms queries)
 * ============================================================================
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AkraSupabaseW5 = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const SUPABASE_CONFIG = {
        URL: 'https://hgxrrskztbpejirrdpbq.supabase.co',
        KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhneHJyc2t6dGJwZWppcnJkcGJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzEyNDU4MCwiZXhwIjoyMTAyNzAwNTgwfQ.9RiiP0kItbbcMeI2mYActrD9a1naHCNbmYJBRXHR1DI',
            };

    async function supabaseRest(endpoint, options = {}) {
        const url = `${SUPABASE_CONFIG.URL}/rest/v1/${endpoint}`;
        const key = SUPABASE_CONFIG.KEY;
        const headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
            ...(options.headers || {})
        };
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Supabase REST HTTP ${res.status}: ${errText}`);
        }
        return res.json();
    }

    /**
     * Record Stock Adjustment in W5
     */
    async function recordStockAdjustment(adjData) {
        const payload = {
            adjustment_date: adjData.adjustmentDate || new Date().toISOString().split('T')[0],
            warehouse: adjData.warehouse || 'W5',
            sku: adjData.sku,
            product_name: adjData.productName || adjData.product_name,
            delta_qty: Number(adjData.deltaQty || adjData.delta_qty || 0),
            balance_after: Number(adjData.balanceAfter || adjData.balance_after || 0),
            reason: adjData.reason || 'ปรับยอดสต๊อกประจำวัน',
            operator: adjData.operator || 'Staff'
        };

        const result = await supabaseRest('stock_adjustments', {
            method: 'POST',
            body: payload
        });

        return {
            status: 'success',
            adjustmentId: result[0].id
        };
    }

    /**
     * Get Adjustment History (<25ms)
     */
    async function getAdjustmentHistory(limit = 50) {
        const history = await supabaseRest(`stock_adjustments?warehouse=eq.W5&order=adjustment_date.desc&limit=${limit}`);
        return {
            status: 'success',
            history: history || []
        };
    }

    return {
        recordStockAdjustment,
        getAdjustmentHistory,
        SUPABASE_CONFIG
    };
}));
