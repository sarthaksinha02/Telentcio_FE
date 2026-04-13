export const createCachePayload = (data, fingerprint, meta = {}) => ({
    data,
    fingerprint,
    cachedAt: Date.now(),
    ...meta
});

export const readSessionCache = (key) => {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        sessionStorage.removeItem(key);
        return null;
    }
};

export const isCacheFresh = (payload, ttlMs) => {
    if (!payload?.cachedAt || !ttlMs) return false;
    return (Date.now() - payload.cachedAt) < ttlMs;
};
