/**
 * ============================================================================
 * AKRA W5 SUPABASE API CLIENT
 * All reads and mutations use the authenticated akra-api Edge boundary.
 * The client never talks to a legacy provider or directly to W5 tables.
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
        URL: 'https://hgxrrskztbpejirrdpbq.supabase.co'
    };

    function resolveToken(token) {
        if (String(token || '').trim()) return String(token).trim();
        try {
            const embeddedToken = root.AkraModule?.getToken?.();
            if (embeddedToken) return String(embeddedToken).trim();
        } catch (_) { /* The caller receives the same fail-closed auth error. */ }
        throw new Error('authenticated Main session required');
    }

    async function request(action, payload, token) {
        const authToken = resolveToken(token);
        const response = await fetch(`${SUPABASE_CONFIG.URL}/functions/v1/akra-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, token: authToken, ...(payload || {}) })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            const error = new Error(data.error || data.reason || `W5 request failed: ${response.status}`);
            error.status = response.status;
            error.reason = data.error || data.reason;
            throw error;
        }
        return data;
    }

    return {
        getData: token => request('getData', {}, token),
        mutate: (action, payload, token) => request(action, payload, token),
        recordStockAdjustment: async (adjustment, token) => {
            if (!adjustment || !Number.isSafeInteger(Number(adjustment.productId))
                || !Number.isSafeInteger(Number(adjustment.newStock)) || Number(adjustment.newStock) < 0) {
                throw new Error('invalid_stock_adjustment');
            }
            const data = await request('adjustStock', {
                productId: Number(adjustment.productId),
                productName: String(adjustment.productName || ''),
                newStock: Number(adjustment.newStock),
                user: String(adjustment.user || '')
            }, token);
            return { status: 'success', ...data };
        },
        getAdjustmentHistory: async (token, limit = 150) => {
            const cappedLimit = Number(limit);
            if (!Number.isSafeInteger(cappedLimit) || cappedLimit < 1 || cappedLimit > 150) throw new Error('invalid_history_limit');
            const data = await request('getData', {}, token);
            const history = Array.isArray(data.history) ? data.history.filter(row => row?.type === 'adjust').slice(-cappedLimit) : [];
            return { status: 'success', history };
        }
    };
}));
