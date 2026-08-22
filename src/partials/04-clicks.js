    // ========== 클릭 ==========
    function fireFullClick(element, x, y, options = {}) {
        if (!element) return false;
        const win = element.ownerDocument.defaultView || window;
        const PE = win.PointerEvent || PointerEvent;
        const ME = win.MouseEvent || MouseEvent;
        const TE = win.TouchEvent || (typeof TouchEvent !== 'undefined' ? TouchEvent : null);
        const profile = options.profile || 'hybrid';
        const isTouchProfile = profile === 'touch';
        const useMouse = profile !== 'touch';
        const useTouch = profile !== 'mouse' && options.touch !== false;
        const base = {
            bubbles: true, cancelable: true, composed: true,
            view: win, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 1,
        };
        const pointerBase = { ...base, pointerId: 1, pointerType: isTouchProfile ? 'touch' : 'mouse', isPrimary: true, width: 1, height: 1, pressure: 0.5 };
        try {
            element.dispatchEvent(new PE('pointerover',  pointerBase));
            element.dispatchEvent(new PE('pointerenter', pointerBase));
            if (useMouse) {
                element.dispatchEvent(new ME('mouseover',    base));
                element.dispatchEvent(new ME('mouseenter',   base));
            }
            element.dispatchEvent(new PE('pointerdown',  pointerBase));
            if (useMouse) element.dispatchEvent(new ME('mousedown', base));
            if (useTouch && TE && win.Touch) {
                try {
                    const touch = new win.Touch({
                        identifier: 1, target: element,
                        clientX: x, clientY: y, screenX: x, screenY: y,
                        radiusX: 1, radiusY: 1, force: 0.5,
                    });
                    element.dispatchEvent(new TE('touchstart', { bubbles: true, cancelable: true, composed: true, view: win, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
                    element.dispatchEvent(new TE('touchend',   { bubbles: true, cancelable: true, composed: true, view: win, touches: [], targetTouches: [], changedTouches: [touch] }));
                } catch (_) {}
            }
            element.dispatchEvent(new PE('pointerup',  { ...pointerBase, buttons: 0, pressure: 0 }));
            if (useMouse) element.dispatchEvent(new ME('mouseup', { ...base, buttons: 0 }));
            element.dispatchEvent(new ME('click',      { ...base, buttons: 0 }));
            if (options.nativeClick && typeof element.click === 'function') {
                try { element.click(); } catch (_) {}
            }
            return true;
        } catch (e) {
            console.warn('[AutoTrigger] fireFullClick failed', e);
            try { element.click(); return true; } catch (_) { return false; }
        }
    }

    function normalizeClickTarget(element) {
        const closeMarker = element?.closest?.(SEAT_CLOSE_ICON_SELECTOR);
        if (closeMarker) {
            return closeMarker.closest?.('button') || closeMarker.closest?.('[role="button"]') || closeMarker;
        }
        return element?.closest?.('button,[role="button"],[data-testid="chip"],[data-testid^="mainbetSeat_"],[data-testid="deal_now"],[data-id="no"]') || element;
    }

    function robustClick(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const doc = element.ownerDocument;
        const normalizedElement = normalizeClickTarget(element);
        const singleActionSelector = 'button,[role="button"],[data-testid="autoplay-button"],[data-testid="autoplay-control-button"],[data-testid^="autoplay-start-button-"],[data-testid="modal-close-button"],[data-testid="deal_now"],[data-id="no"],[data-testid^="chip-stack-value-"]';
        if (normalizedElement?.matches?.(singleActionSelector)) {
            const success = fireFullClick(normalizedElement, x, y, { nativeClick: true });
            if (success) invalidateDynamicCaches();
            return success;
        }

        const topEl = normalizeClickTarget(doc.elementFromPoint(x, y));
        const targets = new Set();
        if (topEl) targets.add(topEl);
        targets.add(normalizedElement);

        const directSelector = '[data-testid="chip"],[data-testid^="mainbetSeat_"]';
        const directClick = normalizedElement?.matches?.(directSelector);
        if (!directClick) {
            Array.from(element.querySelectorAll('button,[role="button"],[data-testid="chip"],svg[data-testid],span[data-testid]'))
                .slice(0, 12)
                .forEach(child => {
                    const target = normalizeClickTarget(child);
                    if (target && isVisible(target)) targets.add(target);
                });
        }
        let success = false;
        for (const t of targets) {
            const nativeClick = !!t?.matches?.('button,[role="button"],[data-testid="chip"],[data-testid^="chip-stack-value-"],[data-testid="autoplay-button"],[data-id="no"]');
            if (fireFullClick(t, x, y, { nativeClick })) success = true;
        }
        if (success) invalidateDynamicCaches();
        return success;
    }

    function getElementLabel(el) {
        if (!el) return 'null';
        const tid = el.getAttribute?.('data-testid');
        if (tid) return tid;
        const tag = el.tagName?.toLowerCase?.() || 'el';
        const role = el.getAttribute?.('role');
        return role ? `${tag}[role=${role}]` : tag;
    }

    function markBetClickDebug(label) {
        lastBetClickDebug = label || '';
        lastBetClickDebugAt = Date.now();
    }

    function pointInsideRect(rect, x, y, pad = 2) {
        return x >= rect.left - pad && x <= rect.right + pad &&
            y >= rect.top - pad && y <= rect.bottom + pad;
    }

    function getSafeBetClickPoints(element) {
        const rect = element.getBoundingClientRect();
        const closeRects = Array.from(element.querySelectorAll?.(SEAT_CLOSE_ICON_SELECTOR) || [])
            .filter(isVisible)
            .map(el => el.getBoundingClientRect());
        const points = [
            [0.50, 0.50],
            [0.50, 0.58],
            [0.50, 0.44],
            [0.50, 0.66],
            [0.36, 0.58],
            [0.64, 0.58],
            [0.50, 0.72],
            [0.50, 0.30],
        ];
        const doc = element.ownerDocument || document;
        const win = doc.defaultView || window;
        const maxX = win.innerWidth || doc.documentElement.clientWidth || 0;
        const maxY = win.innerHeight || doc.documentElement.clientHeight || 0;
        const out = [];
        const seen = new Set();
        for (const [rx, ry] of points) {
            const x = rect.left + rect.width * rx;
            const y = rect.top + rect.height * ry;
            if (x < 0 || y < 0 || (maxX && x > maxX) || (maxY && y > maxY)) continue;
            if (closeRects.some(closeRect => pointInsideRect(closeRect, x, y, 4))) continue;
            const key = `${Math.round(x)}:${Math.round(y)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ x, y });
        }
        return out.length > 0 ? out : [{ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }];
    }

    function getSafeBetClickPoint(element) {
        return getSafeBetClickPoints(element)[0];
    }

    function getBetClickProbeLabel(element) {
        if (!element || !isVisible(element)) return 'probe=null';
        const point = getSafeBetClickPoint(element);
        const topEl = element.ownerDocument?.elementFromPoint?.(point.x, point.y);
        return `${Math.round(point.x)},${Math.round(point.y)}:${getElementLabel(topEl)}`;
    }

    function getBetClickProfile(attempt = 0) {
        return attempt % 2 === 0 ? 'touch' : 'mouse';
    }

    function normalizeBetClickTarget(element, boundary) {
        if (!element) return null;
        if (element.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return null;
        const candidate = element.closest?.('[data-testid^="seat_"],[data-testid^="mainbet_"],[data-testid^="mainbetSeat_"],[data-testid="chip"],[role="button"]') || element;
        if (candidate.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return null;
        if (boundary && !(boundary.contains?.(candidate) || candidate.contains?.(boundary))) return element;
        return candidate;
    }

    function addSafeBetClickTarget(targets, el, boundary = null) {
        if (!el || !isVisible(el)) return;
        if (el.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return;
        if (boundary && !(boundary.contains?.(el) || el.contains?.(boundary))) return;
        targets.add(el);
    }

    function addBetPointTargets(targets, element, x, y) {
        const doc = element.ownerDocument;
        const topEl = doc.elementFromPoint(x, y);
        addSafeBetClickTarget(targets, topEl);
        addSafeBetClickTarget(targets, normalizeBetClickTarget(topEl, element));
        addSafeBetClickTarget(targets, element, element);
        addSafeBetClickTarget(targets, normalizeBetClickTarget(element, element), element);

        for (let cur = topEl; cur && cur !== doc.body && cur !== doc.documentElement; cur = cur.parentElement) {
            if (cur.closest?.(SEAT_CLOSE_ICON_SELECTOR)) break;
            addSafeBetClickTarget(targets, cur);
            const tid = cur.getAttribute?.('data-testid') || '';
            if (/^(?:seat_|mainbet_|mainbetSeat_)\d+$/.test(tid)) break;
        }
    }

    function isSafeBetDispatchTarget(el) {
        if (!el || !isVisible(el)) return false;
        if (el.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return false;
        if (el.closest?.('#at-panel')) return false;
        if (el.closest?.('[data-testid="bottom-sheet-modal"],[data-testid="modal-header"],[data-testid="modal-body"]')) return false;
        if (el.closest?.('button[data-testid^="chip-stack-value-"]')) return false;
        if (el.closest?.('[data-testid="autoplay-button"],[data-testid="autoplay-control-button"]')) return false;
        return true;
    }

    function robustBetClick(element, options = {}) {
        if (!element || !isVisible(element)) return false;
        const points = getSafeBetClickPoints(element);
        const doc = element.ownerDocument || document;
        const attempt = Math.max(0, Math.floor(options.attempt || 0));
        const profile = options.profile || getBetClickProfile(attempt);
        const orderedPoints = points.length > 0
            ? points.slice(attempt % points.length).concat(points.slice(0, attempt % points.length))
            : points;

        for (const { x, y } of orderedPoints) {
            const topEl = doc.elementFromPoint?.(x, y);
            const candidates = [
                topEl,
                normalizeBetClickTarget(topEl, null),
                normalizeBetClickTarget(topEl, element),
                normalizeBetClickTarget(element, element),
                element,
            ];
            const target = candidates.find(isSafeBetDispatchTarget);
            if (!target) continue;

            if (lastBetClickDebug && Date.now() - lastBetClickDebugAt < 1000 && !/\sp\d+\/t\d+/.test(lastBetClickDebug)) {
                lastBetClickDebug += ` p1/${points.length} hit=${getElementLabel(topEl)} t=${getElementLabel(target)} ${profile}`;
                lastBetClickDebugAt = Date.now();
            }

            const success = fireFullClick(target, x, y, { profile, touch: profile === 'touch' });
            if (success) {
                invalidateDynamicCaches();
                return true;
            }
        }

        if (lastBetClickDebug && Date.now() - lastBetClickDebugAt < 1000 && !/\sp\d+\/t\d+/.test(lastBetClickDebug)) {
            lastBetClickDebug += ` p0/${points.length}`;
            lastBetClickDebugAt = Date.now();
        }
        return false;
    }
