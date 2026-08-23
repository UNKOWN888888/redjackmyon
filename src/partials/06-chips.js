    // ========== [1.15] 칩 자동 감지 + 분배 ==========
    function getChipStackButtonValue(el) {
        const btn = el?.closest?.('button[data-testid^="chip-stack-value-"]');
        const tid = btn?.getAttribute?.('data-testid') || '';
        const m = tid.match(/^chip-stack-value-(\d+)$/);
        const idValue = m ? parseInt(m[1], 10) : null;
        if (Number.isFinite(idValue) && idValue > 0) return idValue;
        const textValue = parseNumber(btn?.textContent);
        return Number.isFinite(textValue) && textValue > 0 ? textValue : null;
    }

    function isInsideBetSeat(el) {
        for (let cur = el; cur; cur = cur.parentElement) {
            const tid = cur.getAttribute?.('data-testid') || '';
            if (/^mainbet/.test(tid)) return true;
        }
        return false;
    }

    function getChipStackButtons() {
        return qsaDeep('button[data-testid^="chip-stack-value-"]')
            .filter(btn => isVisible(btn) && !isDisabledLike(btn) && Number.isFinite(getChipStackButtonValue(btn)));
    }

    function getTrayChips() {
        return qsaDeep('.oo_oA [data-testid="chip"]')
            .filter(chip => isVisible(chip) && !isInsideBetSeat(chip));
    }

    function getTrayChipValue(chip) {
        const strict = parseStrictChipAmount(chip?.textContent);
        if (Number.isFinite(strict) && strict > 0) return strict;
        return parseNumber(chip?.textContent) || parseMoneySum(chip?.textContent);
    }

    function addDetectedChipCandidate(map, value, element, priority) {
        const normalized = Math.floor(value);
        if (!Number.isFinite(normalized) || normalized <= 0 || !element) return;
        const clickTarget = element.closest?.('button[data-testid^="chip-stack-value-"]') || element;
        if (!clickTarget || !isVisible(clickTarget) || isDisabledLike(clickTarget)) return;

        const existing = map.get(normalized);
        if (!existing || priority < existing.priority) {
            map.set(normalized, { value: normalized, element: clickTarget, priority });
        }
    }

    function finishDetectedChips(map) {
        const arr = Array.from(map.values())
            .map(({ value, element }) => ({ value, element }))
            .sort((a, b) => b.value - a.value);
        if (arr.length > 0) cachedMinChipValue = arr[arr.length - 1].value;
        _chipDetectCache = arr;
        _chipDetectCacheAt = Date.now();
        return arr;
    }

    function getLooseChipValue(chip) {
        const stackValue = getChipStackButtonValue(chip);
        if (Number.isFinite(stackValue) && stackValue > 0) return stackValue;
        const strict = parseStrictChipAmount(chip?.textContent);
        if (Number.isFinite(strict) && strict > 0) return strict;
        return parseNumber(chip?.textContent);
    }

    function detectAvailableChips() {
        const now = Date.now();
        if (_chipDetectCache && now - _chipDetectCacheAt < CHIP_DETECT_CACHE_MS) return _chipDetectCache;

        const map = new Map();
        for (const chip of getTrayChips()) {
            addDetectedChipCandidate(map, getTrayChipValue(chip), chip, 0);
        }

        for (const btn of getChipStackButtons()) {
            addDetectedChipCandidate(map, getChipStackButtonValue(btn), btn, 1);
        }

        for (const chip of qsaDeep('[data-testid="chip"]')) {
            if (!isVisible(chip) || isInsideBetSeat(chip)) continue;
            const clickTarget = chip.closest?.('button[data-testid^="chip-stack-value-"]') || chip;
            addDetectedChipCandidate(map, getLooseChipValue(chip), clickTarget, 2);
        }

        return finishDetectedChips(map);
    }

    function findChipByValue(value) {
        const detected = detectAvailableChips().find(chip => chip.value === value);
        if (detected?.element && isVisible(detected.element) && !isDisabledLike(detected.element)) {
            return detected.element;
        }
        for (const chip of getTrayChips()) {
            if (getTrayChipValue(chip) === value) return chip;
        }
        for (const btn of getChipStackButtons()) {
            if (getChipStackButtonValue(btn) === value) return btn;
        }
        for (const chip of qsaDeep('[data-testid="chip"]')) {
            if (!isVisible(chip)) continue;
            if (isInsideBetSeat(chip)) continue;
            const clickTarget = chip.closest?.('button[data-testid^="chip-stack-value-"]') || chip;
            if (isDisabledLike(clickTarget)) continue;
            if (getLooseChipValue(chip) === value) return clickTarget;
        }
        return null;
    }

    function getTrayChipSelectionRoot(chip) {
        return chip?.parentElement?.parentElement?.parentElement || null;
    }

    function isTrayChipSelected(chip) {
        const root = getTrayChipSelectionRoot(chip);
        return !!(root && /\boo_ow\b/.test(root.className || ''));
    }

    function isStackChipButtonSelected(button) {
        if (!button) return false;
        const explicitValues = [
            button.getAttribute?.('aria-pressed'),
            button.getAttribute?.('aria-selected'),
            button.getAttribute?.('data-selected'),
            button.getAttribute?.('data-active'),
        ].map(value => String(value || '').toLowerCase());
        if (explicitValues.includes('true')) return true;

        const testId = button.getAttribute?.('data-testid') || '';
        const ring = testId
            ? button.querySelector?.(`[data-testid="${testId}-ring"]`)
            : null;
        return !!(ring && isVisible(ring));
    }

    function getSelectedStackChipAmount() {
        const selected = getChipStackButtons()
            .filter(isStackChipButtonSelected)
            .map(getChipStackButtonValue)
            .filter(value => Number.isFinite(value) && value > 0);
        const unique = Array.from(new Set(selected));
        return unique.length === 1 ? unique[0] : 0;
    }

    function getSelectedChipAmount() {
        const stackAmount = getSelectedStackChipAmount();
        if (stackAmount > 0) return stackAmount;
        for (const chip of getTrayChips()) {
            if (isTrayChipSelected(chip)) return getTrayChipValue(chip);
        }
        return 0;
    }

    function gcd(a, b) {
        let x = Math.abs(Math.floor(a || 0));
        let y = Math.abs(Math.floor(b || 0));
        while (y) {
            const t = x % y;
            x = y;
            y = t;
        }
        return x || 1;
    }

    function getUniqueSortedChips(availableChips) {
        const map = new Map();
        for (const chip of availableChips || []) {
            const value = Math.floor(chip?.value || 0);
            if (!Number.isFinite(value) || value <= 0) continue;
            if (!map.has(value)) map.set(value, { value, element: chip.element });
        }
        return Array.from(map.values()).sort((a, b) => b.value - a.value);
    }

    function planChipsGreedy(targetAmount, chips) {
        const plan = [];
        let remaining = Math.floor(targetAmount);
        for (const chip of chips) {
            if (remaining < chip.value) continue;
            const count = Math.floor(remaining / chip.value);
            if (count > 0) {
                plan.push({ value: chip.value, count, element: chip.element });
                remaining -= chip.value * count;
            }
        }
        const actualTotal = Math.floor(targetAmount) - remaining;
        return { plan, actualTotal, leftover: remaining };
    }

    // 좌석당 목표 이하에서 가능한 최대 금액을 계산한다.
    // 같은 금액이면 클릭 수가 적은 조합(예: 1,500×1 > 750×2)을 우선한다.
    // 초과는 절대 허용하지 않는다.
    function planChipsForAmount(targetAmount, availableChips) {
        const target = Math.floor(targetAmount);
        const chips = getUniqueSortedChips(availableChips).filter(chip => chip.value <= target);
        if (!Number.isFinite(target) || target <= 0 || chips.length === 0) {
            return { plan: [], actualTotal: 0, leftover: Math.max(0, target || 0) };
        }

        const unit = chips.reduce((acc, chip) => gcd(acc, chip.value), chips[0].value);
        const targetUnits = Math.floor(target / unit);
        const DP_UNIT_LIMIT = 20000;
        if (targetUnits <= 0) return { plan: [], actualTotal: 0, leftover: target };
        if (targetUnits > DP_UNIT_LIMIT) return planChipsGreedy(target, chips);

        const unitChips = chips.map(chip => ({ ...chip, units: Math.floor(chip.value / unit) }));
        const inf = Number.MAX_SAFE_INTEGER;
        const dp = new Array(targetUnits + 1).fill(inf);
        const prev = new Array(targetUnits + 1).fill(-1);
        dp[0] = 0;

        for (let amount = 1; amount <= targetUnits; amount++) {
            for (let i = 0; i < unitChips.length; i++) {
                const chip = unitChips[i];
                if (chip.units > amount || dp[amount - chip.units] === inf) continue;
                const candidateClicks = dp[amount - chip.units] + 1;
                if (candidateClicks < dp[amount]) {
                    dp[amount] = candidateClicks;
                    prev[amount] = i;
                }
            }
        }

        let bestUnits = targetUnits;
        while (bestUnits > 0 && dp[bestUnits] === inf) bestUnits--;
        if (bestUnits <= 0) return { plan: [], actualTotal: 0, leftover: target };

        const counts = new Map();
        for (let cur = bestUnits; cur > 0;) {
            const chipIndex = prev[cur];
            if (chipIndex < 0) break;
            const chip = unitChips[chipIndex];
            counts.set(chip.value, (counts.get(chip.value) || 0) + 1);
            cur -= chip.units;
        }

        const plan = chips
            .filter(chip => counts.has(chip.value))
            .map(chip => ({ value: chip.value, count: counts.get(chip.value), element: chip.element }));
        const actualTotal = bestUnits * unit;
        return { plan, actualTotal, leftover: target - actualTotal };
    }

    function getChipPlanTotal(chipPlan) {
        return (chipPlan || []).reduce((sum, chip) => sum + (chip.value * chip.count), 0);
    }

    function combineChipPlan(chipPlan, orderChips) {
        const counts = new Map();
        for (const spec of chipPlan || []) {
            const value = Math.floor(spec?.value || 0);
            const count = Math.floor(spec?.count || 0);
            if (!Number.isFinite(value) || value <= 0 || count <= 0) continue;
            counts.set(value, (counts.get(value) || 0) + count);
        }
        const order = getUniqueSortedChips(orderChips || chipPlan || []);
        const orderedValues = new Set(order.map(chip => chip.value));
        const out = order
            .filter(chip => counts.has(chip.value))
            .map(chip => ({ value: chip.value, count: counts.get(chip.value), element: chip.element }));
        for (const [value, count] of Array.from(counts.entries()).sort((a, b) => b[0] - a[0])) {
            if (!orderedValues.has(value)) out.push({ value, count, element: findChipByValue(value) });
        }
        return out;
    }

    function getSelectableChipsForPlan(availableChips) {
        return getUniqueSortedChips(availableChips)
            .map(chip => {
                const element = findChipByValue(chip.value);
                return element ? { value: chip.value, element } : null;
            })
            .filter(Boolean);
    }

    function makeSelectableChipPlan(chipPlan, availableChips) {
        if (!chipPlan || chipPlan.length === 0) return [];
        const selectableChips = getSelectableChipsForPlan(availableChips);
        if (selectableChips.length === 0) return null;

        const expanded = [];
        for (const spec of chipPlan) {
            const exact = selectableChips.find(chip => chip.value === spec.value);
            if (exact) {
                expanded.push({ value: exact.value, count: spec.count, element: exact.element });
                continue;
            }

            const fallbackChips = selectableChips.filter(chip => chip.value !== spec.value);
            const fallback = planChipsForAmount(spec.value, fallbackChips);
            if (fallback.actualTotal !== spec.value || fallback.plan.length === 0) {
                console.warn(`[AutoTrigger] selectable chip fallback failed: ${formatMoney(spec.value)} from [${selectableChips.map(c => formatMoney(c.value)).join(', ')}]`);
                return null;
            }
            for (const fallbackSpec of fallback.plan) {
                expanded.push({
                    value: fallbackSpec.value,
                    count: fallbackSpec.count * spec.count,
                    element: fallbackSpec.element,
                });
            }
        }

        return combineChipPlan(expanded, selectableChips);
    }
