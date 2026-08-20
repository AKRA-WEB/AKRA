/**
 * ============================================================================
 * AKRA W5 (STOCK ADJUSTMENTS) SUPABASE API CLIENT
 * Status: DEACTIVATED / CONTAINED for Security Hardening (Plan 20260820-004)
 * Stock adjustment operations execute via authoritative backend (GAS).
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
        KEY: ''
    };

    return {
        recordStockAdjustment: async () => { throw new Error('Supabase W5 client deactivated. Falling back to GAS.'); },
        getAdjustmentHistory: async () => { throw new Error('Supabase W5 client deactivated. Falling back to GAS.'); }
    };
}));
