    // ========== 진단 ==========
    let lastFailReason = null;
    let lastDiagnosedPhase = null;

    const Phase = Object.freeze({
        STOPPED:     'STOPPED',
        NO_TABLE:    'NO_TABLE',
        NO_CHIPS:    'NO_CHIPS',
        BUTTON_DOWN: 'BUTTON_DOWN',
        READY:       'READY',
    });

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function toInt(value, fallback, min, max) {
        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(Math.max(n, min), max);
    }

    function parseNumber(text) {
        const raw = String(text || '').trim().toUpperCase();
        if (!raw) return null;
        const compact = raw.replace(/,/g, '');
        const m = compact.match(/-?\d+(?:\.\d+)?/);
        if (!m) return null;
        let n = parseFloat(m[0]);
        if (!Number.isFinite(n)) return null;
        const suffix = compact.slice(m.index + m[0].length).match(/^\s*([KMB])/);
        if (suffix) {
            if (suffix[1] === 'K') n *= 1000;
            if (suffix[1] === 'M') n *= 1000000;
            if (suffix[1] === 'B') n *= 1000000000;
        }
        return Math.round(n);
    }

    function formatMoney(n) {
        return Number.isFinite(n) ? n.toLocaleString('ko-KR') : String(n);
    }

    function formatChipPlan(chipPlan) {
        if (!chipPlan || chipPlan.length === 0) return '없음';
        return chipPlan.map(c => `${formatMoney(c.value)}×${c.count}`).join(' + ');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatBetLogValue(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.map(formatBetLogValue).join(', ');
        if (typeof value === 'object') {
            return Object.entries(value)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => `${k}=${formatBetLogValue(v)}`)
                .join(' ');
        }
        return String(value);
    }

    function normalizeBetLogData(data) {
        if (!data || typeof data !== 'object') return data ?? '';
        const out = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null || value === '') continue;
            if (Array.isArray(value)) {
                out[key] = value.map(item => typeof item === 'object' ? `{${formatBetLogValue(item)}}` : item).join('|');
            } else if (typeof value === 'object') {
                out[key] = formatBetLogValue(value);
            } else {
                out[key] = value;
            }
        }
        return out;
    }

    function pushBetLog(level, message, data = null) {
        const normalized = normalizeBetLogData(data);
        const item = {
            at: Date.now(),
            level: level || 'info',
            message: String(message || ''),
            data: normalized,
        };
        betDebugLog.unshift(item);
        if (betDebugLog.length > BET_DEBUG_LOG_LIMIT) betDebugLog.length = BET_DEBUG_LOG_LIMIT;

        const suffix = normalized && formatBetLogValue(normalized)
            ? ` ${formatBetLogValue(normalized)}`
            : '';
        const method = console[item.level] ? item.level : 'log';
        console[method](`[AutoTrigger][BetLog] ${item.message}${suffix}`);
    }

    function getBetDebugLogHtml(limit = 5) {
        if (!betDebugLog || betDebugLog.length <= 0) return '';
        const rows = betDebugLog.slice(0, limit).map(item => {
            const age = Math.max(0, Math.floor((Date.now() - item.at) / 1000));
            const color = item.level === 'error'
                ? '#ff9c9c'
                : (item.level === 'warn' ? '#ffd97a' : '#aee8ff');
            const dataText = formatBetLogValue(item.data);
            const data = dataText ? ` <span style="opacity:0.72;">${escapeHtml(dataText)}</span>` : '';
            return `<div><span style="opacity:0.65;">${age}s</span> <span style="color:${color};">${escapeHtml(item.message)}</span>${data}</div>`;
        }).join('');
        return `베팅 실패로그:<br><div style="max-height:92px; overflow:hidden; line-height:1.35; font-size:10.5px;">${rows}</div>`;
    }

    function getBetDebugExportPayload() {
        const safe = (fn, fallback) => {
            try { return fn(); } catch (e) { return fallback; }
        };
        const scriptLoad = safe(() => getScriptLoadState(), {
            mode: 'unknown',
            source: 'unknown',
            version: null,
            updateReadyVersion: null,
        });
        const seatNumbers = safe(() => uniqueSortedSeatNumbers([
            ...getControlledSeatNumbers(),
            ...(lastTargetSeatNumbers || []),
            ...getTrustedRememberedSeatNumbers(),
        ]), []);
        const seats = seatNumbers.map(n => safe(() => {
            const seat = getSeatByNumber(n);
            const state = getSeatBetState(seat);
            return {
                seat: n,
                visible: !!(seat && isVisible(seat)),
                controlled: isControlledSeatNumber(n),
                remembered: (lastTargetSeatNumbers || []).includes(n),
                amount: state.amountDetected ? state.amount : null,
                amountDetected: state.amountDetected,
                hasChip: state.hasChip,
                chipCount: state.chipCount,
                hasGhost: hasGhostChip(seat),
                clickCandidates: getSeatBetClickCandidates(seat).slice(0, 8).map(getElementLabel),
            };
        }, { seat: n, error: 'seat_snapshot_failed' }));

        return {
            exportedAt: new Date().toISOString(),
            settings: {
                threshold: THRESHOLD,
                targetBetAmount: TARGET_BET_AMOUNT,
                autoSeatCount: AUTO_SEAT_COUNT,
                seatCount: SEAT_COUNT,
            },
            state: {
                frameMode: typeof SCRIPT_FRAME_MODE === 'string' ? SCRIPT_FRAME_MODE : 'unknown',
                gameVersion: typeof SCRIPT_GAME_VERSION === 'string' ? SCRIPT_GAME_VERSION : 'unknown',
                loadMode: scriptLoad.mode,
                loadSource: scriptLoad.source,
                remoteVersion: scriptLoad.version,
                updateReadyVersion: scriptLoad.updateReadyVersion,
                scriptEnabled: SCRIPT_ENABLED,
                phase: lastDiagnosedPhase || null,
                failReason: lastFailReason,
                isRunning,
                isBetSetupRunning,
                betSettingsDirty,
                autoBetArmed,
                roundNumber: safe(() => getRoundNumber(), null),
                autoplayButtonReady: safe(() => isAutoplayButtonReady(), false),
                autoplayRunning: safe(() => isAutoplayRunning(), false),
                betClickGuardActive: safe(() => isBetClickGuardActive(), false),
                betClickGuardReason: lastBetClickGuardReason,
                betClickGuardRemainingMs: Math.max(0, betClickGuardUntil - Date.now()),
                lastBetClickDebug,
                lastBetClickDebugAt,
            },
            chips: safe(() => detectAvailableChips().map(chip => ({
                value: chip.value,
                label: formatMoney(chip.value),
                element: getElementLabel(chip.element),
            })), []),
            walletTotalBet: safe(() => getWalletTotalBetReading(), null),
            plan: safe(() => {
                const available = detectAvailableChips();
                const plan = getSeatPlan(getBettableSeats().length, available);
                return {
                    requested: plan.requested,
                    used: plan.used,
                    available: plan.available,
                    totalTarget: plan.totalTarget,
                    totalActual: plan.totalActual,
                    perSeatTarget: plan.perSeatTarget,
                    perSeatActual: plan.perSeatActual,
                    chipPlan: (plan.chipPlan || []).map(spec => ({ value: spec.value, count: spec.count })),
                };
            }, null),
            seats,
            logs: (betDebugLog || []).map(item => ({
                at: new Date(item.at).toISOString(),
                ageMs: Math.max(0, Date.now() - item.at),
                level: item.level,
                message: item.message,
                data: item.data,
            })),
        };
    }

    function exportBetDebugLog() {
        pushBetLog('info', 'bet_log_export_requested', {
            logs: (betDebugLog || []).length,
            reason: lastFailReason || 'none',
        });
        const payload = getBetDebugExportPayload();
        const text = JSON.stringify(payload, null, 2);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `autotrigger-betlog-${stamp}.json`;
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            link.remove();
        }, 1000);
        console.log(`[AutoTrigger] bet log exported: ${filename}`);
        return filename;
    }

    function emptyPlan() {
        return {
            requested: 1, used: 0, available: 0,
            totalTarget: 0, perSeatTarget: 0,
            perSeatActual: 0, totalActual: 0,
            chipPlan: [], availableChips: [],
            autoSeatCount: false,
        };
    }

    function isScriptStopped() {
        return !SCRIPT_ENABLED;
    }

    function isAutomationLocked() {
        return SAFETY_READ_ONLY_MODE;
    }

    function getMaxSeatCount() {
        return toInt(SEAT_COUNT, 1, 1, 7);
    }

    function getPlannedSeatLimit() {
        const maxSeats = getMaxSeatCount();
        if (!AUTO_SEAT_COUNT) return maxSeats;
        if (Number.isFinite(forcedAutoSeatCount) && forcedAutoSeatCount > 0) {
            return Math.min(maxSeats, toInt(forcedAutoSeatCount, maxSeats, 1, 7));
        }
        if (Number.isFinite(seatLimitOverride) && seatLimitOverride > 0) {
            return Math.min(maxSeats, toInt(seatLimitOverride, maxSeats, 1, 7));
        }
        if (
            lastSeatPlan?.totalActual > 0 &&
            lastSeatPlan.requested === maxSeats &&
            lastSeatPlan.autoSeatCount === AUTO_SEAT_COUNT
        ) {
            return Math.min(maxSeats, toInt(lastSeatPlan.used, maxSeats, 1, 7));
        }
        return maxSeats;
    }

    function getBetSettingsKey() {
        return [TARGET_BET_AMOUNT, SEAT_COUNT, AUTO_SEAT_COUNT ? 'auto' : 'manual'].join('|');
    }

    function loadRememberedSeatNumbers() {
        const saved = GM_getValue('lastTargetSeatNumbers', []);
        let raw = saved;
        if (typeof saved === 'string') {
            try {
                raw = JSON.parse(saved);
            } catch (_) {
                raw = saved.split(/[,|]/);
            }
        }
        return uniqueSortedSeatNumbers(Array.isArray(raw) ? raw : []);
    }

    function getLiveRememberedSeatEvidence(numbers = lastTargetSeatNumbers) {
        const remembered = uniqueSortedSeatNumbers(numbers);
        if (remembered.length <= 0) return [];

        const yellow = getYellowSeatRayNumbers();
        return remembered.filter(n => {
            const seat = getSeatByNumber(n);
            if (!seat || !isVisible(seat)) return false;
            if (hasSeatCloseButton(seat) || hasOwnSeatDomMarker(seat)) return true;
            if (isSeatTakenByOther(seat)) return false;
            if (yellow.includes(n)) return true;

            const state = getSeatBetState(seat);
            return !!(state.hasChip || (state.amountDetected && state.amount > 0));
        });
    }

    function hasLiveRememberedSeatEvidence(n) {
        const seatNumber = normalizeSeatNumber(n);
        return seatNumber !== null && getLiveRememberedSeatEvidence([seatNumber]).includes(seatNumber);
    }

    function isTargetSeatMemoryRecentlyActive() {
        const recentlyConfirmed = lastTargetSeatRememberedAt > 0 &&
            Date.now() - lastTargetSeatRememberedAt <= TARGET_SEAT_MEMORY_GUARD_MS;
        const activeBetContext = isBetSetupRunning ||
            betSettingsDirty ||
            autoBetArmed ||
            isBetSettingsApplied() ||
            (lastRoundCountSeenAt > 0 && Date.now() - lastRoundCountSeenAt <= TARGET_SEAT_MEMORY_GUARD_MS) ||
            (lastSeatPlan?.totalActual || 0) > 0;
        return recentlyConfirmed && activeBetContext;
    }

    function isTargetSeatMemoryTrusted(numbers = lastTargetSeatNumbers) {
        const remembered = uniqueSortedSeatNumbers(numbers);
        if (remembered.length <= 0) return false;

        const liveEvidence = getLiveRememberedSeatEvidence(remembered);
        const bettingWindowOpen = typeof isBettingWindowOpen === 'function' && isBettingWindowOpen();
        if (!bettingWindowOpen && isTargetSeatMemoryRecentlyActive()) return true;
        return liveEvidence.length === remembered.length;
    }

    function getTrustedRememberedSeatNumbers() {
        const now = Date.now();
        const limit = getPlannedSeatLimit();
        const remembered = uniqueSortedSeatNumbers(lastTargetSeatNumbers).slice(0, limit);
        const liveEvidence = getLiveRememberedSeatEvidence(remembered);
        const bettingWindowOpen = typeof isBettingWindowOpen === 'function' && isBettingWindowOpen();
        const cacheKey = [
            remembered.join(','),
            liveEvidence.join(','),
            bettingWindowOpen ? 1 : 0,
            limit,
            lastTargetSeatRememberedAt,
            lastAppliedBetSettingsKey,
            betSettingsDirty ? 1 : 0,
            autoBetArmed ? 1 : 0,
            isBetSetupRunning ? 1 : 0,
            lastRoundCountSeenAt,
            lastSeatPlan?.totalActual || 0,
        ].join('|');
        if (
            _trustedRememberedSeatNumbersCache &&
            _trustedRememberedSeatNumbersCacheKey === cacheKey &&
            now - _trustedRememberedSeatNumbersCacheAt < TRUSTED_SEAT_MEMORY_CACHE_MS
        ) {
            return _trustedRememberedSeatNumbersCache;
        }

        const preserveRecentRoundMemory = !bettingWindowOpen && isTargetSeatMemoryRecentlyActive();
        const value = preserveRecentRoundMemory ? remembered : liveEvidence;
        _trustedRememberedSeatNumbersCache = value;
        _trustedRememberedSeatNumbersCacheAt = now;
        _trustedRememberedSeatNumbersCacheKey = cacheKey;
        return value;
    }

    function rememberTargetSeatNumbers(numbers, options = {}) {
        const limit = getPlannedSeatLimit();
        const incoming = uniqueSortedSeatNumbers(numbers).slice(0, limit);
        const previous = uniqueSortedSeatNumbers(lastTargetSeatNumbers).slice(0, limit);
        const allowShrink = !!options.allowShrink;
        const refresh = options.refresh !== false;
        const memoryTrusted = isTargetSeatMemoryTrusted(previous);
        const partialLiveRefresh = !allowShrink &&
            incoming.length > 0 &&
            incoming.length < previous.length &&
            incoming.every(n => previous.includes(n)) &&
            isTargetSeatMemoryRecentlyActive();

        let next = incoming;
        if (!allowShrink && (memoryTrusted || partialLiveRefresh) && previous.length > 0) {
            const merged = [];
            for (const n of previous) {
                if (!merged.includes(n) && merged.length < limit) merged.push(n);
            }
            for (const n of incoming) {
                if (!merged.includes(n) && merged.length < limit) merged.push(n);
            }
            next = uniqueSortedSeatNumbers(merged);
        }

        lastTargetSeatNumbers = next;
        _trustedRememberedSeatNumbersCache = null;
        _trustedRememberedSeatNumbersCacheAt = 0;
        _trustedRememberedSeatNumbersCacheKey = '';
        if (lastTargetSeatNumbers.length > 0 && refresh) {
            lastTargetSeatRememberedAt = Date.now();
            lastTargetSeatMemoryReason = options.reason || 'remembered';
        } else if (lastTargetSeatNumbers.length <= 0) {
            lastTargetSeatRememberedAt = 0;
            lastTargetSeatMemoryReason = '';
        }
        GM_setValue('lastTargetSeatNumbers', lastTargetSeatNumbers);
        return lastTargetSeatNumbers;
    }

    function clearRememberedSeatNumbers() {
        lastTargetSeatNumbers = [];
        lastTargetSeatRememberedAt = 0;
        lastTargetSeatMemoryReason = '';
        _trustedRememberedSeatNumbersCache = null;
        _trustedRememberedSeatNumbersCacheAt = 0;
        _trustedRememberedSeatNumbersCacheKey = '';
        GM_setValue('lastTargetSeatNumbers', []);
    }

    function isBetSettingsApplied() {
        return lastAppliedBetSettingsKey === getBetSettingsKey();
    }

    function markBetSettingsApplied() {
        lastAppliedBetSettingsKey = getBetSettingsKey();
        GM_setValue('lastAppliedBetSettingsKey', lastAppliedBetSettingsKey);
    }

    function markSettingsInputPending() {
        settingsInputPendingUntil = Date.now() + SETTINGS_INPUT_SETTLE_MS;
    }

    function clearSettingsInputPending() {
        settingsInputPendingUntil = 0;
    }

    function isSettingsInputPending() {
        return settingsInputPendingUntil > Date.now();
    }

    function syncSettingsFromUI() {
        const thresholdInput = document.getElementById('at-threshold');
        const amountInput = document.getElementById('at-bet-amount');
        const seatInput = document.getElementById('at-seat-count');
        const autoSeatInput = document.getElementById('at-auto-seat');
        if (!thresholdInput || !amountInput || !seatInput) return false;

        const prevKey = getBetSettingsKey();
        THRESHOLD = toInt(thresholdInput.value, THRESHOLD, 0, 9999);
        TARGET_BET_AMOUNT = toInt(amountInput.value, TARGET_BET_AMOUNT, 0, 999999999);
        SEAT_COUNT = toInt(seatInput.value, SEAT_COUNT, 1, 7);
        AUTO_SEAT_COUNT = autoSeatInput ? !!autoSeatInput.checked : AUTO_SEAT_COUNT;

        thresholdInput.value = THRESHOLD;
        amountInput.value = TARGET_BET_AMOUNT;
        seatInput.value = SEAT_COUNT;
        if (autoSeatInput) autoSeatInput.checked = AUTO_SEAT_COUNT;

        GM_setValue('threshold', THRESHOLD);
        GM_setValue('targetBetAmount', TARGET_BET_AMOUNT);
        GM_setValue('seatCount', SEAT_COUNT);
        GM_setValue('autoSeatCount', AUTO_SEAT_COUNT);

        const changed = getBetSettingsKey() !== prevKey;
        if (changed) {
            betSettingsDirty = true;
            autoBetArmed = false;
            lastBetSetupAt = 0;
            lastSeatPlan = emptyPlan();
            rememberTargetSeatNumbers(lastTargetSeatNumbers, { allowShrink: true, refresh: false, reason: 'settings_changed' });
            console.log(`[AutoTrigger] settings synced: amount=${TARGET_BET_AMOUNT}, seats=${SEAT_COUNT}, autoSeat=${AUTO_SEAT_COUNT}`);
        }
        return changed;
    }

    function observeAutoplayRoundNumber(value = getRoundNumber()) {
        if (value !== null) {
            autoBetArmed = true;
            lastRoundCountSeenAt = Date.now();
        }
        return value;
    }

    function markBetStateNeedsRecovery(reason) {
        autoBetArmed = false;
        betSettingsDirty = true;
        lastBetSetupAt = 0;
        lastFailReason = reason;
        if (Date.now() - lastRecoveryAt < AUTOBET_RECOVERY_COOLDOWN_MS) return false;
        lastRecoveryAt = Date.now();
        console.warn(`[AutoTrigger] ${reason} → 베팅 상태 복구 예약`);
        return true;
    }

    function markBetClickGuard(reason, data = {}) {
        betClickGuardUntil = Math.max(betClickGuardUntil, Date.now() + BET_CLICK_UNCERTAIN_GUARD_MS);
        lastBetClickGuardReason = reason || 'bet_click_verification_guard';
        lastFailReason = lastBetClickGuardReason;
        pushBetLog('warn', 'bet_click_guard', {
            reason: lastBetClickGuardReason,
            waitMs: BET_CLICK_UNCERTAIN_GUARD_MS,
            ...data,
        });
    }

    function isBetClickGuardActive() {
        if (Date.now() < betClickGuardUntil) return true;
        if (betClickGuardUntil > 0) {
            betClickGuardUntil = 0;
            lastBetClickGuardReason = '';
        }
        return false;
    }

    function isBetRestoreReason(reason = lastFailReason) {
        return [
            'autoplay_count_missing',
            'autoplay_count_missing_after_start',
            'bet_amount_not_detected_current',
            'bet_amount_not_detected_after_setup',
            'bet_amount_unknown_under_target',
            'bet_amount_unknown_unverified',
            'wallet_total_not_zero_before_setup',
            'bet_total_over_target',
            'bet_total_over_target_after_setup',
            'bet_total_mismatch',
            'bet_total_under_target_after_setup',
            'chips_missing',
            'start_btn_missing',
        ].includes(reason);
    }

    function resetTransientState(reason) {
        isRunning = false;
        lastTriggerAt = 0;
        lastBetSetupAt = 0;
        lastDealClickAt = 0;
        lastInsuranceClickAt = 0;
        lastSitPromptHandledAt = 0;
        isBetSetupRunning = false;
        autoBetArmed = false;
        lastRoundCountSeenAt = 0;
        lastRecoveryAt = 0;
        betClickGuardUntil = 0;
        lastBetClickGuardReason = '';
        lastAppliedBetSettingsKey = '';
        GM_setValue('lastAppliedBetSettingsKey', '');
        supportPopupRecoveryPendingAt = 0;
        GM_setValue('supportPopupRecoveryPendingAt', 0);
        pendingSitSeats.clear();
        seatLimitOverride = null;
        forcedAutoSeatCount = null;
        forceSitPromptSeatUntil = 0;
        clearSettingsInputPending();
        lastSeatPlan = emptyPlan();
        clearRememberedSeatNumbers();
        betSettingsDirty = true;
        lastFailReason = null;
        console.log('[AutoTrigger] state reset:', reason);
    }
