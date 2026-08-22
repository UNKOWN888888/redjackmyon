    // ========== iframe 포함 탐색 ==========
    // [1.39] getAllDocuments 마이크로 캐시 — 같은 사이클(검증 polling 등) 안에서
    //        여러 번 호출될 때 frame 재귀 비용을 한 번으로 압축. TTL 매우 짧음.
    let _docsCache = null;
    let _docsCacheAt = 0;
    function getAllDocuments() {
        const now = Date.now();
        if (_docsCache && now - _docsCacheAt < DOM_MICRO_CACHE_MS) return _docsCache;
        const docs = [document];
        function recurse(win) {
            for (let i = 0; i < win.frames.length; i++) {
                try {
                    const childWin = win.frames[i];
                    const childDoc = childWin.document;
                    if (childDoc) { docs.push(childDoc); recurse(childWin); }
                } catch (e) {}
            }
        }
        recurse(window);
        _docsCache = docs;
        _docsCacheAt = now;
        return docs;
    }

    function qsDeep(selector) {
        for (const doc of getAllDocuments()) {
            const el = doc.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    function qsaDeep(selector) {
        const results = [];
        for (const doc of getAllDocuments()) {
            results.push(...doc.querySelectorAll(selector));
        }
        return results;
    }

    let _visibleMainBetSeatsCache = null;
    let _visibleMainBetSeatsCacheAt = 0;
    let _yellowSeatRayNumbersCache = null;
    let _yellowSeatRayNumbersCacheAt = 0;
    let _chipDetectCache = null;
    let _chipDetectCacheAt = 0;
    let _sitPromptVisibleCache = null;
    let _sitPromptVisibleCacheAt = 0;
    let _autoplayButtonCache = null;
    let _autoplayButtonCacheAt = 0;
    let _roundNumberCache = null;
    let _roundNumberCacheAt = 0;
    const _seatByNumberCache = new Map();
    const _seatBetStateCache = new Map();
    const _seatCloseButtonCache = new Map();

    function invalidateDynamicCaches() {
        _betWinCache = null;
        _betWinCacheAt = 0;
        _visibleMainBetSeatsCache = null;
        _visibleMainBetSeatsCacheAt = 0;
        _yellowSeatRayNumbersCache = null;
        _yellowSeatRayNumbersCacheAt = 0;
        _chipDetectCache = null;
        _chipDetectCacheAt = 0;
        _sitPromptVisibleCache = null;
        _sitPromptVisibleCacheAt = 0;
        _autoplayButtonCache = null;
        _autoplayButtonCacheAt = 0;
        _roundNumberCache = null;
        _roundNumberCacheAt = 0;
        _seatByNumberCache.clear();
        _trustedRememberedSeatNumbersCache = null;
        _trustedRememberedSeatNumbersCacheAt = 0;
        _trustedRememberedSeatNumbersCacheKey = '';
        _seatBetStateCache.clear();
        _seatCloseButtonCache.clear();
    }

    function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const win = el.ownerDocument.defaultView || window;
        const style = win.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
        return true;
    }
