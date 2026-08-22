    // ========== [1.15] 좌석 plan ==========
    function getChipPlanClickCount(chipPlan) {
        return (chipPlan || []).reduce((sum, chip) => sum + (chip.count || 0), 0);
    }

    function buildSeatPlanForCount(used, requested, available, totalTarget, availableChips) {
        if (used <= 0) {
            return {
                requested, used: 0, available, totalTarget,
                perSeatTarget: 0, perSeatActual: 0, totalActual: 0,
                chipPlan: [], availableChips, autoSeatCount: AUTO_SEAT_COUNT,
            };
        }
        const perSeatTarget = Math.floor(totalTarget / used);
        const { plan: rawChipPlan, actualTotal: perSeatActual } = planChipsForAmount(perSeatTarget, availableChips);
        const selectableChipPlan = makeSelectableChipPlan(rawChipPlan, availableChips);
        const chipPlan = selectableChipPlan && getChipPlanTotal(selectableChipPlan) === perSeatActual
            ? selectableChipPlan
            : rawChipPlan;
        const totalActual = perSeatActual * used;
        return {
            requested, used, available, totalTarget,
            perSeatTarget, perSeatActual, totalActual,
            chipPlan, availableChips, autoSeatCount: AUTO_SEAT_COUNT,
        };
    }

    function isBetterSeatPlan(candidate, current) {
        if (!current) return true;
        if (candidate.totalActual !== current.totalActual) return candidate.totalActual > current.totalActual;
        if (candidate.totalActual > 0 && candidate.used !== current.used) return candidate.used > current.used;
        // 메인 베팅은 한 좌석 클릭이 착석한 전체 좌석에 브로드캐스트되므로 실제 클릭 수는 좌석 수를 곱하지 않는다.
        const candidateClicks = getChipPlanClickCount(candidate.chipPlan);
        const currentClicks = getChipPlanClickCount(current.chipPlan);
        if (candidateClicks !== currentClicks) return candidateClicks < currentClicks;
        return candidate.used < current.used;
    }

    function getSeatPlan(availableSeatCount, providedChips) {
        const requested = getMaxSeatCount();
        const available = Math.max(0, availableSeatCount || 0);
        const totalTarget = TARGET_BET_AMOUNT;
        const availableChips = providedChips ?? detectAvailableChips();
        const maxUsable = Math.min(requested, available);

        if (maxUsable <= 0 || availableChips.length === 0) {
            return buildSeatPlanForCount(0, requested, available, totalTarget, availableChips);
        }

        if (!AUTO_SEAT_COUNT) {
            return buildSeatPlanForCount(maxUsable, requested, available, totalTarget, availableChips);
        }

        const autoSearchMax = Number.isFinite(forcedAutoSeatCount) && forcedAutoSeatCount > 0
            ? Math.min(maxUsable, toInt(forcedAutoSeatCount, maxUsable, 1, 7))
            : maxUsable;
        let best = null;
        for (let seats = 1; seats <= autoSearchMax; seats++) {
            const candidate = buildSeatPlanForCount(seats, requested, available, totalTarget, availableChips);
            if (isBetterSeatPlan(candidate, best)) best = candidate;
        }
        return best || buildSeatPlanForCount(0, requested, available, totalTarget, availableChips);
    }
