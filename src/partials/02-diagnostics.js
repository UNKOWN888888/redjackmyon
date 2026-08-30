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

    const BET_STAGE_LABELS = Object.freeze({
        idle: '대기',
        sequence_start: '실행 판단',
        setup_start: '베팅 준비',
        seats_ready: '좌석 확인',
        plan_ready: '칩 계획 완료',
        reset_existing: '기존 베팅 정리',
        resume_partial: '검증 지점부터 재개',
        select_chip: '칩 선택',
        place_chip: '좌석에 칩 베팅',
        chip_step_verified: '칩 단계 검증',
        bet_ready: '베팅 총액 검증 완료',
        autoplay_open: '자동베팅 메뉴 열기',
        autoplay_start: '자동베팅 100회 시작',
        autoplay_confirm_wait: '자동베팅 시작 확인 대기',
        autoplay_rearm_wait: '자동베팅 재시도 대기',
        running: '자동베팅 실행 중',
        recovery_wait: '복구 대기',
        blocked: '실행 중단',
        stopped: '스크립트 정지',
    });

    const FAIL_REASON_LABELS = Object.freeze({
        bet_total_mismatch: '좌석 표시 합계와 계획 금액이 다름',
        bet_total_over_target: '총 베팅금액이 목표를 초과함',
        bet_total_under_target_after_setup: '칩 베팅 후 총액이 목표보다 적음',
        bet_total_over_target_after_setup: '칩 베팅 후 총액이 목표를 초과함',
        bet_amount_unknown_current: '좌석 칩 금액을 판독하지 못함',
        bet_amount_not_detected_current: '현재 좌석에서 유효한 칩을 확인하지 못함',
        bet_amount_not_detected_after_setup: '칩 클릭 후 좌석 금액을 확인하지 못함',
        wallet_total_not_zero_before_setup: '기존 베팅 총액이 0원으로 정리되지 않음',
        wallet_total_missing_before_autoplay: '자동베팅 전 지갑 총 베팅을 찾지 못함',
        wallet_total_mismatch_before_autoplay: '자동베팅 전 지갑 총액이 계획과 다름',
        broadcast_seat_set_mismatch: '브로드캐스트 좌석 집합이 계획과 다름',
        broadcast_seat_set_mismatch_before_bet: '칩 클릭 직전 좌석 집합이 바뀜',
        broadcast_single_unverified_wait: '칩 클릭 이벤트가 좌석과 지갑에 반영되지 않아 안전 대기',
        broadcast_click_unverified_wait: '연속 칩 클릭 이벤트가 좌석과 지갑에 반영되지 않아 안전 대기',
        individual_click_unverified_wait: '개별 좌석 칩 클릭이 반영되지 않아 안전 대기',
        chips_missing: '베팅 칩을 찾지 못함',
        no_chips_detected: '베팅 칩을 찾지 못함',
        autoplay_btn_missing: '자동베팅 버튼을 찾지 못함',
        autoplay_btn_not_ready: '자동베팅 버튼이 아직 활성화되지 않음',
        autoplay_count_missing_after_start: '100회 클릭 후 횟수를 확인하지 못함',
        settings_changed_during_bet_setup: '베팅 중 설정값이 변경됨',
    });

    function getBetRuntimeStageLabel(stage = betRuntimeStage) {
        return BET_STAGE_LABELS[stage] || String(stage || '대기');
    }

    function getFailReasonLabel(reason = lastFailReason) {
        if (!reason) return '';
        if (FAIL_REASON_LABELS[reason]) return FAIL_REASON_LABELS[reason];
        if (/^select_chip_\d+$/.test(reason)) return `${formatMoney(parseInt(reason.slice(12), 10))}원 칩 선택 실패`;
        if (/^broadcast_chip_\d+$/.test(reason)) return `${formatMoney(parseInt(reason.slice(15), 10))}원 칩 베팅 실패`;
        return String(reason).replace(/_/g, ' ');
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

    function getBetPlanExecutionSignature(plan) {
        if (!plan) return '';
        const chips = (plan.chipPlan || [])
            .map(spec => `${Math.floor(spec?.value || 0)}x${Math.floor(spec?.count || 0)}`)
            .join('+');
        return [
            Math.floor(plan.used || 0),
            Math.floor(plan.perSeatActual || 0),
            Math.floor(plan.totalActual || 0),
            chips,
        ].join('|');
    }

    function getRemainingChipPlanFromAppliedPerSeat(chipPlan, appliedPerSeat) {
        let consumedAmount = Math.floor(appliedPerSeat || 0);
        if (!Number.isFinite(consumedAmount) || consumedAmount < 0) return null;
        const remaining = [];
        for (const spec of chipPlan || []) {
            const value = Math.floor(spec?.value || 0);
            const count = Math.floor(spec?.count || 0);
            if (!Number.isFinite(value) || value <= 0 || count <= 0) continue;
            const specAmount = value * count;
            if (consumedAmount >= specAmount) {
                consumedAmount -= specAmount;
                continue;
            }
            if (consumedAmount % value !== 0) return null;
            const consumedCount = consumedAmount / value;
            if (!Number.isInteger(consumedCount) || consumedCount < 0 || consumedCount > count) return null;
            remaining.push({ ...spec, count: count - consumedCount });
            consumedAmount = 0;
        }
        return consumedAmount === 0 ? remaining.filter(spec => spec.count > 0) : null;
    }

    function getCurrentBetSettingsKeySafe() {
        return typeof getBetSettingsKey === 'function' ? getBetSettingsKey() : '';
    }

    function normalizeProgressSeatNumbers(numbers) {
        return Array.from(new Set((numbers || [])
            .map(value => parseInt(value, 10))
            .filter(value => Number.isFinite(value) && value >= 1 && value <= 7)))
            .sort((a, b) => a - b);
    }

    function updateVerifiedBetProgress(plan, seatNumbers, perSeatApplied, data = {}) {
        const seats = normalizeProgressSeatNumbers(seatNumbers);
        const amount = Math.floor(perSeatApplied || 0);
        if (!plan || seats.length <= 0 || !Number.isFinite(amount) || amount < 0) return null;
        const remainingChipPlan = getRemainingChipPlanFromAppliedPerSeat(plan.chipPlan, amount);
        if (remainingChipPlan === null) return null;
        verifiedBetProgress = {
            settingsKey: getCurrentBetSettingsKeySafe(),
            planSignature: getBetPlanExecutionSignature(plan),
            seats,
            perSeatApplied: amount,
            walletAmount: amount * seats.length,
            nextChip: remainingChipPlan[0]?.value || null,
            remainingChipPlan: remainingChipPlan.map(spec => ({ value: spec.value, count: spec.count })),
            updatedAt: Date.now(),
            source: data.source || 'setup',
        };
        return verifiedBetProgress;
    }

    function clearVerifiedBetProgress(reason = '') {
        if (verifiedBetProgress && reason) {
            pushBetLog('info', 'verified_progress_cleared', {
                reason,
                wallet: formatMoney(verifiedBetProgress.walletAmount),
                seats: verifiedBetProgress.seats.join(','),
            });
        }
        verifiedBetProgress = null;
    }

    function getMatchingVerifiedBetProgress(plan, seatNumbers) {
        const progress = verifiedBetProgress;
        if (!progress || !plan) return null;
        const ttl = typeof VERIFIED_BET_PROGRESS_TTL_MS === 'number' ? VERIFIED_BET_PROGRESS_TTL_MS : 120000;
        if (Date.now() - progress.updatedAt > ttl) return null;
        if (progress.settingsKey !== getCurrentBetSettingsKeySafe()) return null;
        if (progress.planSignature !== getBetPlanExecutionSignature(plan)) return null;
        const seats = normalizeProgressSeatNumbers(seatNumbers);
        if (seats.join(',') !== progress.seats.join(',')) return null;
        return progress;
    }

    function isVerifiedBetProgressComplete(plan, seatNumbers) {
        const progress = getMatchingVerifiedBetProgress(plan, seatNumbers);
        return !!progress &&
            progress.perSeatApplied === plan.perSeatActual &&
            progress.walletAmount === plan.totalActual;
    }

    function getResumableVerifiedBetProgress(plan, seatNumbers) {
        const progress = getMatchingVerifiedBetProgress(plan, seatNumbers);
        if (!progress || progress.perSeatApplied <= 0 || progress.perSeatApplied >= plan.perSeatActual) return null;
        const remainingChipPlan = getRemainingChipPlanFromAppliedPerSeat(plan.chipPlan, progress.perSeatApplied);
        if (!remainingChipPlan || remainingChipPlan.length <= 0) return null;
        const wallet = typeof getWalletTotalBetReading === 'function' ? getWalletTotalBetReading() : null;
        if (!wallet?.detected || wallet.ambiguous || wallet.amount !== progress.walletAmount) return null;
        if (typeof getBroadcastSeatTargetState === 'function' && !getBroadcastSeatTargetState(progress.seats).exact) return null;
        const seatsReady = progress.seats.every(seatNumber => {
            const seat = getSeatByNumber(seatNumber);
            const state = getSeatBetState(seat);
            return !!seat && state.hasChip && !hasGhostChip(seat);
        });
        return seatsReady ? { ...progress, remainingChipPlan } : null;
    }

    function setBetRuntimeStage(stage, data = {}, level = 'info') {
        const nextStage = String(stage || 'idle');
        const normalized = normalizeBetLogData(data) || {};
        const previousStage = betRuntimeStage;
        const previousData = formatBetLogValue(betRuntimeStageData);
        const nextData = formatBetLogValue(normalized);
        if (previousStage === nextStage && previousData === nextData) return false;
        betRuntimeStage = nextStage;
        betRuntimeStageAt = Date.now();
        betRuntimeStageData = normalized;
        pushBetLog(level, 'stage_changed', {
            from: previousStage,
            to: nextStage,
            ...normalized,
        });
        return true;
    }

    function persistBetDebugLogNow() {
        if (betDebugLogPersistTimer !== null) {
            clearTimeout(betDebugLogPersistTimer);
            betDebugLogPersistTimer = null;
        }
        try {
            const result = GM_setValue(BET_DEBUG_LOG_STORAGE_KEY, betDebugLog.slice(0, BET_DEBUG_LOG_LIMIT));
            if (result && typeof result.catch === 'function') {
                result.catch(error => console.warn('[AutoTrigger] recent bet log persist failed:', error));
            }
            return true;
        } catch (error) {
            console.warn('[AutoTrigger] recent bet log persist failed:', error);
            return false;
        }
    }

    function scheduleBetDebugLogPersist(immediate = false) {
        if (immediate) return persistBetDebugLogNow();
        if (betDebugLogPersistTimer !== null) return true;
        betDebugLogPersistTimer = setTimeout(() => {
            betDebugLogPersistTimer = null;
            persistBetDebugLogNow();
        }, BET_DEBUG_LOG_PERSIST_DELAY_MS);
        return true;
    }

    function pushBetLog(level, message, data = null) {
        const normalized = normalizeBetLogData(data);
        const item = {
            sequence: ++betLogSequence,
            sessionId: SCRIPT_SESSION_ID,
            scriptVersion: SCRIPT_VERSION,
            at: Date.now(),
            level: level || 'info',
            stage: betRuntimeStage,
            message: String(message || ''),
            data: normalized,
        };
        betDebugLog.unshift(item);
        if (betDebugLog.length > BET_DEBUG_LOG_LIMIT) betDebugLog.length = BET_DEBUG_LOG_LIMIT;
        scheduleBetDebugLogPersist(item.level === 'error' || item.level === 'warn');

        const suffix = normalized && formatBetLogValue(normalized)
            ? ` ${formatBetLogValue(normalized)}`
            : '';
        const method = console[item.level] ? item.level : 'log';
        console[method](`[AutoTrigger][BetLog] ${item.message}${suffix}`);
    }

    function getRecentBetLogExportRows(oldestFirst = false, now = Date.now()) {
        const rows = (betDebugLog || []).slice(0, BET_DEBUG_LOG_LIMIT).map(item => {
            const at = Number.isFinite(item.at) ? item.at : now;
            return {
                sequence: Number.isFinite(item.sequence) ? item.sequence : 0,
                sessionId: item.sessionId || 'legacy',
                scriptVersion: item.scriptVersion || 'unknown',
                at: new Date(at).toISOString(),
                ageMs: Math.max(0, now - at),
                level: item.level || 'info',
                stage: item.stage || 'idle',
                stageLabel: getBetRuntimeStageLabel(item.stage),
                message: item.message || '',
                data: item.data ?? null,
            };
        });
        return oldestFirst ? rows.reverse() : rows;
    }

    function getBetDebugLogHtml(limit = 8) {
        if (!betDebugLog || betDebugLog.length <= 0) {
            return '<div class="at-log-empty">아직 기록된 실행 로그가 없습니다.</div>';
        }
        const rows = betDebugLog.slice(0, limit).map(item => {
            const stamp = new Date(item.at);
            const time = `${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}:${String(stamp.getSeconds()).padStart(2, '0')}.${String(stamp.getMilliseconds()).padStart(3, '0')}`;
            const dataText = formatBetLogValue(item.data);
            const data = dataText ? `<div class="at-log-data">${escapeHtml(dataText)}</div>` : '';
            return `<div class="at-log-row at-log-${escapeHtml(item.level)}"><div class="at-log-line"><span class="at-log-dot"></span><span class="at-log-time">#${item.sequence || 0} ${time}</span><span class="at-log-stage">${escapeHtml(getBetRuntimeStageLabel(item.stage))}</span><span class="at-log-message">${escapeHtml(item.message)}</span></div>${data}</div>`;
        }).join('');
        return rows;
    }

    function logBetMismatchSnapshot(reason, summary, plan, seatNumbers, source = 'watcher') {
        const safe = (fn, fallback) => {
            try { return fn(); } catch (_) { return fallback; }
        };
        const seats = normalizeProgressSeatNumbers(seatNumbers);
        const wallet = safe(() => getWalletTotalBetReading(), null);
        const seatText = (summary?.amounts || []).map(item => {
            const amount = Number.isFinite(item.amount) ? item.amount : (item.hasChip ? '?' : 0);
            return `${item.seatNumber}:${amount}${item.hasGhost ? ':ghost' : ''}`;
        }).join(',');
        const progress = getMatchingVerifiedBetProgress(plan, seats);
        const data = {
            reason,
            source,
            stage: betRuntimeStage,
            seats: seats.join(','),
            seatAmounts: seatText || 'none',
            seatTotal: Number.isFinite(summary?.total) ? formatMoney(summary.total) : 'unknown',
            wallet: Number.isFinite(wallet?.amount) ? formatMoney(wallet.amount) : 'unknown',
            walletValues: (wallet?.values || []).map(formatMoney).join(','),
            expectedTotal: Number.isFinite(plan?.totalActual) ? formatMoney(plan.totalActual) : 'unknown',
            expectedPerSeat: Number.isFinite(plan?.perSeatActual) ? formatMoney(plan.perSeatActual) : 'unknown',
            verifiedWallet: progress ? formatMoney(progress.walletAmount) : 'none',
            verifiedPerSeat: progress ? formatMoney(progress.perSeatApplied) : 'none',
            nextChip: progress?.nextChip ? formatMoney(progress.nextChip) : 'none',
            selectedChip: safe(() => formatMoney(getEffectiveSelectedChipAmount()), 'unknown'),
        };
        const fingerprint = formatBetLogValue(data);
        const repeatMs = typeof BET_MISMATCH_LOG_REPEAT_MS === 'number' ? BET_MISMATCH_LOG_REPEAT_MS : 2000;
        if (fingerprint === lastBetMismatchFingerprint && Date.now() - lastBetMismatchLoggedAt < repeatMs) return false;
        lastBetMismatchFingerprint = fingerprint;
        lastBetMismatchLoggedAt = Date.now();
        pushBetLog('warn', 'bet_state_mismatch_snapshot', data);
        return true;
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
        const exportNow = Date.now();
        const logsNewestFirst = getRecentBetLogExportRows(false, exportNow);
        const recentExecutionLogs = logsNewestFirst.slice().reverse();

        return {
            exportedAt: new Date().toISOString(),
            settings: {
                threshold: THRESHOLD,
                targetBetAmount: TARGET_BET_AMOUNT,
                autoSeatCount: AUTO_SEAT_COUNT,
                seatCount: SEAT_COUNT,
            },
            state: {
                scriptVersion: typeof SCRIPT_VERSION === 'string' ? SCRIPT_VERSION : 'unknown',
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
                autoplayStartPending: safe(() => isAutoplayStartConfirmationPending(), false),
                autoplayStartPendingAt: autoplayStartPendingAt > 0 ? new Date(autoplayStartPendingAt).toISOString() : null,
                autoplayStartPendingRemainingMs: Math.max(0, autoplayStartPendingUntil - exportNow),
                autoplayStartPendingContext,
                autoplayStartTransitionGuardRemainingMs: Math.max(0, autoplayStartTransitionGuardUntil - exportNow),
                betClickGuardActive: safe(() => isBetClickGuardActive(), false),
                betClickGuardReason: lastBetClickGuardReason,
                betClickGuardRemainingMs: Math.max(0, betClickGuardUntil - Date.now()),
                lastBetClickDebug,
                lastBetClickDebugAt,
                runtimeStage: betRuntimeStage,
                runtimeStageLabel: getBetRuntimeStageLabel(),
                runtimeStageAt: new Date(betRuntimeStageAt).toISOString(),
                runtimeStageAgeMs: Math.max(0, Date.now() - betRuntimeStageAt),
                runtimeStageData: betRuntimeStageData,
                sessionId: SCRIPT_SESSION_ID,
                sessionStartedAt: new Date(SCRIPT_SESSION_STARTED_AT).toISOString(),
                sessionAgeMs: Math.max(0, exportNow - SCRIPT_SESSION_STARTED_AT),
                verifiedBetProgress: verifiedBetProgress ? {
                    ...verifiedBetProgress,
                    updatedAt: new Date(verifiedBetProgress.updatedAt).toISOString(),
                    ageMs: Math.max(0, Date.now() - verifiedBetProgress.updatedAt),
                } : null,
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
            logWindow: {
                count: recentExecutionLogs.length,
                capacity: BET_DEBUG_LOG_LIMIT,
                retentionHours: BET_DEBUG_LOG_RETENTION_MS / (60 * 60 * 1000),
                order: 'oldest_to_newest',
                oldestAt: recentExecutionLogs[0]?.at || null,
                newestAt: recentExecutionLogs[recentExecutionLogs.length - 1]?.at || null,
            },
            recentExecutionLogs,
            logs: logsNewestFirst,
        };
    }

    function downloadBetLogWithTampermonkey(url, filename) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let handle = null;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                callback(value);
            };
            const timer = setTimeout(() => {
                try { handle?.abort?.(); } catch (_) {}
                finish(reject, new Error('Tampermonkey 다운로드 응답 시간 초과'));
            }, 8000);
            try {
                handle = GM_download({
                    url,
                    name: filename,
                    saveAs: false,
                    conflictAction: 'uniquify',
                    onload: () => finish(resolve, true),
                    onerror: error => finish(reject, new Error(`Tampermonkey 다운로드 실패: ${error?.error || error?.details || 'unknown'}`)),
                    ontimeout: () => finish(reject, new Error('Tampermonkey 다운로드 시간 초과')),
                    onabort: () => finish(reject, new Error('Tampermonkey 다운로드 취소')),
                });
            } catch (error) {
                finish(reject, error);
            }
        });
    }

    function triggerBrowserBetLogDownload(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        try {
            link.click();
            return true;
        } finally {
            link.remove();
        }
    }

    async function copyBetLogTextToClipboard(text) {
        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text, { type: 'text', mimetype: 'application/json' });
                return true;
            }
        } catch (error) {
            console.warn('[AutoTrigger] GM clipboard copy failed:', error);
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (error) {
            console.warn('[AutoTrigger] browser clipboard copy failed:', error);
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand?.('copy') === true;
            textarea.remove();
            return copied;
        } catch (_) {
            return false;
        }
    }

    async function exportBetDebugLog() {
        pushBetLog('info', 'bet_log_export_requested', {
            logs: (betDebugLog || []).length,
            reason: lastFailReason || 'none',
        });
        persistBetDebugLogNow();
        const payload = getBetDebugExportPayload();
        const text = JSON.stringify(payload, null, 2);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `autotrigger-betlog-${stamp}.json`;
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        let method = '';
        let copied = false;
        let tampermonkeyError = '';
        try {
            if (typeof GM_download === 'function') {
                try {
                    await downloadBetLogWithTampermonkey(url, filename);
                    method = 'tampermonkey_download';
                } catch (error) {
                    tampermonkeyError = error?.message || String(error);
                    console.warn('[AutoTrigger] Tampermonkey log download failed; using browser fallback:', error);
                }
            }

            if (!method) {
                const copyPromise = copyBetLogTextToClipboard(text);
                const browserRequested = triggerBrowserBetLogDownload(url, filename);
                copied = await copyPromise;
                method = browserRequested ? 'browser_download' : (copied ? 'clipboard' : '');
            }
            if (!method) throw new Error('로그 파일 저장과 클립보드 복사에 모두 실패했습니다.');

            pushBetLog('info', 'bet_log_export_completed', {
                filename,
                logs: payload.logWindow.count,
                method,
                copied: copied ? 'Y' : 'N',
                tampermonkeyError: tampermonkeyError || 'none',
            });
            console.log(`[AutoTrigger] recent bet log exported: ${filename} (${payload.logWindow.count} logs, ${method})`);
            return {
                filename,
                logCount: payload.logWindow.count,
                method,
                copied,
                tampermonkeyError,
            };
        } finally {
            if (method === 'tampermonkey_download') {
                URL.revokeObjectURL(url);
            } else {
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }
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
            clearAutoplayStartConfirmation('settings_changed');
            betSettingsDirty = true;
            autoBetArmed = false;
            lastBetSetupAt = 0;
            lastSeatPlan = emptyPlan();
            clearVerifiedBetProgress('settings_changed');
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

    function clearAutoplayStartConfirmation(reason = '') {
        const previous = {
            pendingAt: autoplayStartPendingAt,
            pendingUntil: autoplayStartPendingUntil,
            context: autoplayStartPendingContext,
        };
        autoplayStartPendingAt = 0;
        autoplayStartPendingUntil = 0;
        autoplayStartPendingContext = '';
        autoplayStartTransitionGuardUntil = 0;
        return { ...previous, reason };
    }

    function beginAutoplayStartConfirmation(context, data = {}) {
        const now = Date.now();
        autoplayStartPendingAt = now;
        autoplayStartPendingUntil = now + AUTOPLAY_START_PENDING_GRACE_MS;
        autoplayStartPendingContext = context || 'autoplay_start';
        autoBetArmed = true;
        lastRoundCountSeenAt = now;
        lastFailReason = null;
        if (typeof markAutoplayModalAction === 'function') markAutoplayModalAction();
        setBetRuntimeStage('autoplay_confirm_wait', {
            context: autoplayStartPendingContext,
            graceMs: AUTOPLAY_START_PENDING_GRACE_MS,
            ...data,
        });
        pushBetLog('info', 'autoplay_start_confirmation_started', {
            context: autoplayStartPendingContext,
            graceMs: AUTOPLAY_START_PENDING_GRACE_MS,
            ...data,
        });
    }

    function isAutoplayStartConfirmationPending() {
        if (autoplayStartPendingUntil <= 0) return false;
        const now = Date.now();
        if (now < autoplayStartPendingUntil) return true;

        const expired = clearAutoplayStartConfirmation('expired');
        autoplayStartTransitionGuardUntil = now + AUTOPLAY_POST_START_STABILIZE_MS;
        pushBetLog('warn', 'autoplay_start_confirmation_expired', {
            context: expired.context || 'unknown',
            waitedMs: expired.pendingAt > 0 ? now - expired.pendingAt : 0,
        });
        setBetRuntimeStage('autoplay_rearm_wait', {
            reason: 'autoplay_start_confirmation_expired',
            context: expired.context || 'unknown',
        }, 'warn');
        return false;
    }

    function observeAutoplayStartConfirmation(context = 'poll') {
        const round = observeAutoplayRoundNumber();
        const stopButton = typeof getAutoplayStopButton === 'function' ? getAutoplayStopButton() : null;
        const signal = round !== null ? 'round_counter' : (stopButton ? 'stop_button' : 'none');
        if (signal === 'none') {
            return {
                confirmed: false,
                pending: isAutoplayStartConfirmationPending(),
                round: null,
                signal,
            };
        }

        const confirmedAt = Date.now();
        const pending = clearAutoplayStartConfirmation('confirmed');
        autoplayStartTransitionGuardUntil = confirmedAt + AUTOPLAY_POST_START_STABILIZE_MS;
        autoBetArmed = true;
        lastRoundCountSeenAt = confirmedAt;
        if (pending.pendingAt > 0) {
            lastFailReason = null;
            pushBetLog('info', 'autoplay_start_confirmed', {
                context: pending.context || context,
                observedBy: context,
                signal,
                round: round !== null ? round : 'not_visible',
                elapsedMs: confirmedAt - pending.pendingAt,
            });
            setBetRuntimeStage('running', {
                round: round !== null ? round : '확인 중',
                signal,
                threshold: THRESHOLD,
            });
        }
        return { confirmed: true, pending: false, round, signal };
    }

    function isAutoplayStartTransitionGuardActive() {
        if (autoplayStartTransitionGuardUntil <= 0) return false;
        if (Date.now() < autoplayStartTransitionGuardUntil) return true;
        autoplayStartTransitionGuardUntil = 0;
        return false;
    }

    async function waitForAutoplayStartConfirmation(context) {
        let confirmation = observeAutoplayStartConfirmation(context);
        const confirmed = confirmation.confirmed || await waitForCondition(() => {
            confirmation = observeAutoplayStartConfirmation(context);
            return confirmation.confirmed;
        }, AUTOBET_COUNT_VERIFY_MS, 30);
        if (confirmed) return confirmation;

        const now = Date.now();
        pushBetLog('warn', 'autoplay_start_confirmation_deferred', {
            context,
            verifyMs: AUTOBET_COUNT_VERIFY_MS,
            remainingGraceMs: Math.max(0, autoplayStartPendingUntil - now),
            round: confirmation.round ?? 'not_visible',
            stopButton: confirmation.signal === 'stop_button' ? 'Y' : 'N',
        });
        setBetRuntimeStage('autoplay_confirm_wait', {
            context,
            remainingGraceMs: Math.max(0, autoplayStartPendingUntil - now),
        }, 'warn');
        return confirmation;
    }

    function markAutoplayOnlyRecovery(reason, data = {}) {
        clearAutoplayStartConfirmation('autoplay_only_recovery');
        autoBetArmed = true;
        lastRoundCountSeenAt = Date.now();
        lastFailReason = reason;
        setBetRuntimeStage('autoplay_rearm_wait', { reason, ...data }, 'warn');
        pushBetLog('warn', 'autoplay_only_recovery_scheduled', { reason, ...data });
        return true;
    }

    function markBetStateNeedsRecovery(reason) {
        clearAutoplayStartConfirmation('bet_state_recovery');
        autoBetArmed = false;
        betSettingsDirty = true;
        lastBetSetupAt = 0;
        lastFailReason = reason;
        setBetRuntimeStage('recovery_wait', { reason }, 'warn');
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
        clearAutoplayStartConfirmation(reason || 'state_reset');
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
        clearVerifiedBetProgress(reason || 'state_reset');
        clearRememberedSeatNumbers();
        betSettingsDirty = true;
        lastFailReason = null;
        setBetRuntimeStage(SCRIPT_ENABLED ? 'idle' : 'stopped', { reason });
        console.log('[AutoTrigger] state reset:', reason);
    }
