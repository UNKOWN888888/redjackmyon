    // ========== 좌석 ==========
    function getSeatNumber(seat) {
        if (!seat) return 999;
        const tid = seat.getAttribute?.('data-testid') || '';
        const direct = tid.match(/^(?:mainbetSeat_|mainbet_|seat_)(\d+)$/);
        if (direct) return parseInt(direct[1], 10);

        const container = getSeatContainer(seat);
        const containerNumber = getSeatContainerNumber(container);
        if (containerNumber !== null) return containerNumber;

        for (let cur = seat.parentElement; cur; cur = cur.parentElement) {
            const parentTid = cur.getAttribute?.('data-testid') || '';
            const m = parentTid.match(/^(?:mainbetSeat_|mainbet_|seat_)(\d+)$/);
            if (m) return parseInt(m[1], 10);
        }
        return 999;
    }

    function getSeatContainerByNumber(n) {
        const seatNumber = normalizeSeatNumber(n);
        return seatNumber === null ? null : qsDeep(`[data-testid="seat_${seatNumber}"]`);
    }

    function getSeatByNumber(n) {
        const seatNumber = normalizeSeatNumber(n);
        if (seatNumber === null) return null;
        const cacheKey = `seat-by:${seatNumber}`;
        const cached = _seatByNumberCache.get(cacheKey);
        if (cached && Date.now() - cached.at < DYNAMIC_DOM_CACHE_MS) return cached.value;

        const directCandidates = qsaDeep(`[data-testid="mainbetSeat_${seatNumber}"]`);
        const visibleDirect = directCandidates.find(isVisible);
        if (visibleDirect) {
            _seatByNumberCache.set(cacheKey, { at: Date.now(), value: visibleDirect });
            return visibleDirect;
        }
        const hiddenDirectFallback = directCandidates[0] || null;
        let hiddenContainerFallback = null;

        const container = getSeatContainerByNumber(seatNumber);
        if (container) {
            const exactCandidates = Array.from(container.querySelectorAll?.(`[data-testid="mainbetSeat_${seatNumber}"]`) || []);
            const exact = exactCandidates.find(isVisible);
            if (exact) {
                _seatByNumberCache.set(cacheKey, { at: Date.now(), value: exact });
                return exact;
            }
            hiddenContainerFallback = exactCandidates[0] || null;

            const nested = Array.from(container.querySelectorAll?.('[data-testid^="mainbetSeat_"]') || [])
                .find(el => getSeatNumber(el) === seatNumber && isVisible(el));
            if (nested) {
                _seatByNumberCache.set(cacheKey, { at: Date.now(), value: nested });
                return nested;
            }
        }

        const mainbet = qsDeep(`[data-testid="mainbet_${seatNumber}"]`);
        const inMainbetCandidates = Array.from(mainbet?.querySelectorAll?.(`[data-testid="mainbetSeat_${seatNumber}"]`) || []);
        const inMainbet = inMainbetCandidates.find(isVisible) || inMainbetCandidates[0] || null;
        if (inMainbet) {
            _seatByNumberCache.set(cacheKey, { at: Date.now(), value: inMainbet });
            return inMainbet;
        }

        const fallback = hiddenContainerFallback || hiddenDirectFallback;
        _seatByNumberCache.set(cacheKey, { at: Date.now(), value: fallback });
        return fallback;
    }

    function getSeatContainer(seat) {
        for (let cur = seat; cur; cur = cur.parentElement) {
            const tid = cur.getAttribute?.('data-testid') || '';
            if (/^seat_\d+$/.test(tid)) return cur;
        }
        return null;
    }

    function getSeatContainerNumber(container) {
        const m = (container?.getAttribute?.('data-testid') || '').match(/^seat_(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
    }

    function hasYellowSeatRay(container) {
        if (!container || !isVisible(container)) return false;
        const ray = container.querySelector?.('[data-testid="seat-ray-icon"]');
        if (!ray || !isVisible(ray)) return false;

        const yellowColorRe = /(?:#ffd500|rgb\(\s*255\s*,\s*213\s*,\s*0\s*\)|rgba\(\s*255\s*,\s*213\s*,\s*0\s*,)/i;
        const rendered = Array.from(ray.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line'));
        const activeGradientIds = [];

        for (const el of rendered) {
            const fill = String(el.getAttribute('fill') || '');
            const stroke = String(el.getAttribute('stroke') || '');
            const style = String(el.getAttribute('style') || '');
            if (yellowColorRe.test(fill) || yellowColorRe.test(stroke) || yellowColorRe.test(style)) return true;

            for (const value of [fill, stroke]) {
                const m = value.match(/url\(["']?#([^)'" ]+)["']?\)/i);
                if (m) activeGradientIds.push(m[1]);
            }
        }

        return Array.from(ray.querySelectorAll('linearGradient,radialGradient')).some(gradient => {
            const id = gradient.getAttribute('id');
            return activeGradientIds.includes(id) && yellowColorRe.test(String(gradient.outerHTML || ''));
        });
    }

    function getYellowSeatRayNumbers() {
        const now = Date.now();
        if (_yellowSeatRayNumbersCache && now - _yellowSeatRayNumbersCacheAt < DYNAMIC_DOM_CACHE_MS) {
            return _yellowSeatRayNumbersCache;
        }
        const numbers = uniqueSortedSeatNumbers(
            qsaDeep('[data-testid^="seat_"]')
                .filter(seat => {
                    const n = getSeatContainerNumber(seat);
                    return n >= 1 && n <= 7 && hasYellowSeatRay(seat);
                })
                .map(getSeatContainerNumber)
        );
        _yellowSeatRayNumbersCache = numbers;
        _yellowSeatRayNumbersCacheAt = Date.now();
        return numbers;
    }

    function getKnownSeatNumbers() {
        if (isForceSitPromptSeatActive()) return [];
        return uniqueSortedSeatNumbers([
            ...getSeatReservationNumbers(),
            ...getYellowSeatRayNumbers(),
        ]);
    }

    function getSeatReservationNumbers() {
        if (isForceSitPromptSeatActive()) return [];
        const limit = getPlannedSeatLimit();
        const remembered = uniqueSortedSeatNumbers(lastTargetSeatNumbers).slice(0, limit);
        const hasRecentActiveMemory = typeof isTargetSeatMemoryRecentlyActive === 'function' &&
            isTargetSeatMemoryRecentlyActive();
        if (hasRecentActiveMemory && getLiveRememberedSeatEvidence(remembered).length > 0) {
            return remembered;
        }
        return getTrustedRememberedSeatNumbers();
    }

    function isForceSitPromptSeatActive() {
        return forceSitPromptSeatUntil > 0 && Date.now() < forceSitPromptSeatUntil;
    }

    function getNewEmptySeatBlockState(candidateNumber = null) {
        const requested = getPlannedSeatLimit();
        const controlledOrPending = getControlledOrPendingSeatNumbers();
        if (controlledOrPending.length >= requested) {
            return { blocked: true, reason: `seat_limit=${controlledOrPending.length}/${requested}` };
        }

        const forceSeat = isForceSitPromptSeatActive();
        const remembered = forceSeat ? [] : getSeatReservationNumbers();
        const yellow = forceSeat ? [] : getYellowSeatRayNumbers();
        const known = uniqueSortedSeatNumbers([...remembered, ...yellow]);
        const candidate = normalizeSeatNumber(candidateNumber);
        if (known.length >= requested && (candidate === null || !known.includes(candidate))) {
            const parts = [];
            if (remembered.length > 0) parts.push(`remembered=${remembered.join(',')}`);
            if (yellow.length > 0) parts.push(`yellow=${yellow.join(',')}`);
            parts.push(`known_limit=${known.length}/${requested}`);
            return { blocked: true, reason: parts.join(' ') };
        }

        return { blocked: false, reason: '' };
    }

    function normalizeSeatNumber(n) {
        const x = parseInt(n, 10);
        return Number.isFinite(x) && x >= 1 && x <= 7 ? x : null;
    }

    function uniqueSortedSeatNumbers(numbers) {
        return Array.from(new Set(
            numbers
                .map(normalizeSeatNumber)
                .filter(n => n !== null)
        )).sort((a, b) => a - b);
    }

    function uniqueSeatNumbersInOrder(numbers) {
        const out = [];
        for (const n of numbers) {
            const seatNumber = normalizeSeatNumber(n);
            if (seatNumber !== null && !out.includes(seatNumber)) out.push(seatNumber);
        }
        return out;
    }

    function prunePendingSitSeats() {
        const now = Date.now();
        for (const [n, at] of pendingSitSeats.entries()) {
            if (now - at > PENDING_SEAT_TTL_MS || isControlledSeatNumber(n)) {
                pendingSitSeats.delete(n);
            }
        }
    }

    function getPendingSitSeatNumbers() {
        prunePendingSitSeats();
        return uniqueSortedSeatNumbers(Array.from(pendingSitSeats.keys()));
    }

    function markPendingSitSeat(n) {
        const seatNumber = normalizeSeatNumber(n);
        if (seatNumber === null) return;
        pendingSitSeats.set(seatNumber, Date.now());
    }

    function clearPendingSitSeat(n) {
        const seatNumber = normalizeSeatNumber(n);
        if (seatNumber !== null) pendingSitSeats.delete(seatNumber);
    }

    function getControlledOrPendingSeatNumbers() {
        return uniqueSortedSeatNumbers([
            ...getControlledSeatNumbers(),
            ...getPendingSitSeatNumbers(),
            ...getTrustedRememberedSeatNumbers(),
        ]);
    }

    function hasOwnSeatDomMarker(seat) {
        if (!seat) return false;
        const seatClass = seat.getAttribute?.('class') || '';
        if (!/\bFP_FZ\b/.test(seatClass)) return false;
        const ghost = seat.querySelector?.('[data-testid="ghostChip"],[data-testid="ghost-chip"]');
        if (ghost && isVisible(ghost)) return false;
        const beforeSitMarker = seat.querySelector?.('.FP_Gn');
        if (beforeSitMarker && isVisible(beforeSitMarker)) return false;
        return true;
    }

    function isSeatTakenByOther(seat) {
        if (!seat || isOwnSeat(seat)) return false;
        const seatClass = seat.getAttribute?.('class') || '';
        if (/\bFP_FV\b/.test(seatClass)) return true;
        const container = getSeatContainer(seat);
        const nickname = container?.querySelector?.('[data-testid="seat-taken-nickname"]');
        if (nickname) return true;
        return !!container?.querySelector?.('.FP_FU');
    }

    function isOwnSeat(seat) {
        if (!seat) return false;
        if (hasSeatCloseButton(seat)) return true;
        return hasOwnSeatDomMarker(seat);
    }

    function hasSeatCloseButton(seat) {
        const closeBtn = getSeatCloseButton(seat);
        return !!(closeBtn && isVisible(closeBtn) && !isDisabledLike(closeBtn));
    }

    function isVerifiedOwnSeat(seat) {
        if (!seat || !isVisible(seat) || isSeatTakenByOther(seat)) return false;
        if (hasSeatCloseButton(seat)) return true;
        if (hasOwnSeatDomMarker(seat)) return true;
        const n = getSeatNumber(seat);
        return getYellowSeatRayNumbers().includes(n) && !isSeatBeforeSit(seat);
    }

    function isControlledSeatNumber(n) {
        const seatNumber = normalizeSeatNumber(n);
        if (seatNumber === null) return false;
        const seat = getSeatByNumber(seatNumber);
        if (!seat || !isVisible(seat)) return false;
        if (isVerifiedOwnSeat(seat)) return true;
        if (isSeatTakenByOther(seat)) return false;
        if (!lastTargetSeatNumbers.includes(seatNumber)) return false;

        const amount = getSeatDisplayedBetAmount(seat);
        if (Number.isFinite(amount) && amount > 0) return true;
        return false;
    }

    function getDirectVerifiedSeatNumbers() {
        return uniqueSortedSeatNumbers(
            getVisibleMainBetSeats()
                .filter(isVerifiedOwnSeat)
                .map(getSeatNumber)
        );
    }

    function getCloseVerifiedSeatNumbers(numbers) {
        return uniqueSortedSeatNumbers(numbers).filter(n => {
            const seat = getSeatByNumber(n);
            return !!(seat && isVisible(seat) && hasSeatCloseButton(seat));
        });
    }

    function getAllCloseVerifiedSeatNumbers() {
        return uniqueSortedSeatNumbers(
            getVisibleMainBetSeats()
                .filter(seat => seat && isVisible(seat) && hasSeatCloseButton(seat))
                .map(getSeatNumber)
        );
    }

    function getBroadcastSeatTargetState(numbers) {
        const targets = uniqueSortedSeatNumbers(numbers);
        const live = getAllCloseVerifiedSeatNumbers();
        const reserved = typeof lastTargetSeatNumbers !== 'undefined'
            ? getSeatReservationNumbers()
            : [];
        const targetSet = new Set(targets);
        const liveSet = new Set(live);
        const missing = targets.filter(n => !liveSet.has(n));
        const extra = live.filter(n => !targetSet.has(n));
        const unresolvedReserved = reserved.filter(n => !targetSet.has(n) && !liveSet.has(n));
        return {
            targets,
            live,
            reserved,
            missing,
            extra,
            unresolvedReserved,
            exact: targets.length > 0 && missing.length === 0 && extra.length === 0 && unresolvedReserved.length === 0,
        };
    }

    function getControlledSeatNumbers() {
        return uniqueSortedSeatNumbers([
            ...getDirectVerifiedSeatNumbers(),
            ...lastTargetSeatNumbers.filter(isControlledSeatNumber),
        ]);
    }

    function hasRequestedControlledSeats() {
        return getControlledOrPendingSeatNumbers().length >= getPlannedSeatLimit();
    }

    function getRememberedBetSeatNumbers(expected = getPlannedSeatLimit()) {
        const controlled = getControlledOrPendingSeatNumbers();
        const rememberedControlled = lastTargetSeatNumbers.filter(n => controlled.includes(n));
        return uniqueSortedSeatNumbers([
            ...rememberedControlled,
            ...controlled,
        ]).slice(0, expected);
    }

    function canInferSeatAmountFromPlan(state, plan) {
        if (!state || state.amountDetected || !state.hasChip) return false;
        if (state.hasGhost) return false;
        if (!plan || plan.totalActual <= 0 || plan.perSeatActual <= 0) return false;
        const chipPlan = plan.chipPlan || [];
        if (chipPlan.length <= 0) return false;

        const singleExactChip = chipPlan.length === 1 &&
            chipPlan[0].count === 1 &&
            chipPlan[0].value === plan.perSeatActual;
        return singleExactChip &&
            state.chipCount > 0 &&
            state.chipCount <= SINGLE_CHIP_DOM_PART_LIMIT;
    }

    function getTargetSeatBetSummary(numbers = getRememberedBetSeatNumbers(), expectedPlan = null) {
        const seats = uniqueSortedSeatNumbers(numbers);
        const expected = expectedPlan
            ? Math.max(1, toInt(expectedPlan.used, getMaxSeatCount(), 1, 7))
            : seats.length;
        const allowPlanInference = !!expectedPlan && seats.length === expected;
        const amounts = seats.map(n => {
            const state = getSeatBetState(getSeatByNumber(n));
            const inferred = allowPlanInference && canInferSeatAmountFromPlan(state, expectedPlan);
            const amount = state.amountDetected ? state.amount : null;
            return {
                seatNumber: n,
                amount,
                inferredAmount: inferred ? expectedPlan.perSeatActual : null,
                hasChip: state.hasChip,
                chipCount: state.chipCount,
                hasGhost: hasGhostChip(getSeatByNumber(n)),
                inferred,
            };
        });
        const total = amounts.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
        return {
            seats,
            amounts,
            total,
            detectedCount: amounts.filter(item => Number.isFinite(item.amount) && item.amount > 0).length,
            missingCount: amounts.filter(item => !Number.isFinite(item.amount)).length,
            ambiguousCount: amounts.filter(item => item.hasChip && !Number.isFinite(item.amount)).length,
            emptyCount: amounts.filter(item => !item.hasChip && !Number.isFinite(item.amount)).length,
        };
    }

    function isBetSummaryMatchingPlan(summary, plan) {
        const expected = Math.max(1, toInt(plan?.used, getMaxSeatCount(), 1, 7));
        if (!summary || !plan || plan.totalActual <= 0 || plan.perSeatActual <= 0) return false;
        if (summary.seats.length !== expected || summary.amounts.length !== expected) return false;
        if (summary.detectedCount < expected || summary.ambiguousCount > 0) return false;
        if (summary.total !== plan.totalActual) return false;
        return summary.amounts
            .filter(item => Number.isFinite(item.amount))
            .slice(0, expected)
            .every(item => item.amount === plan.perSeatActual);
    }

    function isBetSummaryWalletConfirmed(summary, plan) {
        const expected = Math.max(1, toInt(plan?.used, getMaxSeatCount(), 1, 7));
        if (!summary || !plan || plan.totalActual <= 0 || plan.perSeatActual <= 0) return false;
        if (summary.seats.length !== expected || summary.amounts.length !== expected) return false;
        if (!getBroadcastSeatTargetState(summary.seats).exact) return false;
        if (getWalletTotalBetVariance(plan).status !== 'exact') return false;
        const verifiedProgressComplete = typeof isVerifiedBetProgressComplete === 'function' &&
            isVerifiedBetProgressComplete(plan, summary.seats);
        return summary.amounts.every(item =>
            item.hasChip &&
            !item.hasGhost &&
            (verifiedProgressComplete || !Number.isFinite(item.amount) || item.amount === plan.perSeatActual)
        );
    }

    function getUnknownBetWalletRecovery(summary, plan) {
        const variance = getWalletTotalBetVariance(plan);
        const recoverableStatuses = new Set(['under', 'increased', 'exact']);
        const recoverable = !!summary && summary.ambiguousCount > 0 &&
            recoverableStatuses.has(variance.status) &&
            Number.isFinite(variance.reading?.amount) &&
            variance.reading.amount >= 0;
        const reason = variance.status === 'increased'
            ? 'bet_total_over_target'
            : (variance.status === 'exact' ? 'bet_amount_unknown_unverified' : 'bet_amount_unknown_under_target');
        return { recoverable, variance, reason };
    }

    function isTargetBetTotalOverLimit(numbers = getRememberedBetSeatNumbers()) {
        const summary = getTargetSeatBetSummary(numbers);
        return summary.detectedCount > 0 && summary.total > TARGET_BET_AMOUNT;
    }

    function getAutoSeatExpansionOpportunity() {
        if (!AUTO_SEAT_COUNT || isScriptStopped() || isAutomationLocked()) return null;
        const maxSeats = getMaxSeatCount();
        const currentSeats = uniqueSortedSeatNumbers([
            ...getControlledSeatNumbers(),
            ...getTrustedRememberedSeatNumbers(),
        ]);
        const currentUsed = currentSeats.length;
        if (currentUsed <= 0 || currentUsed >= maxSeats) return null;
        if (!isBettingWindowOpen()) return null;

        const availableChips = detectAvailableChips();
        if (availableChips.length === 0) return null;

        const allSeats = getSetupSeatCandidates();
        if (allSeats.length <= currentUsed) return null;

        const expandedSeatCount = Math.min(maxSeats, allSeats.length);
        if (expandedSeatCount <= currentUsed) return null;

        const nextPlan = getSeatPlan(expandedSeatCount, availableChips);
        if (nextPlan.used <= currentUsed || nextPlan.used > maxSeats) return null;
        if (nextPlan.chipPlan.length === 0 || nextPlan.perSeatActual <= 0) return null;

        return {
            currentUsed,
            currentSeats,
            availableSeatCount: allSeats.length,
            plan: nextPlan,
        };
    }

    function requestImmediateBetReplan(reason, forcedSeatCount = null) {
        if (isScriptStopped() || isRunning || isBetSetupRunning || isAutomationLocked()) return false;
        forcedAutoSeatCount = normalizeSeatNumber(forcedSeatCount);
        betSettingsDirty = true;
        autoBetArmed = false;
        lastBetSetupAt = 0;
        lastTriggerAt = 0;
        lastRecoveryAt = 0;
        lastSeatPlan = emptyPlan();
        lastAppliedBetSettingsKey = '';
        GM_setValue('lastAppliedBetSettingsKey', '');
        lastFailReason = reason;
        runSequence().catch(e => console.error('[AutoTrigger] immediate replan error:', e));
        return true;
    }

    async function sitAvailableSeatsFirst(reason = 'seat_first') {
        if (isScriptStopped() || isRunning || isBetSetupRunning || isAutomationLocked()) return false;

        isBetSetupRunning = true;
        let seatedAny = false;
        try {
            if (!(await stopAutoplayIfRunning())) return false;
            if (isScriptStopped()) return false;

            const allSeats = getSetupSeatCandidates();
            const availableChips = detectAvailableChips();
            const seatFirstPlan = availableChips.length > 0 ? getSeatPlan(allSeats.length, availableChips) : null;
            const targetSeatCount = seatFirstPlan && seatFirstPlan.used > 0
                ? Math.min(getMaxSeatCount(), seatFirstPlan.used, allSeats.length)
                : Math.min(getMaxSeatCount(), allSeats.length);
            seatLimitOverride = targetSeatCount;

            if (targetSeatCount <= 0) {
                lastFailReason = 'no_bettable_seats_for_seat_first';
                return false;
            }

            let targetSeatNumbers = buildTargetSeatNumbers(allSeats, targetSeatCount);
            const plannedTargetSeatNumbers = targetSeatNumbers.slice();
            if (!(await closeExtraSeatedSeats(targetSeatNumbers))) return false;

            const finalSeatNumbers = [];
            const triedEmptySeats = new Set();
            for (const n of targetSeatNumbers) {
                if (isScriptStopped()) return false;
                if (finalSeatNumbers.length >= targetSeatCount) break;
                const seat = getSeatByNumber(n);
                if (seat && isControlledSeatNumber(n)) {
                    finalSeatNumbers.push(n);
                    continue;
                }

                triedEmptySeats.add(n);
                if (await sitSeatIfNeeded(n)) {
                    finalSeatNumbers.push(n);
                    continue;
                }

                while (finalSeatNumbers.length < targetSeatCount) {
                    if (isScriptStopped()) return false;
                    const remainingEmpty = getEmptySeatNumbers()
                        .filter(x => !triedEmptySeats.has(x) && !finalSeatNumbers.includes(x));
                    if (remainingEmpty.length === 0) break;
                    const candidate = remainingEmpty[0];
                    triedEmptySeats.add(candidate);
                    if (await sitSeatIfNeeded(candidate)) {
                        finalSeatNumbers.push(candidate);
                        break;
                    }
                }
            }

            const verifiedSeatedNumbers = finalSeatNumbers.filter(isControlledSeatNumber);
            const trustedRememberedTargets = getTrustedRememberedSeatNumbers().filter(n => {
                if (!plannedTargetSeatNumbers.includes(n) && !finalSeatNumbers.includes(n)) return false;
                return hasLiveRememberedSeatEvidence(n);
            });
            const seatedNumbers = uniqueSortedSeatNumbers([
                ...verifiedSeatedNumbers,
                ...trustedRememberedTargets,
            ]).slice(0, targetSeatCount);
            if (seatedNumbers.length <= 0) {
                lastFailReason = 'seat_first_not_verified';
                return false;
            }
            if (verifiedSeatedNumbers.length < seatedNumbers.length) {
                console.warn(`[AutoTrigger] chips_missing 좌석 감지 누락 가능: 검증 ${verifiedSeatedNumbers.join(',') || '없음'} / 기억 유지 ${trustedRememberedTargets.join(',') || '없음'}`);
            }

            rememberTargetSeatNumbers(seatedNumbers, { allowShrink: true, reason: reason || 'seat_first' });
            betSettingsDirty = true;
            lastBetSetupAt = 0;
            lastTriggerAt = 0;
            lastFailReason = availableChips.length === 0 ? 'chips_missing_seated_waiting' : null;
            seatedAny = true;
            console.log(`[AutoTrigger] chips 없어도 좌석 우선 착석 완료: ${seatedNumbers.join(',')}`);
            return true;
        } finally {
            seatLimitOverride = null;
            isBetSetupRunning = false;
            if (!seatedAny && lastFailReason === null) lastFailReason = reason;
        }
    }

    function handleImmediateSeatOpportunities(source = 'loop', phaseHint = null) {
        if (isScriptStopped() || isRunning || isBetSetupRunning || isAutomationLocked()) return false;
        if (typeof isSettingsInputPending === 'function' && isSettingsInputPending()) return false;

        const now = Date.now();
        const fastPromptOnly = source === 'fast';
        let sitPromptVisible = fastPromptOnly ? isSitPromptVisible() : null;
        if (fastPromptOnly && !sitPromptVisible) return false;

        if (!fastPromptOnly) {
            const expansion = getAutoSeatExpansionOpportunity();
            if (expansion && now - lastSeatExpansionHandledAt >= SEAT_EXPANSION_COOLDOWN_MS) {
                lastSeatExpansionHandledAt = now;
                console.log(`[AutoTrigger] 좌석 추가 감지(${source}) → 자동베팅 취소 후 ${expansion.plan.used}좌석 재분배`);
                requestImmediateBetReplan('seat_expansion_available', expansion.plan.used);
                return true;
            }
        }

        const phase = phaseHint || diagnosePhase();
        if (sitPromptVisible === null) sitPromptVisible = isSitPromptVisible();
        if (phase === Phase.STOPPED) return false;
        if (phase === Phase.NO_TABLE && !sitPromptVisible) return false;
        if (sitPromptVisible && getDirectVerifiedSeatNumbers().length === 0 && getPendingSitSeatNumbers().length === 0 && lastTargetSeatNumbers.length > 0) {
            console.warn('[AutoTrigger] sit prompt visible but no direct own seat; clear stale remembered seats before sitting');
            clearRememberedSeatNumbers();
            lastSeatPlan = emptyPlan();
            betSettingsDirty = true;
            lastAppliedBetSettingsKey = '';
            GM_setValue('lastAppliedBetSettingsKey', '');
            lastFailReason = 'sit_prompt_cleared_stale_memory';
        }
        const setupSeatCandidates = (sitPromptVisible || phase === Phase.NO_CHIPS) ? getSetupSeatCandidates() : [];
        const hasEmptySeatCandidate = setupSeatCandidates.some(isSeatBeforeSit);
        const controlledSeats = getControlledSeatNumbers();
        if (phase === Phase.NO_CHIPS && controlledSeats.length > 0 && !hasEmptySeatCandidate) {
            lastFailReason = 'chips_missing_seated_waiting';
            return false;
        }
        if (sitPromptVisible && controlledSeats.length > 0 && !hasEmptySeatCandidate && areBetSeatsReadyForRoundAction()) {
            if (!isBetSettingsApplied()) markBetSettingsApplied();
            return false;
        }
        const chipsMissingSeatFirst = phase === Phase.NO_CHIPS &&
            !hasRequestedControlledSeats() &&
            (hasEmptySeatCandidate || controlledSeats.length === 0);
        if (!sitPromptVisible && !chipsMissingSeatFirst) return false;

        lastSitPromptSeenAt = now;
        if (sitPromptVisible && getDirectVerifiedSeatNumbers().length === 0 && getPendingSitSeatNumbers().length > 0) {
            for (const n of getPendingSitSeatNumbers()) clearPendingSitSeat(n);
            lastFailReason = 'sit_prompt_cleared_stale_pending';
        }
        if (hasRequestedControlledSeats()) {
            lastFailReason = sitPromptVisible ? 'sit_prompt_seat_limit_guard' : 'seat_limit_guard';
            return false;
        }
        if (now - lastSitPromptHandledAt < SIT_PROMPT_COOLDOWN_MS) return false;

        lastSitPromptHandledAt = now;
        sitPromptTriggerCount++;
        if (sitPromptVisible && getDirectVerifiedSeatNumbers().length === 0) {
            forceSitPromptSeatUntil = Date.now() + SIT_PROMPT_FORCE_SEAT_MS;
            console.log(`[AutoTrigger] "자리에 앉으십시오" 감지(${source}) → 실제 미착석, 좌석 우선 착석`);
            sitAvailableSeatsFirst('sit_prompt_seat_first').catch(e => console.error('[AutoTrigger] sit prompt seat-first error:', e));
            return true;
        }
        if (phase === Phase.NO_CHIPS || detectAvailableChips().length === 0) {
            console.log(`[AutoTrigger] chips_missing 중 좌석 우선 처리(${source})`);
            sitAvailableSeatsFirst('chips_missing_seat_first').catch(e => console.error('[AutoTrigger] seat-first error:', e));
            return true;
        }

        console.log(`[AutoTrigger] "자리에 앉으십시오" 감지(${source}) → 즉시 착석/베팅 계산`);
        requestImmediateBetReplan(sitPromptVisible ? 'sit_prompt_visible' : 'seat_first_visible');
        return true;
    }

    function getExpectedBetPlan() {
        const expectedSeats = getMaxSeatCount();
        if (
            lastSeatPlan?.totalActual > 0 &&
            lastSeatPlan.requested === expectedSeats &&
            lastSeatPlan.autoSeatCount === AUTO_SEAT_COUNT &&
            isBetSettingsApplied()
        ) {
            return lastSeatPlan;
        }
        const availableChips = detectAvailableChips();
        if (availableChips.length > 0) {
            const visibleSeatCount = getBettableSeats().length || expectedSeats;
            const rememberedSeats = getRememberedBetSeatNumbers(expectedSeats).length || 0;
            const plan = getSeatPlan(Math.max(rememberedSeats, visibleSeatCount), availableChips);
            if (plan.totalActual > 0) return plan;
        }
        if (
            lastSeatPlan?.totalActual > 0 &&
            lastSeatPlan.requested === expectedSeats &&
            lastSeatPlan.autoSeatCount === AUTO_SEAT_COUNT
        ) return lastSeatPlan;
        return {
            requested: expectedSeats,
            used: expectedSeats,
            totalTarget: TARGET_BET_AMOUNT,
            perSeatTarget: Math.floor(TARGET_BET_AMOUNT / expectedSeats),
            perSeatActual: Math.floor(TARGET_BET_AMOUNT / expectedSeats),
            totalActual: Math.floor(TARGET_BET_AMOUNT / expectedSeats) * expectedSeats,
            chipPlan: [],
            availableChips: [],
            autoSeatCount: AUTO_SEAT_COUNT,
        };
    }

    function getExpectedBetTotal() {
        return getExpectedBetPlan().totalActual;
    }

    function isTargetBetTotalMismatch(numbers = getRememberedBetSeatNumbers(), expectedPlan = getExpectedBetPlan()) {
        const expectedSeats = getMaxSeatCount();
        const expectedActiveSeats = Math.max(1, toInt(expectedPlan.used, expectedSeats, 1, 7));
        const summary = getTargetSeatBetSummary(numbers, expectedPlan);
        if (isBetSummaryWalletConfirmed(summary, expectedPlan)) return false;
        if (summary.seats.length > expectedActiveSeats) return true;
        if (summary.ambiguousCount > 0) return false;
        if (summary.detectedCount <= 0) {
            return isBettingWindowOpen() &&
                summary.seats.length >= expectedActiveSeats &&
                summary.missingCount >= expectedActiveSeats;
        }
        if (summary.detectedCount < expectedActiveSeats) {
            return isBettingWindowOpen() || summary.total > expectedPlan.totalActual;
        }
        if (summary.detectedCount >= expectedActiveSeats) {
            if (summary.total !== expectedPlan.totalActual) return true;
            return summary.amounts.some(item => item.amount !== expectedPlan.perSeatActual);
        }
        return summary.total > expectedPlan.totalActual;
    }

    function areBetSeatsReadyForRoundAction(expectedPlan = getExpectedBetPlan()) {
        const expected = Math.max(1, toInt(expectedPlan.used, getMaxSeatCount(), 1, 7));
        const targets = getRememberedBetSeatNumbers(expected);

        if (targets.length < expected) return false;

        const summary = getTargetSeatBetSummary(targets, expectedPlan);
        const amountsExact = summary.detectedCount >= expected &&
            summary.total === expectedPlan.totalActual &&
            summary.amounts.every(item => item.amount === expectedPlan.perSeatActual);
        if (isBetSummaryWalletConfirmed(summary, expectedPlan)) return true;
        if (!amountsExact) return false;

        const walletVariance = getWalletTotalBetVariance(expectedPlan);
        if (walletVariance.status === 'exact') return true;
        return !isBettingWindowOpen() && walletVariance.status === 'missing';
    }

    function hasVisibleInScope(scope, selector) {
        if (!scope) return false;
        if (scope.matches?.(selector) && isVisible(scope)) return true;
        return Array.from(scope.querySelectorAll?.(selector) || []).some(isVisible);
    }

    function getSeatBeforeSitScore(seat) {
        if (!seat || isOwnSeat(seat) || isSeatTakenByOther(seat)) return 0;
        const seatNumber = getSeatNumber(seat);
        const wrapper = getSeatWrapper(seat);
        const scopes = [
            seat,
            getSeatContainer(seat),
            wrapper?.getAttribute?.('data-testid') === `mainbet_${seatNumber}` ? wrapper : null,
        ].filter(Boolean);

        let score = 0;
        if (scopes.some(scope => hasVisibleInScope(scope, '[data-testid="ghostChip"],[data-testid="ghost-chip"]'))) score += 100;
        if (scopes.some(scope => hasVisibleInScope(scope, '.FP_Gn'))) score += 90;

        const text = scopes.map(scope => scope.textContent || '').join(' ').replace(/\s+/g, '');
        if (text.includes('자리에앉으십시오') || text.includes('앉으십시오')) score += 80;

        // Weak fallback only: some builds expose empty seats without stable marker.
        const seatClass = seat.getAttribute?.('class') || '';
        if (score <= 0 && !/\bFP_FV\b/.test(seatClass)) score = 1;
        return score;
    }

    function isSeatBeforeSit(seat) {
        return getSeatBeforeSitScore(seat) > 0;
    }

    function hasGhostChip(seat) {
        return Array.from(seat?.querySelectorAll?.('[data-testid="ghostChip"],[data-testid="ghost-chip"]') || [])
            .some(isVisible);
    }

    function getVisibleEmptySeatCandidates() {
        const map = new Map();
        for (const seat of getBettableSeats()) {
            const n = getSeatNumber(seat);
            const score = getSeatBeforeSitScore(seat);
            if (n < 1 || n > 7 || score <= 0) continue;
            const prev = map.get(n);
            if (!prev || score > prev.score) map.set(n, { seatNumber: n, seat, score });
        }
        return Array.from(map.values())
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (a.score <= 1 && b.score <= 1) return b.seatNumber - a.seatNumber;
                return a.seatNumber - b.seatNumber;
            });
    }

    function getVisibleEmptySeatNumbers() {
        return uniqueSeatNumbersInOrder(getVisibleEmptySeatCandidates().map(item => item.seatNumber));
    }

    // [1.17] 빈자리(앉을 수 있는 자리) 번호 목록 — 1~7 번호 순.
    function getEmptySeatNumbers() {
        if (hasRequestedControlledSeats()) return [];
        if (getNewEmptySeatBlockState().blocked) return [];
        const pending = getPendingSitSeatNumbers();
        return getVisibleEmptySeatNumbers()
            .filter(n => !isControlledSeatNumber(n) && !pending.includes(n));
    }

    // [1.17] 내가 이미 앉은 자리 번호 목록.
    function getMineSeatNumbers() {
        return getControlledSeatNumbers();
    }

    function getSeatWrapper(seat) {
        if (!seat) return null;
        let cur = seat.parentElement;
        while (cur) {
            const tid = cur.getAttribute?.('data-testid') || '';
            if (/^mainbet_\d+$/.test(tid)) return cur;
            cur = cur.parentElement;
        }
        return seat.parentElement || seat;
    }

    async function sitSeatIfNeeded(seatNumber) {
        for (let attempt = 0; attempt <= BET_CLICK_RETRY_LIMIT; attempt++) {
            if (isScriptStopped()) return false;
            const seat = getSeatByNumber(seatNumber);
            if (!seat || !isVisible(seat)) return false;
            if (isControlledSeatNumber(seatNumber)) return true;
            const normalizedSeatNumber = normalizeSeatNumber(seatNumber);
            if (
                getTrustedRememberedSeatNumbers().includes(normalizedSeatNumber) &&
                !isSeatTakenByOther(seat) &&
                hasLiveRememberedSeatEvidence(normalizedSeatNumber)
            ) {
                return true;
            }
            if (isDisabledLike(seat)) return false;
            if (getPendingSitSeatNumbers().includes(normalizeSeatNumber(seatNumber))) {
                const settled = await waitForCondition(() => isControlledSeatNumber(seatNumber), 450, 25);
                if (settled) {
                    clearPendingSitSeat(seatNumber);
                    rememberTargetSeatNumbers([...lastTargetSeatNumbers, seatNumber], { reason: 'pending_sit_verified' });
                    return true;
                }
                clearPendingSitSeat(seatNumber);
                return false;
            }
            const beforeSit = isSeatBeforeSit(seat);
            const emptySeatBlock = beforeSit ? getNewEmptySeatBlockState(seatNumber) : { blocked: false, reason: '' };
            if (emptySeatBlock.blocked) {
                console.warn(`[AutoTrigger] fail-closed: skip new empty seat ${seatNumber} (${emptySeatBlock.reason})`);
                return false;
            }
            if (hasRequestedControlledSeats()) {
                console.log(`[AutoTrigger] seat limit reached (${getPlannedSeatLimit()}); skip seat ${seatNumber}`);
                return false;
            }
            if (!beforeSit) return false;
            markPendingSitSeat(seatNumber);
            robustClick(seat);
            const seated = await waitForCondition(() => {
                const freshSeat = getSeatByNumber(seatNumber);
                return !!(freshSeat && isVerifiedOwnSeat(freshSeat));
            }, 550, 25);
            if (seated) {
                clearPendingSitSeat(seatNumber);
                rememberTargetSeatNumbers([...lastTargetSeatNumbers, seatNumber], { reason: 'sit_verified' });
                return true;
            }
            clearPendingSitSeat(seatNumber);
            const freshSeat = getSeatByNumber(seatNumber);
            if (
                attempt < BET_CLICK_RETRY_LIMIT &&
                freshSeat &&
                isVisible(freshSeat) &&
                !isSeatTakenByOther(freshSeat) &&
                isSeatBeforeSit(freshSeat)
            ) {
                console.warn(`[AutoTrigger] seat ${seatNumber} sit click had no effect; retry ${attempt + 2}/${BET_CLICK_RETRY_LIMIT + 1}`);
                continue;
            }
            return false;
        }
        console.warn(`[AutoTrigger] seat ${seatNumber} sit failed`);
        return false;
    }

    function getOwnOrLeafText(el) {
        const ownText = Array.from(el.childNodes || [])
            .filter(node => node.nodeType === 3)
            .map(node => node.textContent || '')
            .join('').trim();
        return ownText || (el.children.length === 0 ? (el.textContent || '').trim() : '');
    }

    function getBetClickAncestor(el, boundary) {
        let best = el;
        let bestArea = 0;
        for (let cur = el; cur && cur !== boundary; cur = cur.parentElement) {
            if (!isVisible(cur)) continue;
            if (cur.querySelector?.(SEAT_CLOSE_ICON_SELECTOR)) continue;
            const rect = cur.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (rect.width >= 14 && rect.height >= 14 && area >= bestArea) {
                best = cur;
                bestArea = area;
            }
        }
        return best;
    }

    function isChipLikeAmountElement(el, boundary) {
        for (let cur = el; cur && cur !== boundary; cur = cur.parentElement) {
            const styleText = cur.getAttribute?.('style') || '';
            if (styleText.includes('--chipBackground')) return true;
            if (cur.style?.getPropertyValue?.('--chipBackground')) return true;
        }
        return false;
    }

    function isRealSeatBetChipElement(el, boundary) {
        if (!el || !boundary || !boundary.contains?.(el) || !isVisible(el)) return false;
        if (el.closest?.('[data-testid="ghostChip"],[data-testid="ghost-chip"]')) return false;
        if (el.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return false;
        if (el.closest?.('button[data-testid^="chip-stack-value-"]')) return false;
        if (el.closest?.('.oo_oA')) return false;
        const tid = el.getAttribute?.('data-testid') || '';
        const cls = String(el.getAttribute?.('class') || '');
        if (/\btW_um\b/.test(cls)) return true;
        return tid === 'chip' ||
            tid === 'chip-container' ||
            tid.startsWith('chip-') ||
            tid.startsWith('chip_') ||
            isChipLikeAmountElement(el, boundary);
    }

    function getElementAmountTexts(el) {
        const texts = [
            getOwnOrLeafText(el),
            el.getAttribute?.('aria-label'),
            el.getAttribute?.('title'),
            el.getAttribute?.('data-value'),
            el.getAttribute?.('data-amount'),
            el.getAttribute?.('value'),
        ];
        const tid = el.getAttribute?.('data-testid') || '';
        const tidAmount = tid.match(/(?:chip|amount|value)[^\d-]*(-?\d+(?:[.,]\d+)?\s*[KMB]?)/i);
        if (tidAmount) texts.push(tidAmount[1]);
        return texts.filter(Boolean);
    }

    function parseCompactMoney(text) {
        let raw = String(text || '').replace(/[₩원,\s]/g, '').trim();
        if (!raw) return 0;
        let mult = 1;
        if (/k$/i.test(raw)) { mult = 1000; raw = raw.slice(0, -1); }
        if (/m$/i.test(raw)) { mult = 1000000; raw = raw.slice(0, -1); }
        if (/b$/i.test(raw)) { mult = 1000000000; raw = raw.slice(0, -1); }
        const n = Number(raw.replace(/[^0-9.\-]/g, ''));
        return Number.isFinite(n) ? Math.round(n * mult) : 0;
    }

    function parseStrictChipAmount(text) {
        // [1.39] 콤마/₩/원/공백 같은 흔한 장식 기호를 먼저 제거해서 fast path 적중률을 올림.
        //        제거 후에도 strict 숫자 패턴이어야만 통과.
        let raw = String(text || '').replace(/\u00a0/g, ' ').trim();
        raw = raw.replace(/[₩원,\s]/g, '');
        if (!raw) return NaN;
        if (!/^[0-9]+(?:\.[0-9]+)?[KkMmBb]?$/.test(raw)) return NaN;
        const amount = parseCompactMoney(raw);
        return Number.isFinite(amount) && amount > 0 ? amount : NaN;
    }

    function parseMoneySum(text) {
        const raw = String(text || '').replace(/\u00a0/g, ' ').trim();
        if (!raw) return 0;

        const wonMatches = [...raw.matchAll(/₩\s*([0-9][0-9,]*(?:\.\d+)?\s*[KkMmBb]?)/g)];
        if (wonMatches.length) return wonMatches.reduce((sum, m) => sum + parseCompactMoney(m[1]), 0);

        const compactMatches = [...raw.matchAll(/\b([0-9]+(?:\.[0-9]+)?\s*[KkMmBb])\b/g)];
        if (compactMatches.length) return compactMatches.reduce((sum, m) => sum + parseCompactMoney(m[1]), 0);

        const commaMatches = [...raw.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})+)\b/g)];
        if (commaMatches.length) return commaMatches.reduce((sum, m) => sum + parseCompactMoney(m[1]), 0);

        const simple = raw.replace(/[^\d.]/g, '');
        if (/^[0-9]+(?:\.[0-9]+)?$/.test(simple)) return parseCompactMoney(simple);

        return parseNumber(raw) || 0;
    }

    function findMainBetSpot(seat) {
        if (!seat) return null;
        const n = getSeatNumber(seat);
        const byId = Number.isFinite(n)
            ? seat.ownerDocument?.querySelector?.(`[data-testid="mainbet_${n}"]`)
            : null;
        if (byId && isVisible(byId)) return byId;
        const wrapper = getSeatWrapper(seat);
        if (wrapper?.getAttribute?.('data-testid') === `mainbet_${n}`) return wrapper;
        return seat;
    }

    function getVisibleMainBetFaceChips(spot) {
        if (!spot) return [];
        // [1.40] obfuscated CSS class("tW_um")는 사이트 빌드마다 바뀔 수 있어
        //        data-testid="chip" 기반 selector를 fallback으로 추가. 둘 다 합집합으로 사용.
        const out = new Set();
        spot.querySelectorAll('span[class*="tW_um"]').forEach(el => out.add(el));
        spot.querySelectorAll('[data-testid="chip"]').forEach(el => {
            // chip-container 내부의 visual chip만 face chip으로 취급
            if (el.tagName === 'SPAN' || el.tagName === 'DIV') out.add(el);
        });
        const chips = Array.from(out)
            .filter(chip => isRealSeatBetChipElement(chip, spot));
        return chips.filter(chip => {
            return !chips.some(other =>
                other !== chip &&
                chip.contains?.(other) &&
                /\d/.test(other.textContent || '')
            );
        });
    }

    function getSeatChipContainerAmountInfo(seat) {
        if (!isBettingWindowOpen()) return null;
        const spot = findMainBetSpot(seat);
        if (!spot) return null;

        const faceChips = getVisibleMainBetFaceChips(spot);
        let sum = 0;
        let firstChip = null;
        let invalidFaceText = false;
        for (const chip of faceChips) {
            const text = String(chip.textContent || '').trim();
            if (!/\d/.test(text)) continue;
            const amount = parseStrictChipAmount(text);
            if (!Number.isFinite(amount) || amount <= 0) {
                invalidFaceText = true;
                continue;
            }
            if (!firstChip) firstChip = chip;
            sum += amount;
        }
        if (invalidFaceText) {
            console.warn('[AutoTrigger] chip face text parse failed; amount reading paused to prevent duplicate bet');
            return null;
        }
        if (sum > 0) {
            return { amount: sum, element: getBetClickAncestor(firstChip || spot, spot) };
        }

        const chips = Array.from(spot.querySelectorAll('[data-testid="chip-container"]'))
            .filter(chip => {
                return isRealSeatBetChipElement(chip, spot);
            });
        for (const chip of chips) {
            const amount = parseMoneySum(chip.textContent);
            if (amount <= 0) continue;
            if (!firstChip) firstChip = chip;
            sum += amount;
        }
        if (sum > 0) {
            return { amount: sum, element: getBetClickAncestor(firstChip || spot, spot) };
        }
        return null;
    }

    function getSeatBetChipElements(seat) {
        if (!seat) return [];
        const wrapper = getSeatWrapper(seat) || seat;
        const candidates = Array.from(wrapper.querySelectorAll('[data-testid="chip"], [data-testid^="chip"], span, div, svg, text, tspan'));
        const roots = [];
        for (const el of candidates) {
            if (!isVisible(el)) continue;
            if (el.closest?.(SEAT_CLOSE_ICON_SELECTOR)) continue;
            if (el.closest?.('[data-testid="ghostChip"],[data-testid="ghost-chip"]')) continue;
            if (el.closest?.('button[data-testid^="chip-stack-value-"]')) continue;
            const tid = el.getAttribute?.('data-testid') || '';
            const chipLike = isRealSeatBetChipElement(el, wrapper);
            if (!chipLike) continue;
            if (roots.some(root => root.contains(el))) continue;
            roots.push(el);
        }
        return roots;
    }

    function getSeatBetAmountInfo(seat) {
        if (!seat) return null;
        if (!isBettingWindowOpen()) return null;
        const chipContainerInfo = getSeatChipContainerAmountInfo(seat);
        if (chipContainerInfo) return chipContainerInfo;
        if (getVisibleMainBetFaceChips(findMainBetSpot(seat)).length > 0) return null;
        const wrapper = getSeatWrapper(seat) || seat;
        const infos = [];
        const seatNumber = getSeatNumber(seat);
        const candidates = Array.from(new Set([
            ...getSeatBetChipElements(seat),
        ]));
        for (const el of candidates) {
            if (el.closest?.(SEAT_CLOSE_ICON_SELECTOR)) continue;
            if (el.closest?.('[data-testid="ghostChip"],[data-testid="ghost-chip"]')) continue;
            if (!isRealSeatBetChipElement(el, wrapper)) continue;
            for (const text of getElementAmountTexts(el)) {
                if (!text || !/\d/.test(text)) continue;
                const amount = parseNumber(text);
                if (!Number.isFinite(amount) || amount <= 0) continue;
                if (amount === seatNumber) continue;
                if (amount < cachedMinChipValue) continue;
                infos.push({ amount, element: getBetClickAncestor(el, wrapper) });
                break;
            }
        }
        if (!infos.length) return null;
        infos.sort((a, b) => b.amount - a.amount);
        return infos[0];
    }

    function getSeatDisplayedBetAmount(seat) { return getSeatBetAmountInfo(seat)?.amount ?? null; }

    function getSeatBetState(seat) {
        const seatNumber = seat ? getSeatNumber(seat) : 999;
        const cacheKey = `seat-bet:${seatNumber}`;
        const cached = _seatBetStateCache.get(cacheKey);
        if (cached && Date.now() - cached.at < SEAT_BET_STATE_CACHE_MS) return cached.value;

        const info = getSeatBetAmountInfo(seat);
        const amount = info?.amount ?? null;
        const chipElements = getSeatBetChipElements(seat);
        const faceChipCount = getVisibleMainBetFaceChips(findMainBetSpot(seat)).length;
        const amountDetected = Number.isFinite(amount) && amount > 0;
        const state = {
            amount: amountDetected ? amount : null,
            amountDetected,
            hasChip: amountDetected || chipElements.length > 0 || faceChipCount > 0,
            chipCount: Math.max(chipElements.length, faceChipCount),
            element: info?.element || chipElements[0] || null,
        };
        _seatBetStateCache.set(cacheKey, { at: Date.now(), value: state });
        return state;
    }

    function getSeatBetClickCandidates(seat) {
        if (!seat) return [];
        const n = getSeatNumber(seat);
        const doc = seat.ownerDocument || document;
        const spot = findMainBetSpot(seat);
        const wrapper = getSeatWrapper(seat);
        const info = getSeatBetAmountInfo(seat);
        const directRootSeat = Number.isFinite(n)
            ? doc.querySelector?.(`[data-testid="seat_${n}"]`)
            : null;
        const directSeat = Number.isFinite(n)
            ? doc.querySelector?.(`[data-testid="mainbetSeat_${n}"]`)
            : null;
        const directSpot = Number.isFinite(n)
            ? doc.querySelector?.(`[data-testid="mainbet_${n}"]`)
            : null;
        const mainBetGhost = directSeat?.querySelector?.('[data-testid="ghost-chip"],[data-testid="ghostChip"]') ||
            directSpot?.querySelector?.('[data-testid="ghost-chip"],[data-testid="ghostChip"]') ||
            seat.querySelector?.(`[data-testid="mainbetSeat_${n}"] [data-testid="ghost-chip"],[data-testid="mainbetSeat_${n}"] [data-testid="ghostChip"]`);
        const mainBetSvg = mainBetGhost?.closest?.('svg') ||
            directSeat?.querySelector?.('svg') ||
            directSpot?.querySelector?.(`[data-testid="mainbetSeat_${n}"] svg`);
        const mainBetChipLayer = directSpot?.querySelector?.('.jc_iJ,.jc_je');
        return Array.from(new Set([
            directSeat,
            directSpot,
            mainBetGhost,
            mainBetSvg,
            mainBetChipLayer,
            spot,
            info?.element,
            directRootSeat,
            wrapper,
            seat,
        ])).filter(el =>
            el &&
            isVisible(el) &&
            !isDisabledLike(el) &&
            !el.closest?.(SEAT_CLOSE_ICON_SELECTOR)
        );
    }

    function getSeatBetClickElement(seat, attempt = 0) {
        const candidates = getSeatBetClickCandidates(seat);
        if (candidates.length <= 0) return seat || null;
        return candidates[Math.min(Math.max(0, attempt), candidates.length - 1)];
    }

    function getSeatCloseButton(seat) {
        if (!seat) return null;
        const n = getSeatNumber(seat);
        const cacheKey = `seat-close:${n}`;
        const cached = _seatCloseButtonCache.get(cacheKey);
        if (cached && Date.now() - cached.at < DYNAMIC_DOM_CACHE_MS) return cached.value;
        const doc = seat.ownerDocument || document;
        const scopes = [
            getSeatWrapper(seat),
            getSeatContainer(seat),
            seat,
            Number.isFinite(n) ? doc.querySelector?.(`[data-testid="mainbet_${n}"]`) : null,
            Number.isFinite(n) ? doc.querySelector?.(`[data-testid="seat_${n}"]`) : null,
        ].filter(Boolean);

        for (const selector of [SEAT_LEAVE_ICON_SELECTOR, BET_CLOSE_ICON_SELECTOR]) {
            for (const scope of Array.from(new Set(scopes))) {
                const markers = [];
                if (scope.matches?.(selector)) markers.push(scope);
                markers.push(...Array.from(scope.querySelectorAll?.(selector) || []));

                for (const marker of markers) {
                    if (!isVisible(marker)) continue;
                    const target = marker.closest?.('button') || marker.closest?.('[role="button"]') || marker;
                    if (target && isVisible(target) && !isDisabledLike(target)) {
                        _seatCloseButtonCache.set(cacheKey, { at: Date.now(), value: target });
                        return target;
                    }
                }
            }
        }

        _seatCloseButtonCache.set(cacheKey, { at: Date.now(), value: null });
        return null;
    }

    function getSeatBetCloseButton(seat) {
        if (!seat) return null;
        const n = getSeatNumber(seat);
        const cacheKey = `bet-close:${n}`;
        const cached = _seatCloseButtonCache.get(cacheKey);
        if (cached && Date.now() - cached.at < DYNAMIC_DOM_CACHE_MS) return cached.value;
        const doc = seat.ownerDocument || document;
        const scopes = [
            getSeatWrapper(seat),
            seat,
            Number.isFinite(n) ? doc.querySelector?.(`[data-testid="mainbet_${n}"]`) : null,
        ].filter(Boolean);

        for (const scope of Array.from(new Set(scopes))) {
            const markers = [];
            if (scope.matches?.(BET_CLOSE_ICON_SELECTOR)) markers.push(scope);
            markers.push(...Array.from(scope.querySelectorAll?.(BET_CLOSE_ICON_SELECTOR) || []));

            for (const marker of markers) {
                if (!isVisible(marker)) continue;
                const target = marker.closest?.('button') || marker.closest?.('[role="button"]') || marker;
                if (target && isVisible(target) && !isDisabledLike(target)) {
                    _seatCloseButtonCache.set(cacheKey, { at: Date.now(), value: target });
                    return target;
                }
            }
        }

        _seatCloseButtonCache.set(cacheKey, { at: Date.now(), value: null });
        return null;
    }

    // [1.17] 1~7번 좌석 중 빈자리(ghost 있음)와 내 자리(이미 앉음)를 합쳐
    //        번호 순으로 used개를 뽑음. 타인 점유 자리는 자연 제외됨.
    function buildTargetSeatNumbers(allSeats, used) {
        const availableNumbers = new Set(allSeats.map(getSeatNumber));
        const mine = uniqueSortedSeatNumbers([
            ...getControlledOrPendingSeatNumbers(),
            ...getKnownSeatNumbers(),
        ]).filter(n => availableNumbers.has(n));
        const empty = getVisibleEmptySeatCandidates()
            .filter(item => availableNumbers.has(item.seatNumber) && !mine.includes(item.seatNumber))
            .map(item => item.seatNumber);
        // 이미 앉은 자리를 우선 유지 (재계산 비용 최소화), 부족분은 빈자리에서 번호 순으로
        const targets = mine.slice(0, used).sort((a, b) => a - b);
        if (targets.length >= used) return targets;
        const emptySeatBlock = getNewEmptySeatBlockState();
        if (emptySeatBlock.blocked) {
            console.warn(`[AutoTrigger] fail-closed: no new empty seats (${emptySeatBlock.reason})`);
            return targets;
        }
        for (const n of empty) {
            if (targets.length >= used) break;
            if (!targets.includes(n)) targets.push(n);
        }
        return targets;
    }

    async function closeExtraSeatedSeats(keepNumbers) {
        const keep = new Set(keepNumbers);
        let closed = 0;
        const getExtraSeats = () => getVisibleMainBetSeats()
            .filter(s => isVerifiedOwnSeat(s) && !keep.has(getSeatNumber(s)));
        const extraSeats = getExtraSeats();
        for (const seat of extraSeats) {
            if (isScriptStopped()) return false;
            const n = getSeatNumber(seat);
            const closeBtn = getSeatCloseButton(seat);
            if (!closeBtn || !isVisible(closeBtn)) {
                console.warn(`[AutoTrigger] extra seat ${n} close button not found`);
                return false;
            }
            robustClick(closeBtn);
            closed++;
            await sleep(EXTRA_SEAT_CLOSE_WAIT_MS);
        }
        if (closed > 0) {
            const allClosed = await waitForCondition(() => getExtraSeats().length === 0, 500, 30);
            if (!allClosed) {
                const remaining = getExtraSeats().map(getSeatNumber);
                console.warn(`[AutoTrigger] extra seats still active after close: ${remaining.join(',') || 'unknown'}`);
                pushBetLog('error', 'extra_seat_close_not_verified', {
                    keep: Array.from(keep).join(','),
                    remaining: remaining.join(','),
                });
                return false;
            }
            console.log(`[AutoTrigger] closed extra seated: ${closed}`);
            rememberTargetSeatNumbers(
                lastTargetSeatNumbers.filter(n => keep.has(n)),
                { allowShrink: true, reason: 'extra_seats_closed' }
            );
        }
        return true;
    }

    async function closeSeatBet(seatNumber) {
        const seat = getSeatByNumber(seatNumber);
        const closeBtn = getSeatBetCloseButton(seat);
        if (!closeBtn || !isVisible(closeBtn)) return false;
        robustClick(closeBtn);
        return waitForCondition(() => {
            const freshSeat = getSeatByNumber(seatNumber);
            const state = getSeatBetState(freshSeat);
            return !!(freshSeat && (isSeatBeforeSit(freshSeat) || (!state.hasChip && !state.amountDetected)));
        }, 500, 25);
    }

    function getVisibleMainBetSeats() {
        const now = Date.now();
        if (_visibleMainBetSeatsCache && now - _visibleMainBetSeatsCacheAt < DYNAMIC_DOM_CACHE_MS) {
            return _visibleMainBetSeatsCache;
        }
        const byNumber = new Map();
        for (let n = 1; n <= 7; n++) {
            const seat = getSeatByNumber(n);
            if (seat && isVisible(seat)) byNumber.set(n, seat);
        }
        for (const seat of qsaDeep('[data-testid^="mainbetSeat_"]')) {
            const n = getSeatNumber(seat);
            if (n >= 1 && n <= 7 && isVisible(seat) && !byNumber.has(n)) {
                byNumber.set(n, seat);
            }
        }
        const seats = Array.from(byNumber.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, seat]) => seat);
        _visibleMainBetSeatsCache = seats;
        _visibleMainBetSeatsCacheAt = Date.now();
        return seats;
    }

    function getBettableSeats() {
        return getVisibleMainBetSeats()
            .filter(seat => {
                if (!seat || !isVisible(seat) || isSeatTakenByOther(seat)) return false;
                return !isDisabledLike(seat) || isOwnSeat(seat) || isSeatBeforeSit(seat);
            });
    }

    function getSetupSeatCandidates() {
        const map = new Map();
        const remembered = uniqueSortedSeatNumbers([
            ...getSeatReservationNumbers(),
            ...getYellowSeatRayNumbers(),
            ...Array.from(pendingSitSeats.keys()),
        ]);
        for (const seat of getBettableSeats()) {
            map.set(getSeatNumber(seat), seat);
        }
        for (const n of remembered) {
            const seat = getSeatByNumber(n);
            if (!seat || !isVisible(seat) || isSeatTakenByOther(seat)) continue;
            map.set(n, seat);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, seat]) => seat);
    }

    function hasBettableSeats() { return getBettableSeats().length > 0; }
