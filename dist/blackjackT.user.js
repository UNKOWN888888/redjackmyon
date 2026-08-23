// ==UserScript==
// @name         Autoplay Auto Trigger
// @namespace    http://tampermonkey.net/
// @version      1.93
// @description  BlackjackX 좌석·칩·자동베팅 자동화. 다중 칩 전환과 검증된 부분 베팅 재개를 지원하고, 좌석 집합·지갑 총액·클릭 단계를 세밀하게 기록합니다.
// @homepageURL  https://github.com/UNKOWN888888/redjackmyon
// @supportURL   https://github.com/UNKOWN888888/redjackmyon/issues
// @updateURL    https://raw.githubusercontent.com/UNKOWN888888/redjackmyon/main/dist/blackjackT.user.js
// @downloadURL  https://raw.githubusercontent.com/UNKOWN888888/redjackmyon/main/dist/blackjackT.user.js
// @match        https://client.pragmaticplaylive.net/*
// @match        https://*.pragmaticplaylive.net/*
// @match        https://widget.xma8riyvac.com/*
// @match        https://api.honorlink.org/*
// @match        https://client.fcxlljmmbqtczjya.net/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function isBlackjackGameDocument(doc = document) {
        if (!doc?.querySelector) return false;
        const root = doc.querySelector('#root[data-game-version],#root[data-build-number]');
        if (root) {
            const build = `${root.getAttribute?.('data-build-number') || ''} ${root.getAttribute?.('data-version') || ''}`.trim();
            if (build) return /blackjackx/i.test(build);
        }
        return !!doc.querySelector('[data-testid="game-grid-wrapper"],[data-testid^="seat_"]');
    }

    if (!isBlackjackGameDocument(document)) return;

    const SCRIPT_VERSION = '1.93';
    const SCRIPT_FRAME_MODE = window.top === window.self ? 'top' : 'iframe';
    const SCRIPT_GAME_VERSION = document.querySelector('#root')?.getAttribute?.('data-game-version') || 'unknown';
    const SCRIPT_ACTIVE_ATTRIBUTE = 'data-autotrigger-script-active';
    if (document.documentElement?.hasAttribute?.(SCRIPT_ACTIVE_ATTRIBUTE)) return;
    document.documentElement?.setAttribute?.(SCRIPT_ACTIVE_ATTRIBUTE, 'true');
    const SCRIPT_SESSION_STARTED_AT = Date.now();
    const SCRIPT_SESSION_ID = `${SCRIPT_SESSION_STARTED_AT.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    function getScriptLoadState() {
        const info = globalThis.__BLACKJACKT_LOADER_INFO__;
        if (!info || info.mode !== 'github') {
            return {
                mode: 'direct',
                source: 'direct',
                version: null,
                updateReadyVersion: null,
            };
        }
        return {
            mode: 'github',
            source: info.source === 'cache' ? 'cache' : 'remote',
            version: typeof info.version === 'string' ? info.version : null,
            updateReadyVersion: typeof info.updateReadyVersion === 'string'
                ? info.updateReadyVersion
                : null,
        };
    }

    function getScriptLoadLabel() {
        const state = getScriptLoadState();
        if (state.mode !== 'github') return '직접 파일';
        const source = state.source === 'cache' ? 'GitHub 캐시' : 'GitHub 원격';
        const version = state.version ? ` v${state.version}` : '';
        const update = state.updateReadyVersion ? ` / 업데이트 v${state.updateReadyVersion} 대기` : '';
        return `${source}${version}${update}`;
    }

    // ========== 설정 ==========
    // [1.15] TARGET_BET_AMOUNT 의미: "전체 좌석 합산" 베팅금액
    //        CHIP_VALUE 입력 제거 - 테이블에서 자동 감지
    // [1.41] AUTO_SEAT_COUNT=true 일 때 SEAT_COUNT는 "최대 좌석 수"로 사용.
    let THRESHOLD = toInt(GM_getValue('threshold', 100), 100, 0, 9999);
    let TARGET_BET_AMOUNT = toInt(GM_getValue('targetBetAmount', 3000), 3000, 0, 999999999);
    const SAVED_AUTO_SEAT_COUNT = GM_getValue('autoSeatCount', null);
    let AUTO_SEAT_COUNT = SAVED_AUTO_SEAT_COUNT === null ? true : SAVED_AUTO_SEAT_COUNT !== false;
    let SEAT_COUNT = toInt(GM_getValue('seatCount', AUTO_SEAT_COUNT ? 7 : 1), AUTO_SEAT_COUNT ? 7 : 1, 1, 7);
    if (SAVED_AUTO_SEAT_COUNT === null && AUTO_SEAT_COUNT && SEAT_COUNT === 1) SEAT_COUNT = 7;
    let SCRIPT_ENABLED = GM_getValue('scriptEnabled', true) !== false;
    const SAFETY_READ_ONLY_MODE = false;
    const AUTOPLAY_START_ROUNDS = 100;
    const AUTOPLAY_MODIFY_STEP = 10;
    const CHECK_INTERVAL_MS = 80;
    const FAST_SEAT_CHECK_INTERVAL_MS = 30;
    const BET_CLOSE_ICON_SELECTOR = '[data-testid="bet-spot-close-icon-button"]';
    const SEAT_LEAVE_ICON_SELECTOR = '[data-testid="close-icon"]';
    const SEAT_CLOSE_ICON_SELECTOR = `${BET_CLOSE_ICON_SELECTOR},${SEAT_LEAVE_ICON_SELECTOR}`;
    const CLICK_DELAY_MS = 8;
    const SEAT_CLICK_DELAY_MS = 8;
    const BROADCAST_CLICK_PROGRESS_WAIT_MS = 650;
    const BET_CLICK_VERIFY_MS = 240;
    const BET_CLICK_RETRY_LIMIT = 3;
    const BET_UNCHANGED_RECHECK_MS = 45;
    const BET_NO_EFFECT_RECHECK_MS = 180;
    const BET_NO_EFFECT_RETRY_LIMIT = 2;
    const BET_CLICK_UNCERTAIN_GUARD_MS = 2200;
    const WALLET_RESET_VERIFY_MS = 900;
    const EXTRA_SEAT_CLOSE_WAIT_MS = 90;
    const COOLDOWN_MS = 550;
    const BET_SETUP_COOLDOWN_MS = 450;
    const STOP_AUTOPLAY_WAIT_MS = 700;
    const DEAL_COOLDOWN_MS = 450;
    const INSURANCE_COOLDOWN_MS = 200;
    const INSURANCE_WATCH_INTERVAL_MS = 40;
    const INSURANCE_CLICK_VERIFY_MS = 90;
    const INSURANCE_CLICK_MAX_ATTEMPTS = 2;
    const AUTOBET_COUNT_VERIFY_MS = 650;
    const AUTOBET_COUNT_MISSING_GRACE_MS = 420;
    const AUTOBET_RECOVERY_COOLDOWN_MS = 800;
    const AUTOPLAY_BUTTON_READY_WAIT_MS = 800;
    const AUTOPLAY_MENU_WAIT_MS = 800;
    const AUTOPLAY_MODIFY_MENU_WAIT_MS = 500;
    const PENDING_SEAT_TTL_MS = 1600;
    const TARGET_SEAT_MEMORY_GUARD_MS = 300000;
    // [1.38] 자동 베팅 단독 재활성화 / 비활성 중단 팝업 자동 해제
    const AUTOPLAY_REARM_COOLDOWN_MS = 650;
    const AUTOPLAY_THRESHOLD_RESTART_COOLDOWN_MS = 900;
    const BLOCKING_POPUP_CLICK_COOLDOWN_MS = 450;
    const SUPPORT_POPUP_RECOVERY_TTL_MS = 180000;
    const SUPPORT_POPUP_RECOVERY_RETRY_MS = 1000;
    // [1.39] DOM 마이크로 캐시 TTL — 좌석 금액 인식 가속화
    const DOM_MICRO_CACHE_MS = 20;
    const DYNAMIC_DOM_CACHE_MS = 35;
    const CHIP_DETECT_CACHE_MS = 45;
    const SEAT_BET_STATE_CACHE_MS = 18;
    const TRUSTED_SEAT_MEMORY_CACHE_MS = 45;
    const SIT_PROMPT_CACHE_MS = 30;
    // [1.39] verify polling 가속
    const VERIFY_POLL_MS = 12;
    const BET_DEBUG_LOG_LIMIT = 500;
    const BET_DEBUG_LOG_STORAGE_KEY = 'betDebugLogRecentV1';
    const BET_DEBUG_LOG_RETENTION_MS = 24 * 60 * 60 * 1000;
    const BET_DEBUG_LOG_PERSIST_DELAY_MS = 120;
    const SINGLE_CHIP_DOM_PART_LIMIT = 8;
    const SELECTED_STACK_CHIP_TTL_MS = 2500;
    const CHIP_SELECTION_VERIFY_MS = 160;
    const CHIP_SELECTION_SETTLE_MS = 120;
    const VERIFIED_BET_PROGRESS_TTL_MS = 120000;
    const BET_MISMATCH_LOG_REPEAT_MS = 2000;
    const BET_BLOCKING_MODAL_CLOSE_WAIT_MS = 180;
    const AUTOPLAY_MODAL_IDLE_CLOSE_MS = 3000;
    const SETTINGS_INPUT_SETTLE_MS = 300;

    let isRunning = false;
    let isBetSetupRunning = false;
    let lastTriggerAt = 0;
    let lastDealClickAt = 0;
    let dealClickCount = 0;
    let lastInsuranceClickAt = 0;
    let insuranceClickCount = 0;
    let insuranceClickInFlight = false;
    let lastBetSetupAt = 0;
    let betSetupCount = 0;
    let autoplayStartCount = 0;
    let autoplayStopCount = 0;
    // [1.38] 단독 재활성화 횟수 / 비활성 중단 팝업 해제 횟수
    let autoplayRearmCount = 0;
    let autoplayThresholdRestartCount = 0;
    let blockingPopupDismissCount = 0;
    let supportPopupConfirmCount = 0;
    let lastAutoplayRearmAt = 0;
    let lastAutoplayThresholdRestartAt = 0;
    let lastBlockingPopupClickAt = 0;
    let lastSupportPopupRecoveryAttemptAt = 0;
    let betSettingsDirty = false;
    let lastSeatPlan = emptyPlan();
    let lastTargetSeatNumbers = loadRememberedSeatNumbers();
    let lastTargetSeatRememberedAt = 0;
    let lastTargetSeatMemoryReason = '';
    let _trustedRememberedSeatNumbersCache = null;
    let _trustedRememberedSeatNumbersCacheAt = 0;
    let _trustedRememberedSeatNumbersCacheKey = '';
    const pendingSitSeats = new Map();
    let seatLimitOverride = null;
    let forcedAutoSeatCount = null;
    let autoBetArmed = false;
    let lastRoundCountSeenAt = 0;
    let lastRecoveryAt = 0;
    let lastAppliedBetSettingsKey = String(GM_getValue('lastAppliedBetSettingsKey', '') || '');
    let supportPopupRecoveryPendingAt = toInt(GM_getValue('supportPopupRecoveryPendingAt', 0), 0, 0, 9999999999999);
    if (supportPopupRecoveryPendingAt > 0 && Date.now() - supportPopupRecoveryPendingAt <= SUPPORT_POPUP_RECOVERY_TTL_MS) {
        betSettingsDirty = true;
        autoBetArmed = false;
        lastBetSetupAt = 0;
        lastAppliedBetSettingsKey = '';
        GM_setValue('lastAppliedBetSettingsKey', '');
    }
    // [1.16] "자리에 앉으십시오" 메시지 트리거
    let lastSitPromptSeenAt = 0;
    let lastSitPromptHandledAt = 0;
    let lastBetClickDebug = '';
    let lastBetClickDebugAt = 0;
    let lastSelectedStackChipValue = 0;
    let lastSelectedStackChipAt = 0;
    let betClickGuardUntil = 0;
    let lastBetClickGuardReason = '';
    function loadRecentBetDebugLog() {
        try {
            const stored = GM_getValue(BET_DEBUG_LOG_STORAGE_KEY, []);
            if (!Array.isArray(stored)) return [];
            const cutoff = Date.now() - BET_DEBUG_LOG_RETENTION_MS;
            return stored
                .filter(item => item && Number.isFinite(item.at) && item.at >= cutoff && typeof item.message === 'string')
                .sort((a, b) => b.at - a.at)
                .slice(0, BET_DEBUG_LOG_LIMIT)
                .map(item => ({
                    sequence: Number.isFinite(item.sequence) ? item.sequence : 0,
                    sessionId: typeof item.sessionId === 'string' ? item.sessionId : 'legacy',
                    scriptVersion: typeof item.scriptVersion === 'string' ? item.scriptVersion : 'unknown',
                    at: item.at,
                    level: typeof item.level === 'string' ? item.level : 'info',
                    stage: typeof item.stage === 'string' ? item.stage : 'idle',
                    message: item.message,
                    data: item.data ?? null,
                }));
        } catch (error) {
            console.warn('[AutoTrigger] recent bet log restore failed:', error);
            return [];
        }
    }

    let betDebugLog = loadRecentBetDebugLog();
    let betLogSequence = betDebugLog.reduce((max, item) => Math.max(max, item.sequence || 0), 0);
    let betDebugLogPersistTimer = null;
    let betRuntimeStage = 'idle';
    let betRuntimeStageAt = Date.now();
    let betRuntimeStageData = {};
    let verifiedBetProgress = null;
    let lastBetMismatchFingerprint = '';
    let lastBetMismatchLoggedAt = 0;
    let autoplayModalVisibleSince = 0;
    let lastAutoplayModalActionAt = 0;
    let lastAutoplayModalIdleCloseAt = 0;
    let sitPromptTriggerCount = 0;
    const SIT_PROMPT_COOLDOWN_MS = 180;
    const SIT_PROMPT_FORCE_SEAT_MS = 1200;
    let lastSeatExpansionHandledAt = 0;
    const SEAT_EXPANSION_COOLDOWN_MS = 350;
    let forceSitPromptSeatUntil = 0;
    let settingsInputPendingUntil = 0;

    // 마지막으로 감지된 가장 작은 칩값 (좌석 금액 텍스트 필터링용 캐시)
    let cachedMinChipValue = 1;

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

    function markBetStateNeedsRecovery(reason) {
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
            if (options.nativeClick && typeof element.click === 'function') {
                element.click();
                return true;
            }
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

            element.dispatchEvent(new ME('click', { ...base, buttons: 0 }));
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
        const boundary = getBetClickBoundary(element);
        const pointTarget = isSafeBetDispatchTarget(element, boundary)
            ? element
            : (normalizeBetClickTarget(element, boundary) || element);
        const point = getSafeBetClickPoint(pointTarget);
        const topEl = pointTarget.ownerDocument?.elementFromPoint?.(point.x, point.y);
        const dispatchTarget = getBetDispatchTarget(element, boundary, topEl);
        const hitScope = !topEl ? 'none' : (!boundary ? 'unbounded' : (boundary.contains?.(topEl) ? 'inside' : 'outside'));
        return `${Math.round(point.x)},${Math.round(point.y)}:hit=${getElementLabel(topEl)}(${hitScope}),candidate=${getElementLabel(element)},boundary=${getElementLabel(boundary)},dispatch=${getElementLabel(dispatchTarget)}`;
    }

    function getBetClickProfile(attempt = 0) {
        return ['mouse', 'mouse', 'touch', 'native'][Math.max(0, attempt) % 4];
    }

    function normalizeBetClickTarget(element, boundary) {
        if (!element) return null;
        if (element.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return null;
        const candidate = element.closest?.('[data-testid^="seat_"],[data-testid^="mainbet_"],[data-testid^="mainbetSeat_"],[data-testid="chip"],[role="button"]') || element;
        if (candidate.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return null;
        if (boundary && !boundary.contains?.(candidate)) return null;
        return candidate;
    }

    function getBetClickBoundary(element) {
        if (!element) return null;
        return element.closest?.('[data-testid^="mainbet_"]') ||
            element.closest?.('[data-testid^="mainbetSeat_"]') ||
            element.closest?.('[data-testid^="seat_"]') ||
            element;
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

    function isSafeBetDispatchTarget(el, boundary = null) {
        if (!el || !isVisible(el)) return false;
        if (boundary && !boundary.contains?.(el)) return false;
        if (el.closest?.(SEAT_CLOSE_ICON_SELECTOR)) return false;
        if (el.closest?.('#at-panel')) return false;
        if (el.closest?.('[data-testid="bottom-sheet-modal"],[data-testid="modal-header"],[data-testid="modal-body"]')) return false;
        if (el.closest?.('[data-testid="bj-decision-panel"],[data-testid="popup-content"],[data-testid="blocking-popup-content"]')) return false;
        if (el.closest?.('button[data-testid^="chip-stack-value-"]')) return false;
        if (el.closest?.('[data-testid="autoplay-button"],[data-testid="autoplay-control-button"]')) return false;
        return true;
    }

    function getBetDispatchTarget(element, boundary, topEl) {
        const preferredTarget = normalizeBetClickTarget(element, boundary);
        const candidates = [
            topEl,
            element,
            normalizeBetClickTarget(topEl, boundary),
            preferredTarget,
        ];
        return candidates.find(candidate => isSafeBetDispatchTarget(candidate, boundary)) || null;
    }

    function robustBetClick(element, options = {}) {
        if (!element || !isVisible(element)) return false;
        const doc = element.ownerDocument || document;
        const boundary = getBetClickBoundary(element);
        const pointTarget = isSafeBetDispatchTarget(element, boundary)
            ? element
            : (normalizeBetClickTarget(element, boundary) || element);
        const points = getSafeBetClickPoints(pointTarget);
        const attempt = Math.max(0, Math.floor(options.attempt || 0));
        const profile = options.profile || getBetClickProfile(attempt);
        const orderedPoints = points.length > 0
            ? points.slice(attempt % points.length).concat(points.slice(0, attempt % points.length))
            : points;

        for (const { x, y } of orderedPoints) {
            const topEl = doc.elementFromPoint?.(x, y);
            const target = getBetDispatchTarget(element, boundary, topEl);
            if (!target) continue;

            if (lastBetClickDebug && Date.now() - lastBetClickDebugAt < 1000 && !/\sp\d+\/t\d+/.test(lastBetClickDebug)) {
                lastBetClickDebug += ` p1/${points.length} hit=${getElementLabel(topEl)} t=${getElementLabel(target)} ${profile}`;
                lastBetClickDebugAt = Date.now();
            }

            const success = fireFullClick(target, x, y, {
                profile: profile === 'native' ? 'mouse' : profile,
                touch: profile === 'touch',
                nativeClick: profile === 'native',
            });
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

    // ========== 라운드/오토 버튼 ==========
    function parseAutoplayRoundCounter(el) {
        if (!el || !isVisible(el)) return null;
        const text = String(el.textContent || '').trim();
        if (!/^\d+$/.test(text)) return null;
        const value = parseInt(text, 10);
        return Number.isFinite(value) && value >= 0 ? value : null;
    }

    function getRoundNumber() {
        const now = Date.now();
        if (_roundNumberCacheAt > 0 && now - _roundNumberCacheAt < DOM_MICRO_CACHE_MS) {
            return _roundNumberCache;
        }

        const counterSelectors = [
            '[data-testid="autoplay-stop-button"] [data-testid="number-slider-list-item"]',
            'button[data-testid="autoplay-button"] [data-testid="number-slider-list-item"]',
        ];
        for (const selector of counterSelectors) {
            for (const counter of qsaDeep(selector)) {
                const value = parseAutoplayRoundCounter(counter);
                if (value === null) continue;
                _roundNumberCache = value;
                _roundNumberCacheAt = now;
                return value;
            }
        }

        const btn = getAutoplayButton();
        const nestedCounter = btn?.querySelector?.('[data-testid="number-slider-list-item"]');
        const nestedValue = parseAutoplayRoundCounter(nestedCounter);
        if (nestedValue !== null) {
            _roundNumberCache = nestedValue;
            _roundNumberCacheAt = now;
            return nestedValue;
        }
        _roundNumberCache = parseAutoplayRoundCounter(btn);
        _roundNumberCacheAt = now;
        return _roundNumberCache;
    }

    // [1.16] "자리에 앉으십시오" 상태 메시지 감지.
    //        이 메시지가 떠 있으면 = 테이블 준비 + 즉시 착석 가능 신호.
    //        라운드 카운트나 dirty 플래그와 무관하게 시퀀스 트리거.
    const SIT_PROMPT_TEXT = '자리에 앉으십시오';
    function isSitPromptVisible() {
        const now = Date.now();
        if (_sitPromptVisibleCache !== null && now - _sitPromptVisibleCacheAt < SIT_PROMPT_CACHE_MS) {
            return _sitPromptVisibleCache;
        }
        let visible = false;
        for (const el of qsaDeep('[data-testid="status-message"]')) {
            if (!isVisible(el)) continue;
            const text = (el.textContent || '').trim();
            if (text.includes(SIT_PROMPT_TEXT)) {
                visible = true;
                break;
            }
        }
        _sitPromptVisibleCache = visible;
        _sitPromptVisibleCacheAt = now;
        return visible;
    }

    function isDisabledLike(el) {
        if (!el) return true;
        const target = el.closest?.('button') || el;
        return !!(target.disabled || target.hasAttribute?.('disabled') || target.getAttribute?.('aria-disabled') === 'true' || target.getAttribute?.('data-disabled') === 'true');
    }

    function getAutoplayButton() {
        const now = Date.now();
        if (_autoplayButtonCacheAt > 0 && now - _autoplayButtonCacheAt < DOM_MICRO_CACHE_MS) {
            return _autoplayButtonCache;
        }
        _autoplayButtonCache = qsDeep('button[data-testid="autoplay-button"]');
        _autoplayButtonCacheAt = now;
        return _autoplayButtonCache;
    }

    function getAutoplayStopButton() {
        for (const marker of qsaDeep('[data-testid="autoplay-stop-button"]')) {
            const btn = marker.closest?.('button[data-testid="autoplay-control-button"]') || marker.closest?.('button') || marker;
            if (btn && isVisible(btn) && !isDisabledLike(btn)) return btn;
        }
        return null;
    }

    function getAutoplayModifyButton() {
        const addonSelector = `[data-testid="autoplay-modify-addon-${AUTOPLAY_MODIFY_STEP}"]`;
        for (const addon of qsaDeep(addonSelector)) {
            const marker = addon.closest?.('[data-testid="autoplay-modify-button"]') || addon.parentElement;
            const control = addon.closest?.('button[data-testid="autoplay-control-button"]') || addon.closest?.('button');
            if (control && marker && isVisible(addon) && isVisible(marker) && isVisible(control) && !isDisabledLike(control)) return control;
        }
        for (const control of qsaDeep('button[data-testid="autoplay-control-button"]')) {
            const addon = control.querySelector?.(addonSelector);
            const marker = addon?.closest?.('[data-testid="autoplay-modify-button"]') || addon?.parentElement;
            if (addon && marker && isVisible(addon) && isVisible(marker) && isVisible(control) && !isDisabledLike(control)) return control;
        }
        return null;
    }

    async function getOrOpenAutoplayModifyButton() {
        let modifyBtn = getAutoplayModifyButton();
        if (modifyBtn) return modifyBtn;

        const autoplayBtn = getAutoplayButton();
        if (!autoplayBtn || !isVisible(autoplayBtn) || isDisabledLike(autoplayBtn)) return null;
        pushBetLog('info', 'threshold_modify_menu_open', {
            target: getElementLabel(autoplayBtn),
            step: `+${AUTOPLAY_MODIFY_STEP}`,
        });
        markAutoplayModalAction();
        if (!robustClick(autoplayBtn)) return null;
        await waitForCondition(() => !!getAutoplayModifyButton(), AUTOPLAY_MODIFY_MENU_WAIT_MS, 20);
        modifyBtn = getAutoplayModifyButton();
        return modifyBtn;
    }

    async function topUpAutoplayRoundsByModify(currentRoundNumber) {
        const missingRounds = Math.max(1, AUTOPLAY_START_ROUNDS - toInt(currentRoundNumber, AUTOPLAY_START_ROUNDS - 10, 0, AUTOPLAY_START_ROUNDS));
        const clickCount = Math.max(1, Math.min(10, Math.ceil(missingRounds / AUTOPLAY_MODIFY_STEP)));
        let clicked = 0;
        let latestRound = Number.isFinite(currentRoundNumber) ? currentRoundNumber : observeAutoplayRoundNumber();
        for (let i = 0; i < clickCount; i++) {
            if (isScriptStopped()) return Number.isFinite(latestRound) && latestRound >= AUTOPLAY_START_ROUNDS;
            const modifyBtn = await getOrOpenAutoplayModifyButton();
            if (!modifyBtn) {
                lastFailReason = 'threshold_modify_btn_missing';
                console.warn('[AutoTrigger] 기준미만 보충: autoplay modify 버튼 없음');
                return Number.isFinite(latestRound) && latestRound >= AUTOPLAY_START_ROUNDS;
            }
            pushBetLog('info', 'threshold_modify_click', {
                current: currentRoundNumber,
                missing: missingRounds,
                step: `${i + 1}/${clickCount}`,
                target: getElementLabel(modifyBtn),
            });
            if (!robustClick(modifyBtn)) {
                lastFailReason = 'threshold_modify_dispatch_failed';
                pushBetLog('error', 'threshold_modify_dispatch_failed', {
                    step: `${i + 1}/${clickCount}`,
                    target: getElementLabel(modifyBtn),
                });
                return false;
            }
            markAutoplayModalAction();
            clicked++;
            await sleep(35);
            latestRound = observeAutoplayRoundNumber();
            pushBetLog('info', 'threshold_modify_after_click', {
                before: currentRoundNumber,
                after: Number.isFinite(latestRound) ? latestRound : 'unknown',
                step: `${i + 1}/${clickCount}`,
            });
            if (Number.isFinite(latestRound) && latestRound >= AUTOPLAY_START_ROUNDS) break;
        }
        if (Number.isFinite(latestRound) && latestRound >= AUTOPLAY_START_ROUNDS) return clicked > 0;
        lastFailReason = 'threshold_modify_count_below_target';
        pushBetLog('error', 'threshold_modify_count_below_target', {
            after: Number.isFinite(latestRound) ? latestRound : 'unknown',
            target: AUTOPLAY_START_ROUNDS,
            clicked,
        });
        return false;
    }

    function isAutoplayRunning() { return getRoundNumber() !== null || !!getAutoplayStopButton(); }

    async function waitForCondition(fn, timeoutMs, intervalMs = 50) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            if (fn()) return true;
            await sleep(intervalMs);
        }
        return fn();
    }

    async function stopAutoplayIfRunning() {
        if (isAutomationLocked()) {
            console.warn('[AutoTrigger] read-only safety mode: autoplay stop click blocked');
            return false;
        }
        if (!isAutoplayRunning()) return true;

        let stopBtn = getAutoplayStopButton();
        if (!stopBtn) {
            const autoplayBtn = getAutoplayButton();
            if (autoplayBtn && isVisible(autoplayBtn) && !isDisabledLike(autoplayBtn)) {
                console.log('[AutoTrigger] 자동베팅 stop 버튼 직접 감지 실패 → autoplay 버튼/메뉴에서 중지 탐색');
                robustClick(autoplayBtn);
                await sleep(60);
                if (!isAutoplayRunning()) {
                    autoplayStopCount++;
                    await sleep(50);
                    return true;
                }
                await waitForCondition(() => {
                    stopBtn = getAutoplayStopButton();
                    return !!stopBtn;
                }, 450, 30);
            }
            if (!stopBtn) {
                closeAutoplayDialogIfOpen();
                lastFailReason = 'autoplay_stop_missing';
                console.warn('[AutoTrigger] 자동베팅 진행 중이지만 stop 버튼을 찾지 못함; 실행 중 베팅/기준미만 재설정 중단');
                return false;
            }
        }

        console.log('[AutoTrigger] 자동 베팅 실행 중 → 중지');
        robustClick(stopBtn);
        autoplayStopCount++;
        const stopped = await waitForCondition(() => !isAutoplayRunning(), STOP_AUTOPLAY_WAIT_MS);
        if (!stopped) { console.warn('[AutoTrigger] 자동 베팅 중지 확인 실패'); return false; }
        await sleep(50);
        return stopped;
    }

    function isAutoplayButtonReady() {
        const btn = getAutoplayButton();
        return !!(btn && isVisible(btn) && !isDisabledLike(btn));
    }

    function getWalletTotalBetReading() {
        const selectors = [
            '[data-testid="wallet-total-bet-value"]',
            '[data-testid="wallet-mobile-total-bet"] [data-testid="wallet-mobile-value"]',
        ];
        const candidates = [];
        const seen = new Set();
        for (const selector of selectors) {
            for (const el of qsaDeep(selector)) {
                if (!el || seen.has(el) || !isVisible(el)) continue;
                seen.add(el);
                const textEl = el.querySelector?.('span[dir="ltr"]') || el;
                const text = String(textEl.textContent || el.textContent || '').trim();
                const amount = parseMoneySum(text);
                if (!Number.isFinite(amount) || amount < 0) continue;
                candidates.push({
                    amount,
                    text,
                    target: getElementLabel(el),
                });
            }
        }
        const values = Array.from(new Set(candidates.map(item => item.amount)));
        return {
            detected: candidates.length > 0,
            ambiguous: values.length > 1,
            amount: values.length === 1 ? values[0] : null,
            values,
            candidates,
        };
    }

    function getExpectedWalletTotalBetAmount(expectedPlan = getExpectedBetPlan()) {
        if (Number.isFinite(expectedPlan?.totalActual) && expectedPlan.totalActual > 0) {
            return expectedPlan.totalActual;
        }
        return TARGET_BET_AMOUNT;
    }

    function getVisibleDecisionPanelInfo() {
        const panels = [];
        const actions = [];
        for (const panel of qsaDeep('[data-testid="bj-decision-panel"]')) {
            if (!panel || !isVisible(panel)) continue;
            const panelActions = Array.from(panel.querySelectorAll?.('[data-id]') || [])
                .filter(el => el && isVisible(el) && !isDisabledLike(el))
                .map(el => String(el.getAttribute?.('data-id') || el.textContent || '').trim())
                .filter(Boolean);
            const text = String(panel.textContent || '').replace(/\s+/g, ' ').trim();
            if (panelActions.length <= 0 && !text) continue;
            panels.push({
                target: getElementLabel(panel),
                actions: panelActions,
                text: text.slice(0, 80),
            });
            for (const action of panelActions) {
                if (!actions.includes(action)) actions.push(action);
            }
        }
        return {
            active: panels.length > 0,
            actions,
            panels,
        };
    }

    function getWalletTotalBetVariance(expectedPlan = getExpectedBetPlan()) {
        const expected = getExpectedWalletTotalBetAmount(expectedPlan);
        const reading = getWalletTotalBetReading();
        if (!Number.isFinite(expected) || expected <= 0) {
            return { status: 'not_applicable', expected, reading, delta: 0 };
        }
        if (!reading.detected) {
            return { status: 'missing', expected, reading, delta: null };
        }
        if (reading.ambiguous) {
            return { status: 'ambiguous', expected, reading, delta: null };
        }
        const delta = reading.amount - expected;
        if (delta === 0) return { status: 'exact', expected, reading, delta: 0 };
        return {
            status: delta > 0 ? 'increased' : 'under',
            expected,
            reading,
            delta,
        };
    }

    function verifyWalletTotalBeforeAutoplayStart(expectedPlan = getExpectedBetPlan(), context = 'autoplay_start') {
        const variance = getWalletTotalBetVariance(expectedPlan);
        const { expected, reading } = variance;
        if (variance.status === 'not_applicable') return true;

        const valuesText = reading.values.map(formatMoney).join(',');
        if (variance.status === 'missing') {
            const shouldBlock = isBettingWindowOpen();
            pushBetLog(shouldBlock ? 'error' : 'warn', 'wallet_total_missing_before_autoplay', {
                context,
                expected: formatMoney(expected),
                bettingWindow: isBettingWindowOpen() ? 'Y' : 'N',
            });
            if (shouldBlock) {
                lastFailReason = 'wallet_total_missing_before_autoplay';
                return false;
            }
            return true;
        }
        if (variance.status === 'ambiguous') {
            pushBetLog('error', 'wallet_total_ambiguous_before_autoplay', {
                context,
                expected: formatMoney(expected),
                values: valuesText,
            });
            lastFailReason = 'wallet_total_ambiguous_before_autoplay';
            return false;
        }
        if (variance.status === 'increased') {
            pushBetLog('error', 'wallet_total_increased_mid_round', {
                context,
                expected: formatMoney(expected),
                actual: formatMoney(reading.amount),
                delta: formatMoney(variance.delta),
                target: formatMoney(TARGET_BET_AMOUNT),
                planTotal: formatMoney(expectedPlan?.totalActual || 0),
            });
            console.warn(`[AutoTrigger] wallet total increased ${formatMoney(reading.amount)} > expected ${formatMoney(expected)}; autoplay start blocked (double/split/extra bet suspected)`);
            autoBetArmed = false;
            lastFailReason = 'wallet_total_increased_mid_round';
            return false;
        }
        if (variance.status !== 'exact') {
            pushBetLog('error', 'wallet_total_mismatch_before_autoplay', {
                context,
                expected: formatMoney(expected),
                actual: formatMoney(reading.amount),
                target: formatMoney(TARGET_BET_AMOUNT),
                planTotal: formatMoney(expectedPlan?.totalActual || 0),
            });
            console.warn(`[AutoTrigger] wallet total ${formatMoney(reading.amount)} != expected ${formatMoney(expected)}; autoplay start blocked`);
            autoBetArmed = false;
            lastFailReason = 'wallet_total_mismatch_before_autoplay';
            return false;
        }
        pushBetLog('info', 'wallet_total_verified_before_autoplay', {
            context,
            total: formatMoney(reading.amount),
        });
        return true;
    }

    function verifyAutoplayStartSafety(expectedPlan = getExpectedBetPlan(), context = 'autoplay_start') {
        if (isBetSetupRunning) {
            lastFailReason = 'bet_setup_running_before_autoplay';
            pushBetLog('warn', 'autoplay_start_blocked_bet_setup_running', { context });
            return false;
        }
        if (typeof isBetClickGuardActive === 'function' && isBetClickGuardActive()) {
            lastFailReason = lastBetClickGuardReason || 'bet_click_verification_guard';
            pushBetLog('warn', 'autoplay_start_blocked_bet_guard', {
                context,
                reason: lastFailReason,
            });
            return false;
        }
        const decision = getVisibleDecisionPanelInfo();
        if (decision.active) {
            lastFailReason = 'decision_panel_active_before_autoplay';
            pushBetLog('error', 'autoplay_start_blocked_decision_panel', {
                context,
                actions: decision.actions.join(',') || 'unknown',
                panels: decision.panels.map(panel => `${panel.target}:${panel.actions.join('/') || panel.text}`).join('|'),
            });
            console.warn(`[AutoTrigger] decision panel active (${decision.actions.join(',') || 'unknown'}); autoplay start blocked to prevent mid-hand misclick`);
            return false;
        }
        return verifyWalletTotalBeforeAutoplayStart(expectedPlan, context);
    }

    function getVisibleBottomSheetModals() {
        return qsaDeep('[data-testid="bottom-sheet-modal"]').filter(isVisible);
    }

    function getAutoplayDialogMarkerSelector() {
        return [
            '[data-testid="autoplay-container"]',
            '[data-testid="autoplay-controls"]',
            '[data-testid="autoplay-controls-hidden"]',
            '[data-testid="autoplay-stop-button"]',
            '[data-testid="autoplay-modify-button"]',
            '[data-testid^="autoplay-start-button-"]',
            '[data-testid="autoplay-bet-info"]',
        ].join(',');
    }

    function isAutoplayBottomSheetModal(modal) {
        if (!modal || !isVisible(modal)) return false;
        if (modal.querySelector?.(getAutoplayDialogMarkerSelector())) return true;
        const title = modal.querySelector?.('[data-testid="modal-header-title"]');
        return /자동\s*베팅/i.test(title?.textContent || modal.textContent || '');
    }

    function getModalCloseButton(modal) {
        if (!modal) return null;
        for (let root = modal; root && root !== root.ownerDocument?.body; root = root.parentElement) {
            const direct = root.querySelector?.('button[data-testid="modal-close-button"],button[aria-label="닫기"],button[title="닫기"],button[title="Close"]');
            if (direct && isVisible(direct) && !isDisabledLike(direct)) return direct;
            const closeIcon = root.querySelector?.('svg[data-testid="icon-Close"]');
            const iconBtn = closeIcon?.closest?.('button');
            if (iconBtn && isVisible(iconBtn) && !isDisabledLike(iconBtn)) return iconBtn;
            if (root.matches?.('[data-testid="bottom-sheet-modal"],[role="dialog"]')) break;
        }
        return null;
    }

    function getAutoplayDialogRootFromMarker(marker) {
        if (!marker || !isVisible(marker)) return null;
        const modal = marker.closest?.('[data-testid="bottom-sheet-modal"],[role="dialog"]');
        if (modal && isVisible(modal) && isAutoplayBottomSheetModal(modal)) return modal;

        let fallback = null;
        for (let cur = marker; cur && cur !== cur.ownerDocument?.body && cur !== cur.ownerDocument?.documentElement; cur = cur.parentElement) {
            if (!isVisible(cur)) continue;
            const tid = cur.getAttribute?.('data-testid') || '';
            if (tid === 'autoplay-container' && !fallback) fallback = cur;
            const hasAutoplay = cur.querySelector?.(getAutoplayDialogMarkerSelector());
            const hasClose = !!getModalCloseButton(cur);
            const title = cur.querySelector?.('[data-testid="modal-header-title"]');
            if (hasAutoplay && (hasClose || /자동\s*베팅/i.test(title?.textContent || ''))) return cur;
        }
        return fallback;
    }

    function getOpenAutoplayBottomSheetModal() {
        const bottomSheet = getVisibleBottomSheetModals().find(isAutoplayBottomSheetModal);
        if (bottomSheet) return bottomSheet;
        for (const marker of qsaDeep(getAutoplayDialogMarkerSelector())) {
            const root = getAutoplayDialogRootFromMarker(marker);
            if (root && isVisible(root)) return root;
        }
        return null;
    }

    function markAutoplayModalAction() {
        lastAutoplayModalActionAt = Date.now();
    }

    function closeIdleAutoplayBottomSheetIfStale() {
        if (isScriptStopped() || isAutomationLocked()) {
            autoplayModalVisibleSince = 0;
            return false;
        }
        const modal = getOpenAutoplayBottomSheetModal();
        if (!modal) {
            autoplayModalVisibleSince = 0;
            lastAutoplayModalActionAt = 0;
            return false;
        }

        const now = Date.now();
        if (!autoplayModalVisibleSince) autoplayModalVisibleSince = now;
        if (isRunning || isBetSetupRunning) {
            markAutoplayModalAction();
            return false;
        }

        const idleSince = Math.max(autoplayModalVisibleSince, lastAutoplayModalActionAt || 0);
        if (now - idleSince < AUTOPLAY_MODAL_IDLE_CLOSE_MS) return false;
        if (now - lastAutoplayModalIdleCloseAt < 1000) return false;
        lastAutoplayModalIdleCloseAt = now;

        const closeBtn = getModalCloseButton(modal);
        if (!closeBtn) {
            pushBetLog('warn', 'idle_autoplay_modal_close_button_missing', {
                openMs: now - autoplayModalVisibleSince,
                title: (modal.querySelector?.('[data-testid="modal-header-title"]')?.textContent || '').trim(),
            });
            return false;
        }

        pushBetLog('info', 'idle_autoplay_modal_close', {
            openMs: now - autoplayModalVisibleSince,
            idleMs: now - idleSince,
            target: getElementLabel(closeBtn),
            title: (modal.querySelector?.('[data-testid="modal-header-title"]')?.textContent || '').trim(),
        });
        robustClick(closeBtn);
        autoplayModalVisibleSince = 0;
        lastAutoplayModalActionAt = 0;
        invalidateDynamicCaches();
        return true;
    }

    async function closeBetBlockingBottomSheetIfOpen(reason = 'bet_click') {
        const modal = getOpenAutoplayBottomSheetModal();
        if (!modal) return false;
        const closeBtn = getModalCloseButton(modal);
        if (!closeBtn) {
            pushBetLog('warn', 'bottom_sheet_close_button_missing', {
                reason,
                title: (modal.querySelector?.('[data-testid="modal-header-title"]')?.textContent || '').trim(),
            });
            return false;
        }
        pushBetLog('info', 'bottom_sheet_close_before_bet', {
            reason,
            target: getElementLabel(closeBtn),
            title: (modal.querySelector?.('[data-testid="modal-header-title"]')?.textContent || '').trim(),
        });
        robustClick(closeBtn);
        await waitForCondition(() => !getOpenAutoplayBottomSheetModal(), BET_BLOCKING_MODAL_CLOSE_WAIT_MS, 20);
        invalidateDynamicCaches();
        return true;
    }

    function closeAutoplayDialogIfOpen() {
        const modal = getOpenAutoplayBottomSheetModal();
        if (!modal) return false;
        const closeBtn = getModalCloseButton(modal);
        if (closeBtn) {
            robustClick(closeBtn);
            return true;
        }
        return false;
    }

    // [1.39] isBettingWindowOpen 마이크로 캐시 — 좌석 수만큼 반복 호출되는
    //        가장 무거운 hot path 중 하나.
    let _betWinCache = null;
    let _betWinCacheAt = 0;
    function isBettingWindowOpen() {
        const now = Date.now();
        if (_betWinCache !== null && now - _betWinCacheAt < DOM_MICRO_CACHE_MS) return _betWinCache;
        const dealBtn = qsDeep('[data-testid="deal_now"]');
        const trayChips = getTrayChips();
        const stackButtons = qsaDeep('button[data-testid^="chip-stack-value-"]')
            .filter(el => el && isVisible(el) && !isDisabledLike(el));
        const detectedChips = typeof detectAvailableChips === 'function' ? detectAvailableChips() : [];
        const value = trayChips.length >= 1 ||
            stackButtons.length > 0 ||
            detectedChips.length > 0 ||
            !!(dealBtn && isVisible(dealBtn) && !isDisabledLike(dealBtn));
        _betWinCache = value;
        _betWinCacheAt = now;
        return value;
    }

    function getClickableByMarker(selector) {
        for (const marker of qsaDeep(selector)) {
            const btn = marker.closest?.('button') || marker;
            if (btn && isVisible(btn) && !isDisabledLike(btn)) return btn;
        }
        return null;
    }

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
            mainBetGhost,
            mainBetSvg,
            directSpot,
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

    // ========== 칩 선택 + 좌석 클릭 ==========
    function clearRememberedSelectedStackChip() {
        lastSelectedStackChipValue = 0;
        lastSelectedStackChipAt = 0;
    }

    function rememberSelectedStackChip(chipValue) {
        const value = Math.floor(chipValue || 0);
        if (!Number.isFinite(value) || value <= 0) {
            clearRememberedSelectedStackChip();
            return;
        }
        lastSelectedStackChipValue = value;
        lastSelectedStackChipAt = Date.now();
    }

    function getRememberedSelectedStackChipAmount() {
        if (!Number.isFinite(lastSelectedStackChipValue) || lastSelectedStackChipValue <= 0) return 0;
        if (Date.now() - lastSelectedStackChipAt > SELECTED_STACK_CHIP_TTL_MS) {
            clearRememberedSelectedStackChip();
            return 0;
        }
        return lastSelectedStackChipValue;
    }

    function getEffectiveSelectedChipAmount() {
        const visibleSelectedAmount = getSelectedChipAmount();
        if (Number.isFinite(visibleSelectedAmount) && visibleSelectedAmount > 0) return visibleSelectedAmount;
        return getRememberedSelectedStackChipAmount();
    }

    async function selectChipByValue(chipValue) {
        if (isScriptStopped()) return false;
        await closeBetBlockingBottomSheetIfOpen('select_chip');
        const chip = findChipByValue(chipValue);
        if (!chip) {
            pushBetLog('error', 'chip_not_found', {
                planned: formatMoney(chipValue),
                available: detectAvailableChips().map(c => formatMoney(c.value)).join(','),
            });
            console.warn(`[AutoTrigger] chip ${chipValue} not found`);
            return false;
        }
        const selectedBefore = getSelectedChipAmount();
        const stackBtn = chip.closest?.('button[data-testid^="chip-stack-value-"]') ||
            (chip.matches?.('button[data-testid^="chip-stack-value-"]') ? chip : null);
        const alreadySelected = selectedBefore === chipValue ||
            !!(stackBtn && isStackChipButtonSelected(stackBtn)) ||
            (!stackBtn && isTrayChipSelected(chip));
        if (alreadySelected) {
            if (stackBtn) rememberSelectedStackChip(chipValue);
            pushBetLog('info', 'select_chip_reused', {
                planned: formatMoney(chipValue),
                selected: selectedBefore > 0 ? formatMoney(selectedBefore) : formatMoney(chipValue),
                target: getElementLabel(chip),
                signal: stackBtn ? 'selected_ring_or_amount' : 'tray_selected',
            });
            return true;
        }
        clearRememberedSelectedStackChip();
        pushBetLog('info', 'select_chip', {
            planned: formatMoney(chipValue),
            selectedBefore: selectedBefore > 0 ? formatMoney(selectedBefore) : 'unknown',
            target: getElementLabel(chip),
            available: detectAvailableChips().map(c => formatMoney(c.value)).join(','),
        });
        const selectionClickSent = robustClick(chip);
        if (!selectionClickSent) {
            pushBetLog('error', 'select_chip_dispatch_failed', {
                planned: formatMoney(chipValue),
                target: getElementLabel(chip),
            });
            return false;
        }
        const selectionDispatchedAt = Date.now();
        await sleep(CLICK_DELAY_MS);
        let selectedAmount = getSelectedChipAmount();
        let stackSelectionConfirmed = !!(stackBtn && isStackChipButtonSelected(stackBtn));
        if (stackBtn && selectedAmount > 0 && selectedAmount !== chipValue) {
            await waitForCondition(() => {
                selectedAmount = getSelectedChipAmount();
                stackSelectionConfirmed = isStackChipButtonSelected(stackBtn);
                return selectedAmount === chipValue || stackSelectionConfirmed;
            }, CHIP_SELECTION_VERIFY_MS, VERIFY_POLL_MS);
            selectedAmount = getSelectedChipAmount();
            if (stackSelectionConfirmed) selectedAmount = chipValue;
            if (selectedAmount > 0 && selectedAmount !== chipValue) {
                pushBetLog('warn', 'select_chip_retry_after_stale_selection', {
                    planned: formatMoney(chipValue),
                    selected: formatMoney(selectedAmount),
                    target: getElementLabel(chip),
                });
                robustClick(chip);
                await waitForCondition(() => {
                    selectedAmount = getSelectedChipAmount();
                    stackSelectionConfirmed = isStackChipButtonSelected(stackBtn);
                    return selectedAmount === chipValue || stackSelectionConfirmed;
                }, CHIP_SELECTION_VERIFY_MS, VERIFY_POLL_MS);
                selectedAmount = getSelectedChipAmount();
                if (stackSelectionConfirmed) selectedAmount = chipValue;
            }
        }
        if (Number.isFinite(selectedAmount) && selectedAmount > 0 && selectedAmount !== chipValue) {
            pushBetLog('error', 'select_chip_mismatch', {
                planned: formatMoney(chipValue),
                selected: formatMoney(selectedAmount),
                target: getElementLabel(chip),
            });
            console.warn(`[AutoTrigger] selected chip mismatch: planned ${formatMoney(chipValue)}, visible selected ${formatMoney(selectedAmount)}; block betting`);
            return false;
        }
        if (stackBtn) {
            rememberSelectedStackChip(chipValue);
            const settleWaitMs = Math.max(0, CHIP_SELECTION_SETTLE_MS - (Date.now() - selectionDispatchedAt));
            if (settleWaitMs > 0) await sleep(settleWaitMs);
            pushBetLog('info', 'select_chip_ok_stack', {
                planned: formatMoney(chipValue),
                selected: Number.isFinite(selectedAmount) && selectedAmount > 0 ? formatMoney(selectedAmount) : 'unknown',
                signal: stackSelectionConfirmed || isStackChipButtonSelected(stackBtn) ? 'selected_ring_or_attribute' : 'dispatch_memory',
                settleWaitMs,
            });
            return true;
        }
        const selected = await waitForCondition(() => getSelectedChipAmount() === chipValue || isTrayChipSelected(chip), 260, 30);
        if (!selected) {
            const selectable = getSelectableChipsForPlan(detectAvailableChips()).map(c => formatMoney(c.value)).join(', ') || 'none';
            pushBetLog('error', 'select_chip_not_verified', {
                planned: formatMoney(chipValue),
                selected: formatMoney(getSelectedChipAmount()),
                selectable,
                target: getElementLabel(chip),
            });
            console.warn(`[AutoTrigger] chip ${chipValue} selection not verified; selectable=[${selectable}]`);
            return false;
        }
        const settleWaitMs = Math.max(0, CHIP_SELECTION_SETTLE_MS - (Date.now() - selectionDispatchedAt));
        if (settleWaitMs > 0) await sleep(settleWaitMs);
        pushBetLog('info', 'select_chip_ok_tray', {
            planned: formatMoney(chipValue),
            selected: formatMoney(getSelectedChipAmount()),
            settleWaitMs,
        });
        return true;
    }

    function isSelectedChipSafeForSeatClick(chipValue, maxPerSeatAmount) {
        const selectedAmount = getEffectiveSelectedChipAmount();
        if (!Number.isFinite(selectedAmount) || selectedAmount <= 0) {
            pushBetLog('error', 'seat_click_blocked_selected_unknown', {
                planned: formatMoney(chipValue),
                selected: 'unknown',
                cap: formatMoney(maxPerSeatAmount),
            });
            console.warn(`[AutoTrigger] selected chip unknown before seat click: planned ${formatMoney(chipValue)}; click blocked`);
            return false;
        }
        if (selectedAmount !== chipValue) {
            pushBetLog('error', 'seat_click_blocked_selected_mismatch', {
                planned: formatMoney(chipValue),
                selected: formatMoney(selectedAmount),
                cap: formatMoney(maxPerSeatAmount),
            });
            console.warn(`[AutoTrigger] selected chip mismatch before seat click: planned ${formatMoney(chipValue)}, selected ${formatMoney(selectedAmount)}; click blocked`);
            return false;
        }
        if (Number.isFinite(maxPerSeatAmount) && selectedAmount > maxPerSeatAmount) {
            pushBetLog('error', 'seat_click_blocked_over_cap', {
                selected: formatMoney(selectedAmount),
                cap: formatMoney(maxPerSeatAmount),
            });
            console.warn(`[AutoTrigger] selected chip over cap before seat click: selected ${formatMoney(selectedAmount)} > cap ${formatMoney(maxPerSeatAmount)}; click blocked`);
            return false;
        }
        return true;
    }

    async function waitForSeatBetAmountAtLeast(seatNumber, expectedAmount) {
        return waitForCondition(() => {
            const freshSeat = getSeatByNumber(seatNumber);
            const amount = getSeatDisplayedBetAmount(freshSeat);
            return Number.isFinite(amount) && amount >= expectedAmount && !hasGhostChip(freshSeat);
        }, BET_CLICK_VERIFY_MS, VERIFY_POLL_MS);
    }

    function getSeatAmountOrZero(seatNumber) {
        const state = getSeatBetState(getSeatByNumber(seatNumber));
        if (state.hasChip && !state.amountDetected) return null;
        return state.amountDetected ? state.amount : 0;
    }

    function getFirstClickableBetSeatNumber(seatNumbers) {
        for (const n of uniqueSortedSeatNumbers(seatNumbers)) {
            const seat = getSeatByNumber(n);
            if (seat && isVisible(seat) && !isDisabledLike(seat)) return n;
        }
        return null;
    }

    function readSeatAmountsForExpectations(expectations) {
        return expectations.map(item => {
            const seat = getSeatByNumber(item.seatNumber);
            const state = getSeatBetState(seat);
            const observedAmount = state.amountDetected ? state.amount : (state.hasChip ? null : 0);
            return {
                ...item,
                amount: state.amountDetected ? state.amount : null,
                observedAmount,
                hasChip: state.hasChip,
                chipCount: state.chipCount,
                hasGhost: hasGhostChip(seat),
            };
        });
    }

    async function waitForAllSeatBetAmountsExactly(expectations) {
        return waitForCondition(() => expectations.every(item => {
            const seat = getSeatByNumber(item.seatNumber);
            const amount = getSeatDisplayedBetAmount(seat);
            return Number.isFinite(amount) && amount === item.expectedAmount && !hasGhostChip(seat);
        }), BET_CLICK_VERIFY_MS, VERIFY_POLL_MS);
    }

    function areSeatsAlreadyAtAmount(seatNumbers, expectedAmount) {
        const targets = uniqueSortedSeatNumbers(seatNumbers);
        if (targets.length <= 0 || !Number.isFinite(expectedAmount) || expectedAmount <= 0) return false;
        return targets.every(n => {
            const state = getSeatBetState(getSeatByNumber(n));
            return state.amountDetected && state.amount === expectedAmount;
        });
    }

    function formatObservedSeatStates(states) {
        return states
            .map(item => `${item.seatNumber}:${item.observedAmount ?? (item.hasChip ? `chip?${item.chipCount ? `#${item.chipCount}` : ''}` : 'null')}${item.hasGhost ? '~ghost' : ''}`)
            .join(',');
    }

    function areObservedStatesUnchangedSafe(states) {
        return states.every(item =>
            item.observedAmount === item.baseAmount &&
            !item.hasChip
        );
    }

    function canRetryNoEffectBetClick(states, attempt) {
        return attempt < BET_CLICK_RETRY_LIMIT &&
            attempt < BET_NO_EFFECT_RETRY_LIMIT &&
            areObservedStatesUnchangedSafe(states);
    }

    function areObservedStatesSafelyAtSingleChipTarget(states, chipValue, maxPerSeatAmount) {
        if (!states || states.length <= 0) return false;
        if (!Number.isFinite(chipValue) || !Number.isFinite(maxPerSeatAmount)) return false;
        if (chipValue !== maxPerSeatAmount) return false;
        return states.every(item =>
            item.baseAmount === 0 &&
            item.expectedAmount === maxPerSeatAmount &&
            item.hasChip &&
            item.chipCount > 0 &&
            item.chipCount <= SINGLE_CHIP_DOM_PART_LIMIT &&
            !item.hasGhost &&
            (item.observedAmount === null || item.observedAmount === maxPerSeatAmount)
        );
    }

    function areObservedStatesSafelyAtExpectedAmount(states, chipValue, clickCount) {
        if (!states || states.length <= 0) return false;
        if (!Number.isFinite(chipValue) || chipValue <= 0 || !Number.isFinite(clickCount) || clickCount <= 0) return false;
        return states.every(item => {
            if (item.hasGhost) return false;
            return Number.isFinite(item.observedAmount) &&
                item.observedAmount === item.expectedAmount;
        });
    }

    function areObservedStatesAtHardCap(states, maxPerSeatAmount) {
        if (!Number.isFinite(maxPerSeatAmount) || maxPerSeatAmount <= 0) return false;
        return states.length > 0 && states.every(item =>
            !item.hasGhost && item.observedAmount === maxPerSeatAmount
        );
    }

    function getUniformObservedAmountClicks(states, chipValue, maxClickCount) {
        if (!states || states.length <= 0 || !Number.isFinite(chipValue) || chipValue <= 0) return null;
        const counts = [];
        for (const item of states) {
            if (item.hasGhost) return null;
            // 한 개의 시각적 칩이 여러 DOM 조각으로 렌더링될 수 있으므로 chipCount를 클릭 수로 사용하지 않는다.
            if (!Number.isFinite(item.observedAmount)) return null;
            const delta = item.observedAmount - Math.max(0, item.baseAmount || 0);
            if (delta < 0 || delta % chipValue !== 0) return null;
            const count = delta / chipValue;
            if (!Number.isInteger(count) || count < 0 || count > maxClickCount) return null;
            counts.push(count);
        }
        return counts.every(count => count === counts[0]) ? counts[0] : null;
    }

    function getWalletBroadcastAppliedClicks(baseReading, currentReading, chipValue, seatCount, maxClickCount) {
        if (!baseReading?.detected || baseReading.ambiguous ||
            !currentReading?.detected || currentReading.ambiguous) return null;
        if (!Number.isFinite(baseReading.amount) || !Number.isFinite(currentReading.amount)) return null;
        if (!Number.isFinite(chipValue) || chipValue <= 0 ||
            !Number.isFinite(seatCount) || seatCount <= 0) return null;

        const perBroadcastClick = chipValue * seatCount;
        const delta = currentReading.amount - baseReading.amount;
        if (delta < 0 || delta % perBroadcastClick !== 0) return null;
        const clicks = delta / perBroadcastClick;
        if (!Number.isInteger(clicks) || clicks < 0 || clicks > maxClickCount) return null;
        return clicks;
    }

    function getVerifiedBroadcastAppliedClicks(states, baseWalletReading, currentWalletReading, chipValue, seatCount, maxClickCount) {
        const amountClicks = getUniformObservedAmountClicks(states, chipValue, maxClickCount);
        const walletClicks = getWalletBroadcastAppliedClicks(
            baseWalletReading,
            currentWalletReading,
            chipValue,
            seatCount,
            maxClickCount
        );
        if (Number.isFinite(walletClicks) && walletClicks > 0) return walletClicks;
        if (Number.isFinite(amountClicks)) return amountClicks;
        return Number.isFinite(walletClicks) ? walletClicks : null;
    }

    function isWalletReadingExactAmount(reading, expectedAmount) {
        return !!reading &&
            reading.detected &&
            !reading.ambiguous &&
            Number.isFinite(reading.amount) &&
            reading.amount === expectedAmount;
    }

    function resolveBroadcastSeatBaseline({
        seat,
        state,
        expectedBasePerSeatAmount,
        walletBaseReading,
        expectedWalletBaseAmount,
        seatCount,
        allowWalletDerivedSeatBaseline,
    }) {
        const observedAmount = state.amountDetected ? state.amount : (state.hasChip ? null : 0);
        if (expectedBasePerSeatAmount === null) {
            return observedAmount === null
                ? { ok: false, amount: null, observedAmount, source: 'unknown' }
                : { ok: true, amount: observedAmount, observedAmount, source: 'seat' };
        }
        if (observedAmount === expectedBasePerSeatAmount) {
            return { ok: true, amount: observedAmount, observedAmount, source: 'seat' };
        }

        const walletBaselineExact = expectedWalletBaseAmount !== null &&
            expectedBasePerSeatAmount > 0 &&
            expectedWalletBaseAmount === expectedBasePerSeatAmount * seatCount &&
            isWalletReadingExactAmount(walletBaseReading, expectedWalletBaseAmount);
        const seatHasVerifiedChip = state.hasChip && !hasGhostChip(seat);
        if (
            observedAmount === null ||
            (allowWalletDerivedSeatBaseline && walletBaselineExact && seatHasVerifiedChip)
        ) {
            return {
                ok: true,
                amount: expectedBasePerSeatAmount,
                observedAmount,
                source: observedAmount === null ? 'wallet_unknown' : 'wallet_override',
            };
        }
        return { ok: false, amount: observedAmount, observedAmount, source: 'mismatch' };
    }

    function isWalletReadingOverBroadcastCap(reading, maxPerSeatAmount, seatCount) {
        if (!reading?.detected || reading.ambiguous || !Number.isFinite(reading.amount)) return false;
        if (!Number.isFinite(maxPerSeatAmount) || !Number.isFinite(seatCount) || seatCount <= 0) return false;
        return reading.amount > maxPerSeatAmount * seatCount;
    }

    function verifyBroadcastSeatTargetsBeforeClick(seatNumbers, context) {
        if (typeof getBroadcastSeatTargetState !== 'function') return true;
        const state = getBroadcastSeatTargetState(seatNumbers);
        if (state.exact) return true;
        if (typeof lastFailReason !== 'undefined') lastFailReason = 'broadcast_seat_set_mismatch';
        pushBetLog('error', 'broadcast_seat_set_mismatch', {
            context,
            targets: state.targets.join(','),
            live: state.live.join(','),
            missing: state.missing.join(','),
            extra: state.extra.join(','),
            reserved: state.reserved?.join(',') || '',
            unresolvedReserved: state.unresolvedReserved?.join(',') || '',
        });
        console.warn(`[AutoTrigger] broadcast seat set mismatch (${context}): target=${state.targets.join(',') || 'none'} live=${state.live.join(',') || 'none'}`);
        return false;
    }

    async function clickSingleSeatChipVerified(seatNumber, chipValue, maxPerSeatAmount = Infinity) {
        for (let attempt = 0; attempt <= BET_CLICK_RETRY_LIMIT; attempt++) {
            if (isScriptStopped()) return false;
            if (typeof isSettingsInputPending === 'function' && isSettingsInputPending()) return false;
            const seat = getSeatByNumber(seatNumber);
                if (!seat || !isVisible(seat) || isDisabledLike(seat)) {
                    pushBetLog('error', 'individual_seat_not_ready', { seat: seatNumber, chip: formatMoney(chipValue) });
                    console.warn(`[AutoTrigger] seat ${seatNumber} not ready for individual chip click`);
                    return false;
                }
                await closeBetBlockingBottomSheetIfOpen('individual_bet_click');
                const baseState = getSeatBetState(seat);
                const baseAmount = baseState.amountDetected ? baseState.amount : (baseState.hasChip ? null : 0);
            if (baseAmount === null) {
                pushBetLog('error', 'individual_base_unknown', {
                    seat: seatNumber,
                    chip: formatMoney(chipValue),
                    chipCount: baseState.chipCount,
                });
                console.warn(`[AutoTrigger] seat ${seatNumber} has chip but amount is unknown; skip individual chip click`);
                return false;
            }
            const expectedAmount = baseAmount + chipValue;
            if (expectedAmount > maxPerSeatAmount) {
                pushBetLog('error', 'individual_hard_cap_before_click', {
                    seat: seatNumber,
                    base: formatMoney(baseAmount),
                    chip: formatMoney(chipValue),
                    expected: formatMoney(expectedAmount),
                    cap: formatMoney(maxPerSeatAmount),
                });
                console.warn(`[AutoTrigger] hard cap: seat ${seatNumber} ${formatMoney(baseAmount)} + ${formatMoney(chipValue)} > ${formatMoney(maxPerSeatAmount)}; stop before click`);
                return false;
            }

            const target = getSeatBetClickElement(seat, attempt);
            const targetTag = getElementLabel(target);
            markBetClickDebug(`individual ${seatNumber}:${targetTag}`);
            console.log(`[AutoTrigger] individual chip=${chipValue} attempt ${attempt + 1}: seat=${seatNumber}, target=${targetTag}`);
            pushBetLog('info', 'individual_click_try', {
                seat: seatNumber,
                chip: formatMoney(chipValue),
                attempt: attempt + 1,
                target: targetTag,
                base: formatMoney(baseAmount),
                expected: formatMoney(expectedAmount),
                cap: formatMoney(maxPerSeatAmount),
            });
            if (!isSelectedChipSafeForSeatClick(chipValue, maxPerSeatAmount)) return false;
            const clickSent = robustBetClick(target, { attempt });
            if (!clickSent) {
                pushBetLog('warn', 'individual_click_dispatch_failed', {
                    seat: seatNumber,
                    chip: formatMoney(chipValue),
                    target: targetTag,
                });
                if (attempt < BET_CLICK_RETRY_LIMIT) continue;
                return false;
            }
            await sleep(SEAT_CLICK_DELAY_MS);

            const ok = await waitForCondition(() => {
                const freshSeat = getSeatByNumber(seatNumber);
                const amount = getSeatDisplayedBetAmount(freshSeat);
                return Number.isFinite(amount) && amount === expectedAmount && !hasGhostChip(freshSeat);
            }, BET_CLICK_VERIFY_MS, VERIFY_POLL_MS);
            if (ok) return true;

            const [observed] = readSeatAmountsForExpectations([{
                seatNumber,
                baseAmount,
                baseChipCount: baseState.chipCount,
                expectedAmount,
            }]);
            if (areObservedStatesSafelyAtExpectedAmount([observed], chipValue, 1)) {
                console.log(`[AutoTrigger] individual chip=${chipValue} verified by chip-count inference`);
                return true;
            }
            if (areObservedStatesUnchangedSafe([observed])) {
                await sleep(BET_NO_EFFECT_RECHECK_MS);
                const [rechecked] = readSeatAmountsForExpectations([{
                    seatNumber,
                    baseAmount,
                    baseChipCount: baseState.chipCount,
                    expectedAmount,
                }]);
                if (areObservedStatesSafelyAtExpectedAmount([rechecked], chipValue, 1)) {
                    console.log(`[AutoTrigger] individual chip=${chipValue} verified by delayed chip-count inference`);
                    return true;
                }
                if (canRetryNoEffectBetClick([rechecked], attempt)) {
                    pushBetLog('warn', 'individual_click_no_effect_retry', {
                        seat: seatNumber,
                        chip: formatMoney(chipValue),
                        attempt: attempt + 1,
                        observed: formatObservedSeatStates([rechecked]),
                    });
                    if (!(await selectChipByValue(chipValue))) return false;
                    console.warn(`[AutoTrigger] individual click had no effect (observed=${formatObservedSeatStates([rechecked])}); retry with alternate click profile`);
                    continue;
                }
                if (areObservedStatesUnchangedSafe([rechecked])) {
                    pushBetLog('warn', 'individual_click_unchanged_guard', {
                        seat: seatNumber,
                        chip: formatMoney(chipValue),
                        observed: formatObservedSeatStates([rechecked]),
                    });
                    markBetClickGuard('individual_click_unverified_wait', {
                        seat: seatNumber,
                        chip: formatMoney(chipValue),
                        observed: formatObservedSeatStates([rechecked]),
                    });
                    console.warn(`[AutoTrigger] individual click unchanged (observed=${formatObservedSeatStates([rechecked])}); guard before any retry`);
                    return false;
                }
                pushBetLog('error', 'individual_click_changed_not_verified', {
                    seat: seatNumber,
                    chip: formatMoney(chipValue),
                    observed: formatObservedSeatStates([rechecked]),
                });
                markBetClickGuard('individual_click_changed_not_verified', {
                    seat: seatNumber,
                    chip: formatMoney(chipValue),
                    observed: formatObservedSeatStates([rechecked]),
                });
                console.warn(`[AutoTrigger] individual click changed late but not safely verified (observed=${formatObservedSeatStates([rechecked])}); stop before retry`);
                return false;
            }
            if (observed.observedAmount === null || observed.hasChip ||
                (Number.isFinite(observed.observedAmount) && observed.observedAmount !== baseAmount)) {
                pushBetLog('error', 'individual_click_not_verified', {
                    seat: seatNumber,
                    chip: formatMoney(chipValue),
                    observed: formatObservedSeatStates([observed]),
                });
                markBetClickGuard('individual_click_not_verified', {
                    seat: seatNumber,
                    chip: formatMoney(chipValue),
                    observed: formatObservedSeatStates([observed]),
                });
                console.warn(`[AutoTrigger] individual click not safely verified (observed=${formatObservedSeatStates([observed])}); stop instead of retrying`);
                return false;
            }
            pushBetLog('error', 'individual_click_no_effect', {
                seat: seatNumber,
                chip: formatMoney(chipValue),
                target: targetTag,
            });
            markBetClickGuard('individual_click_no_effect', {
                seat: seatNumber,
                chip: formatMoney(chipValue),
                target: targetTag,
            });
            console.warn(`[AutoTrigger] individual click did not verify (seat=${seatNumber}); stop instead of retrying`);
            return false;
        }
        return false;
    }

    async function clickMainBetChipBroadcastBatchVerified(seatNumbers, chipValue, clickCount, maxPerSeatAmount = Infinity, options = {}) {
        const targets = uniqueSortedSeatNumbers(seatNumbers);
        if (targets.length <= 0 || clickCount <= 1) return false;
        if (!verifyBroadcastSeatTargetsBeforeClick(targets, 'batch_start')) return false;

        const clickSeatNumber = getFirstClickableBetSeatNumber(targets);
        if (clickSeatNumber === null) {
            pushBetLog('error', 'broadcast_no_clickable_seat', {
                seats: targets.join(','),
                chip: formatMoney(chipValue),
                count: clickCount,
            });
            console.warn('[AutoTrigger] no clickable target seat for broadcast batch bet');
            return false;
        }

        const expectedBasePerSeatAmount = Number.isFinite(options.expectedBasePerSeatAmount)
            ? options.expectedBasePerSeatAmount
            : null;
        const expectedWalletBaseAmount = Number.isFinite(options.expectedWalletBaseAmount)
            ? options.expectedWalletBaseAmount
            : null;
        const walletBaseReading = typeof getWalletTotalBetReading === 'function'
            ? getWalletTotalBetReading()
            : null;
        if (
            expectedWalletBaseAmount !== null &&
            !isWalletReadingExactAmount(walletBaseReading, expectedWalletBaseAmount)
        ) {
            pushBetLog('error', 'broadcast_wallet_baseline_mismatch', {
                expected: formatMoney(expectedWalletBaseAmount),
                actual: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                ambiguous: walletBaseReading?.ambiguous ? 'Y' : 'N',
            });
            return false;
        }

        const expectations = [];
        for (const n of targets) {
            const baseSeat = getSeatByNumber(n);
            const baseState = getSeatBetState(baseSeat);
            const baseline = resolveBroadcastSeatBaseline({
                seat: baseSeat,
                state: baseState,
                expectedBasePerSeatAmount,
                walletBaseReading,
                expectedWalletBaseAmount,
                seatCount: targets.length,
                allowWalletDerivedSeatBaseline: options.allowWalletDerivedSeatBaseline === true,
            });
            const baseAmount = baseline.amount;
            if (!baseline.ok && baseAmount === null) {
                pushBetLog('error', 'broadcast_base_unknown', {
                    seat: n,
                    chip: formatMoney(chipValue),
                    count: clickCount,
                    chipCount: baseState.chipCount,
                });
                console.warn(`[AutoTrigger] seat ${n} has chip but amount is unknown; skip batch chip click`);
                return false;
            }
            if (!baseline.ok) {
                pushBetLog('error', 'broadcast_seat_baseline_mismatch', {
                    seat: n,
                    expected: formatMoney(expectedBasePerSeatAmount),
                    actual: formatMoney(baseAmount),
                    wallet: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                });
                return false;
            }
            if (baseline.source === 'wallet_override') {
                pushBetLog('warn', 'broadcast_seat_baseline_wallet_override', {
                    seat: n,
                    expected: formatMoney(expectedBasePerSeatAmount),
                    observed: formatMoney(baseline.observedAmount),
                    wallet: formatMoney(walletBaseReading.amount),
                });
            }
            const expectedAmount = baseAmount + chipValue * clickCount;
            if (expectedAmount > maxPerSeatAmount) {
                pushBetLog('error', 'broadcast_hard_cap_before_batch', {
                    seat: n,
                    base: formatMoney(baseAmount),
                    chip: formatMoney(chipValue),
                    count: clickCount,
                    expected: formatMoney(expectedAmount),
                    cap: formatMoney(maxPerSeatAmount),
                });
                console.warn(`[AutoTrigger] hard cap: seat ${n} ${formatMoney(baseAmount)} + ${formatMoney(chipValue * clickCount)} > ${formatMoney(maxPerSeatAmount)}; stop before batch click`);
                return false;
            }
            expectations.push({
                seatNumber: n,
                baseAmount,
                baseChipCount: baseState.chipCount,
                expectedAmount,
            });
        }

        const readAppliedClicks = states => getVerifiedBroadcastAppliedClicks(
            states,
            walletBaseReading,
            typeof getWalletTotalBetReading === 'function' ? getWalletTotalBetReading() : null,
            chipValue,
            targets.length,
            clickCount
        );

        let appliedClicks = 0;
        while (appliedClicks < clickCount) {
            if (isScriptStopped()) return false;

            const beforeStates = readSeatAmountsForExpectations(expectations);
            const walletBeforeProgress = typeof getWalletTotalBetReading === 'function'
                ? getWalletTotalBetReading()
                : null;
            if (isWalletReadingOverBroadcastCap(walletBeforeProgress, maxPerSeatAmount, targets.length)) {
                pushBetLog('error', 'broadcast_wallet_over_cap_before_progress', {
                    actual: formatMoney(walletBeforeProgress.amount),
                    cap: formatMoney(maxPerSeatAmount * targets.length),
                });
                return false;
            }
            const alreadyApplied = readAppliedClicks(beforeStates);
            if (Number.isFinite(alreadyApplied) && alreadyApplied > appliedClicks) {
                appliedClicks = alreadyApplied;
                if (appliedClicks >= clickCount) return true;
            }

            const nextApplied = appliedClicks + 1;
            let progressed = false;
            for (let attempt = 0; attempt <= BET_CLICK_RETRY_LIMIT; attempt++) {
                if (isScriptStopped()) return false;
                if (typeof isSettingsInputPending === 'function' && isSettingsInputPending()) return false;
                const seat = getSeatByNumber(clickSeatNumber);
                if (!seat || !isVisible(seat) || isDisabledLike(seat)) {
                    console.warn(`[AutoTrigger] broadcast batch click seat ${clickSeatNumber} not ready`);
                    return false;
                }
                await closeBetBlockingBottomSheetIfOpen('broadcast_batch_bet_click');
                if (!verifyBroadcastSeatTargetsBeforeClick(targets, 'batch_click')) return false;

                const target = getSeatBetClickElement(seat, attempt);
                const targetTag = getElementLabel(target);
                const candidateTags = getSeatBetClickCandidates(seat).slice(0, 6).map(getElementLabel).join('>');
                const probe = getBetClickProbeLabel(target);
                markBetClickDebug(`broadcast-progress ${clickSeatNumber}:${targetTag}`);
                console.log(`[AutoTrigger] broadcast progress chip=${chipValue} ${nextApplied}/${clickCount} attempt ${attempt + 1}: clickSeat=${clickSeatNumber}, target=${targetTag}, seats=${targets.join(',')}`);
                pushBetLog('info', 'broadcast_click_try', {
                    clickSeat: clickSeatNumber,
                    seats: targets.join(','),
                    chip: formatMoney(chipValue),
                    progress: `${nextApplied}/${clickCount}`,
                    attempt: attempt + 1,
                    target: targetTag,
                    candidates: candidateTags,
                    probe,
                    cap: formatMoney(maxPerSeatAmount),
                });
                if (!isSelectedChipSafeForSeatClick(chipValue, maxPerSeatAmount)) return false;
                const clickSent = robustBetClick(target, { attempt });
                if (!clickSent) {
                    pushBetLog('warn', 'broadcast_click_dispatch_failed', {
                        clickSeat: clickSeatNumber,
                        seats: targets.join(','),
                        chip: formatMoney(chipValue),
                        progress: `${nextApplied}/${clickCount}`,
                        target: targetTag,
                    });
                    if (attempt < BET_CLICK_RETRY_LIMIT) continue;
                    return false;
                }
                await sleep(SEAT_CLICK_DELAY_MS);

                await waitForCondition(() => {
                    const states = readSeatAmountsForExpectations(expectations);
                    const applied = readAppliedClicks(states);
                    return Number.isFinite(applied) && applied >= nextApplied;
                }, BROADCAST_CLICK_PROGRESS_WAIT_MS, VERIFY_POLL_MS);

                const observedStates = readSeatAmountsForExpectations(expectations);
                const observed = formatObservedSeatStates(observedStates);
                const walletAfterClick = typeof getWalletTotalBetReading === 'function'
                    ? getWalletTotalBetReading()
                    : null;
                if (isWalletReadingOverBroadcastCap(walletAfterClick, maxPerSeatAmount, targets.length)) {
                    pushBetLog('error', 'broadcast_wallet_over_cap_after_click', {
                        actual: formatMoney(walletAfterClick.amount),
                        cap: formatMoney(maxPerSeatAmount * targets.length),
                        observed,
                    });
                    markBetClickGuard('broadcast_wallet_over_cap_after_click', {
                        actual: formatMoney(walletAfterClick.amount),
                        cap: formatMoney(maxPerSeatAmount * targets.length),
                    });
                    return false;
                }
                const observedApplied = readAppliedClicks(observedStates);
                if (Number.isFinite(observedApplied) && observedApplied >= nextApplied) {
                    appliedClicks = observedApplied;
                    progressed = true;
                    pushBetLog('info', 'broadcast_click_progressed', {
                        chip: formatMoney(chipValue),
                        progress: `${appliedClicks}/${clickCount}`,
                        observed,
                    });
                    console.log(`[AutoTrigger] broadcast progress chip=${chipValue}: ${appliedClicks}/${clickCount} applied (${observed})`);
                    break;
                }

                if (Number.isFinite(observedApplied) && observedApplied === appliedClicks) {
                    await sleep(BET_NO_EFFECT_RECHECK_MS);
                    const recheckedStates = readSeatAmountsForExpectations(expectations);
                    const rechecked = formatObservedSeatStates(recheckedStates);
                    const recheckedApplied = readAppliedClicks(recheckedStates);
                    if (Number.isFinite(recheckedApplied) && recheckedApplied >= nextApplied) {
                        appliedClicks = recheckedApplied;
                        progressed = true;
                        pushBetLog('info', 'broadcast_click_progressed_delayed', {
                            chip: formatMoney(chipValue),
                            progress: `${appliedClicks}/${clickCount}`,
                            observed: rechecked,
                        });
                        break;
                    }
                    if (Number.isFinite(recheckedApplied) && recheckedApplied === appliedClicks && canRetryNoEffectBetClick(recheckedStates, attempt)) {
                        pushBetLog('warn', 'broadcast_click_no_effect_retry', {
                            chip: formatMoney(chipValue),
                            progress: `${appliedClicks}/${clickCount}`,
                            attempt: attempt + 1,
                            observed: rechecked,
                        });
                        if (!(await selectChipByValue(chipValue))) return false;
                        console.warn(`[AutoTrigger] broadcast progress had no effect at ${appliedClicks}/${clickCount} (observed=${rechecked}); retry with alternate click profile`);
                        continue;
                    }
                    pushBetLog('warn', 'broadcast_click_unchanged_guard', {
                        chip: formatMoney(chipValue),
                        progress: `${appliedClicks}/${clickCount}`,
                        observed: rechecked,
                    });
                    markBetClickGuard('broadcast_click_unverified_wait', {
                        chip: formatMoney(chipValue),
                        progress: `${appliedClicks}/${clickCount}`,
                        observed: rechecked,
                    });
                    console.warn(`[AutoTrigger] broadcast progress unchanged at ${appliedClicks}/${clickCount} (observed=${rechecked}); guard before any retry`);
                    return false;
                }

                pushBetLog('error', 'broadcast_click_not_verified', {
                    chip: formatMoney(chipValue),
                    progress: `${appliedClicks}/${clickCount}`,
                    observed,
                });
                markBetClickGuard('broadcast_click_not_verified', {
                    chip: formatMoney(chipValue),
                    progress: `${appliedClicks}/${clickCount}`,
                    observed,
                });
                console.warn(`[AutoTrigger] broadcast progress not safely verified (observed=${observed}); stop before retrying to prevent overbet`);
                return false;
            }

            if (!progressed) {
                pushBetLog('error', 'broadcast_progress_failed', {
                    chip: formatMoney(chipValue),
                    progress: `${appliedClicks}/${clickCount}`,
                    seats: targets.join(','),
                });
                markBetClickGuard('broadcast_progress_failed', {
                    chip: formatMoney(chipValue),
                    progress: `${appliedClicks}/${clickCount}`,
                    seats: targets.join(','),
                });
                console.warn(`[AutoTrigger] broadcast progress failed at ${appliedClicks}/${clickCount}`);
                return false;
            }
        }

        const finalStates = readSeatAmountsForExpectations(expectations);
        const finalWalletReading = typeof getWalletTotalBetReading === 'function'
            ? getWalletTotalBetReading()
            : null;
        if (isWalletReadingOverBroadcastCap(finalWalletReading, maxPerSeatAmount, targets.length)) return false;
        const finalApplied = readAppliedClicks(finalStates);
        if (Number.isFinite(finalApplied) && finalApplied >= clickCount) return true;
        return waitForAllSeatBetAmountsExactly(expectations);
    }

    async function clickMainBetChipBroadcastVerified(seatNumbers, chipValue, clickCount, maxPerSeatAmount = Infinity, options = {}) {
        const targets = uniqueSortedSeatNumbers(seatNumbers);
        if (targets.length <= 0) return false;
        if (!verifyBroadcastSeatTargetsBeforeClick(targets, 'single_start')) return false;
        if (Number.isFinite(maxPerSeatAmount) && areSeatsAlreadyAtAmount(targets, maxPerSeatAmount)) {
            console.log(`[AutoTrigger] seats already at ${formatMoney(maxPerSeatAmount)}; skip broadcast chip=${chipValue}`);
            return true;
        }
        const clickSeatNumber = getFirstClickableBetSeatNumber(targets);
        if (clickSeatNumber === null) {
            pushBetLog('error', 'broadcast_single_no_clickable_seat', {
                seats: targets.join(','),
                chip: formatMoney(chipValue),
            });
            console.warn('[AutoTrigger] no clickable target seat for broadcast bet');
            return false;
        }

        if (clickCount > 1) {
            return clickMainBetChipBroadcastBatchVerified(targets, chipValue, clickCount, maxPerSeatAmount, options);
        }

        for (let i = 0; i < clickCount; i++) {
            if (Number.isFinite(maxPerSeatAmount) && areSeatsAlreadyAtAmount(targets, maxPerSeatAmount)) {
                return true;
            }
            let clicked = false;
            for (let attempt = 0; attempt <= BET_CLICK_RETRY_LIMIT; attempt++) {
                if (isScriptStopped()) return false;
                if (typeof isSettingsInputPending === 'function' && isSettingsInputPending()) return false;
                const seat = getSeatByNumber(clickSeatNumber);
                if (!seat || !isVisible(seat) || isDisabledLike(seat)) {
                    pushBetLog('error', 'broadcast_single_seat_not_ready', {
                        clickSeat: clickSeatNumber,
                        chip: formatMoney(chipValue),
                    });
                    console.warn(`[AutoTrigger] broadcast click seat ${clickSeatNumber} not ready`);
                    return false;
                }
                await closeBetBlockingBottomSheetIfOpen('broadcast_single_bet_click');
                if (!verifyBroadcastSeatTargetsBeforeClick(targets, 'single_click')) return false;
                const expectedBasePerSeatAmount = Number.isFinite(options.expectedBasePerSeatAmount)
                    ? options.expectedBasePerSeatAmount + chipValue * i
                    : null;
                const expectedWalletBaseAmount = Number.isFinite(options.expectedWalletBaseAmount)
                    ? options.expectedWalletBaseAmount + chipValue * i * targets.length
                    : null;
                const walletBaseReading = typeof getWalletTotalBetReading === 'function'
                    ? getWalletTotalBetReading()
                    : null;
                if (
                    expectedWalletBaseAmount !== null &&
                    !isWalletReadingExactAmount(walletBaseReading, expectedWalletBaseAmount)
                ) {
                    pushBetLog('error', 'broadcast_single_wallet_baseline_mismatch', {
                        expected: formatMoney(expectedWalletBaseAmount),
                        actual: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                        ambiguous: walletBaseReading?.ambiguous ? 'Y' : 'N',
                    });
                    return false;
                }
                const expectations = [];
                for (const n of targets) {
                    const baseSeat = getSeatByNumber(n);
                    const baseState = getSeatBetState(baseSeat);
                    const baseline = resolveBroadcastSeatBaseline({
                        seat: baseSeat,
                        state: baseState,
                        expectedBasePerSeatAmount,
                        walletBaseReading,
                        expectedWalletBaseAmount,
                        seatCount: targets.length,
                        allowWalletDerivedSeatBaseline: options.allowWalletDerivedSeatBaseline === true,
                    });
                    const baseAmount = baseline.amount;
                    if (!baseline.ok && baseAmount === null) {
                        pushBetLog('error', 'broadcast_single_base_unknown', {
                            seat: n,
                            chip: formatMoney(chipValue),
                            chipCount: baseState.chipCount,
                        });
                        console.warn(`[AutoTrigger] seat ${n} has chip but amount is unknown; skip extra chip click`);
                        return false;
                    }
                    if (!baseline.ok) {
                        pushBetLog('error', 'broadcast_single_seat_baseline_mismatch', {
                            seat: n,
                            expected: formatMoney(expectedBasePerSeatAmount),
                            actual: formatMoney(baseAmount),
                            wallet: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                        });
                        return false;
                    }
                    if (baseline.source === 'wallet_override') {
                        pushBetLog('warn', 'broadcast_single_seat_baseline_wallet_override', {
                            seat: n,
                            expected: formatMoney(expectedBasePerSeatAmount),
                            observed: formatMoney(baseline.observedAmount),
                            wallet: formatMoney(walletBaseReading.amount),
                        });
                    }
                    if (baseAmount + chipValue > maxPerSeatAmount) {
                        pushBetLog('error', 'broadcast_single_hard_cap_before_click', {
                            seat: n,
                            base: formatMoney(baseAmount),
                            chip: formatMoney(chipValue),
                            expected: formatMoney(baseAmount + chipValue),
                            cap: formatMoney(maxPerSeatAmount),
                        });
                        console.warn(`[AutoTrigger] hard cap: seat ${n} ${formatMoney(baseAmount)} + ${formatMoney(chipValue)} > ${formatMoney(maxPerSeatAmount)}; stop before click`);
                        return false;
                    }
                    expectations.push({
                        seatNumber: n,
                        baseAmount,
                        baseChipCount: baseState.chipCount,
                        expectedAmount: baseAmount + chipValue,
                    });
                }
                const target = getSeatBetClickElement(seat, attempt);
                const targetTag = getElementLabel(target);
                const candidateTags = getSeatBetClickCandidates(seat).slice(0, 6).map(getElementLabel).join('>');
                const probe = getBetClickProbeLabel(target);
                markBetClickDebug(`broadcast ${clickSeatNumber}:${targetTag}`);
                console.log(`[AutoTrigger] broadcast chip=${chipValue} ${i + 1}/${clickCount} attempt ${attempt + 1}: clickSeat=${clickSeatNumber}, target=${targetTag}, seats=${targets.join(',')}`);
                pushBetLog('info', 'broadcast_single_click_try', {
                    clickSeat: clickSeatNumber,
                    seats: targets.join(','),
                    chip: formatMoney(chipValue),
                    attempt: attempt + 1,
                    target: targetTag,
                    candidates: candidateTags,
                    probe,
                    basePerSeat: Number.isFinite(expectedBasePerSeatAmount) ? formatMoney(expectedBasePerSeatAmount) : 'dom',
                    walletBefore: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                    expectedWalletAfter: Number.isFinite(expectedWalletBaseAmount)
                        ? formatMoney(expectedWalletBaseAmount + chipValue * targets.length)
                        : 'unknown',
                    cap: formatMoney(maxPerSeatAmount),
                });
                if (!isSelectedChipSafeForSeatClick(chipValue, maxPerSeatAmount)) return false;
                const clickSent = robustBetClick(target, { attempt });
                if (!clickSent) {
                    pushBetLog('warn', 'broadcast_single_click_dispatch_failed', {
                        clickSeat: clickSeatNumber,
                        seats: targets.join(','),
                        chip: formatMoney(chipValue),
                        target: targetTag,
                    });
                    if (attempt < BET_CLICK_RETRY_LIMIT) continue;
                    return false;
                }
                await sleep(SEAT_CLICK_DELAY_MS);

                const seatAmountsExact = await waitForAllSeatBetAmountsExactly(expectations);
                const observedStates = readSeatAmountsForExpectations(expectations);
                const observed = formatObservedSeatStates(observedStates);
                const walletAfterClick = typeof getWalletTotalBetReading === 'function'
                    ? getWalletTotalBetReading()
                    : null;
                if (isWalletReadingOverBroadcastCap(walletAfterClick, maxPerSeatAmount, targets.length)) {
                    pushBetLog('error', 'broadcast_single_wallet_over_cap_after_click', {
                        actual: formatMoney(walletAfterClick.amount),
                        cap: formatMoney(maxPerSeatAmount * targets.length),
                        observed,
                    });
                    markBetClickGuard('broadcast_single_wallet_over_cap_after_click', {
                        actual: formatMoney(walletAfterClick.amount),
                        cap: formatMoney(maxPerSeatAmount * targets.length),
                    });
                    return false;
                }
                const walletApplied = getWalletBroadcastAppliedClicks(
                    walletBaseReading,
                    walletAfterClick,
                    chipValue,
                    targets.length,
                    1
                );
                if (walletApplied === 1) {
                    pushBetLog('info', 'broadcast_single_wallet_verified', {
                        chip: formatMoney(chipValue),
                        before: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                        after: formatMoney(walletAfterClick.amount),
                        delta: formatMoney(chipValue * targets.length),
                        seats: targets.join(','),
                    });
                    clicked = true;
                    break;
                }
                if (seatAmountsExact) {
                    clicked = true;
                    break;
                }
                if (areObservedStatesSafelyAtExpectedAmount(observedStates, chipValue, 1)) {
                    console.log(`[AutoTrigger] broadcast chip=${chipValue} verified by chip-count inference (${observed})`);
                    clicked = true;
                    break;
                }
                if (areObservedStatesAtHardCap(observedStates, maxPerSeatAmount)) {
                    console.log(`[AutoTrigger] broadcast chip=${chipValue} reached hard cap (${observed})`);
                    return true;
                }
                if (areObservedStatesUnchangedSafe(observedStates)) {
                    await sleep(BET_NO_EFFECT_RECHECK_MS);
                    const recheckedStates = readSeatAmountsForExpectations(expectations);
                    const rechecked = formatObservedSeatStates(recheckedStates);
                    const walletRechecked = typeof getWalletTotalBetReading === 'function'
                        ? getWalletTotalBetReading()
                        : null;
                    const delayedWalletApplied = getWalletBroadcastAppliedClicks(
                        walletBaseReading,
                        walletRechecked,
                        chipValue,
                        targets.length,
                        1
                    );
                    if (delayedWalletApplied === 1) {
                        clicked = true;
                        break;
                    }
                    if (areObservedStatesSafelyAtExpectedAmount(recheckedStates, chipValue, 1)) {
                        console.log(`[AutoTrigger] broadcast chip=${chipValue} verified by delayed chip-count inference (${rechecked})`);
                        clicked = true;
                        break;
                    }
                    if (areObservedStatesAtHardCap(recheckedStates, maxPerSeatAmount)) {
                        console.log(`[AutoTrigger] broadcast chip=${chipValue} reached hard cap after delayed read (${rechecked})`);
                        return true;
                    }
                    if (canRetryNoEffectBetClick(recheckedStates, attempt)) {
                        pushBetLog('warn', 'broadcast_single_no_effect_retry', {
                            chip: formatMoney(chipValue),
                            attempt: attempt + 1,
                            observed: rechecked,
                        });
                        if (!(await selectChipByValue(chipValue))) return false;
                        console.warn(`[AutoTrigger] broadcast click had no effect (observed=${rechecked}); retry with alternate click profile`);
                        continue;
                    }
                    if (areObservedStatesUnchangedSafe(recheckedStates)) {
                        pushBetLog('warn', 'broadcast_single_unchanged_guard', {
                            clickSeat: clickSeatNumber,
                            seats: targets.join(','),
                            chip: formatMoney(chipValue),
                            selected: formatMoney(getEffectiveSelectedChipAmount()),
                            attempt: attempt + 1,
                            target: targetTag,
                            candidates: candidateTags,
                            probe,
                            walletBefore: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                            walletAfter: Number.isFinite(walletAfterClick?.amount) ? formatMoney(walletAfterClick.amount) : 'unknown',
                            walletRechecked: Number.isFinite(walletRechecked?.amount) ? formatMoney(walletRechecked.amount) : 'unknown',
                            expectedWalletAfter: Number.isFinite(expectedWalletBaseAmount)
                                ? formatMoney(expectedWalletBaseAmount + chipValue * targets.length)
                                : 'unknown',
                            observed: rechecked,
                        });
                        markBetClickGuard('broadcast_single_unverified_wait', {
                            clickSeat: clickSeatNumber,
                            seats: targets.join(','),
                            chip: formatMoney(chipValue),
                            selected: formatMoney(getEffectiveSelectedChipAmount()),
                            attempt: attempt + 1,
                            target: targetTag,
                            probe,
                            walletBefore: Number.isFinite(walletBaseReading?.amount) ? formatMoney(walletBaseReading.amount) : 'unknown',
                            walletRechecked: Number.isFinite(walletRechecked?.amount) ? formatMoney(walletRechecked.amount) : 'unknown',
                            expectedWalletAfter: Number.isFinite(expectedWalletBaseAmount)
                                ? formatMoney(expectedWalletBaseAmount + chipValue * targets.length)
                                : 'unknown',
                            observed: rechecked,
                        });
                        console.warn(`[AutoTrigger] broadcast click unchanged (observed=${rechecked}); guard before any retry`);
                        return false;
                    }
                    pushBetLog('error', 'broadcast_single_changed_not_verified', {
                        chip: formatMoney(chipValue),
                        observed: rechecked,
                    });
                    markBetClickGuard('broadcast_single_changed_not_verified', {
                        chip: formatMoney(chipValue),
                        observed: rechecked,
                    });
                    console.warn(`[AutoTrigger] broadcast click changed late but not safely verified (observed=${rechecked}); stop before retry`);
                    return false;
                }
                const overCap = observedStates.some(item =>
                    Number.isFinite(item.observedAmount) && item.observedAmount > maxPerSeatAmount
                );
                const unknown = observedStates.some(item => item.observedAmount === null);
                if (overCap || unknown) {
                    pushBetLog('error', overCap ? 'broadcast_single_over_cap_after_click' : 'broadcast_single_unknown_after_click', {
                        chip: formatMoney(chipValue),
                        observed,
                    });
                    markBetClickGuard(overCap ? 'broadcast_single_over_cap_after_click' : 'broadcast_single_unknown_after_click', {
                        chip: formatMoney(chipValue),
                        observed,
                    });
                    console.warn(`[AutoTrigger] chip click not safely verified (observed=${observed}); stop instead of retrying to prevent overbet`);
                    return false;
                }

                const changed = observedStates.filter(item => item.observedAmount === item.expectedAmount);
                const unchanged = observedStates.filter(item => item.observedAmount === item.baseAmount);
                if (changed.length === targets.length) {
                    clicked = true;
                    break;
                }

                if (
                    changed.length === 1 &&
                    changed[0].seatNumber === clickSeatNumber &&
                    unchanged.length === targets.length - 1
                ) {
                    console.log('[AutoTrigger] first click affected one seat only; switching to per-seat order for remaining seats');
                    for (const n of targets.filter(x => x !== clickSeatNumber)) {
                        if (!(await clickSingleSeatChipVerified(n, chipValue, maxPerSeatAmount))) return false;
                    }
                    clicked = true;
                    break;
                }

                console.warn(`[AutoTrigger] chip click did not settle into a safe pattern (observed=${observed}); stop instead of retrying to prevent overbet`);
                pushBetLog('error', 'broadcast_single_unsafe_pattern', {
                    chip: formatMoney(chipValue),
                    observed,
                });
                markBetClickGuard('broadcast_single_unsafe_pattern', {
                    chip: formatMoney(chipValue),
                    observed,
                });
                return false;
            }
            if (!clicked) {
                pushBetLog('error', 'broadcast_single_failed_verification', {
                    chip: formatMoney(chipValue),
                    step: `${i + 1}/${clickCount}`,
                    seats: targets.join(','),
                });
                markBetClickGuard('broadcast_single_failed_verification', {
                    chip: formatMoney(chipValue),
                    step: `${i + 1}/${clickCount}`,
                    seats: targets.join(','),
                });
                console.warn(`[AutoTrigger] broadcast chip=${chipValue} ${i + 1}/${clickCount} failed verification`);
                return false;
            }
        }
        return true;
    }

    // ========== DOM 진단 ==========
    function diagnosePhase() {
        if (isScriptStopped()) return Phase.STOPPED;
        if (!hasBettableSeats()) return Phase.NO_TABLE;
        if (detectAvailableChips().length === 0) return Phase.NO_CHIPS;
        if (!isAutoplayButtonReady() && !isAutoplayRunning()) return Phase.BUTTON_DOWN;
        return Phase.READY;
    }

    // ========== 베팅 설정 ==========
    async function setupBetAmount(force = false) {
        if (typeof isSettingsInputPending === 'function' && isSettingsInputPending()) return false;
        syncSettingsFromUI();
        if (isScriptStopped()) return false;
        if (isAutomationLocked()) {
            lastFailReason = 'read_only_safety_mode';
            console.warn('[AutoTrigger] read-only safety mode: bet setup blocked');
            return false;
        }
        if (isBetClickGuardActive()) {
            lastFailReason = lastBetClickGuardReason || 'bet_click_verification_guard';
            console.warn('[AutoTrigger] bet click guard active; skip setup to prevent duplicate betting');
            return false;
        }
        if (isBetSetupRunning) {
            console.warn('[AutoTrigger] bet setup already running; skip duplicate request');
            return false;
        }
        if (!force && Date.now() - lastBetSetupAt < BET_SETUP_COOLDOWN_MS) return false;

        isBetSetupRunning = true;
        let ok = false;
        let failReason = null;
        const setupSettingsKey = getBetSettingsKey();
        lastFailReason = null;
        setBetRuntimeStage('setup_start', {
            target: formatMoney(TARGET_BET_AMOUNT),
            maxSeats: getMaxSeatCount(),
        });
        pushBetLog('info', 'bet_setup_started', {
            settingsKey: setupSettingsKey,
            target: formatMoney(TARGET_BET_AMOUNT),
            maxSeats: getMaxSeatCount(),
            autoSeat: AUTO_SEAT_COUNT ? 'Y' : 'N',
        });

        try {
            if (getVisibleDecisionPanelInfo().active) {
                failReason = 'decision_panel_active_before_setup';
                console.warn('[AutoTrigger] 의사결정 패널이 열린 상태에서는 베팅 설정을 시작하지 않음');
                return false;
            }
            if (!isBettingWindowOpen()) {
                failReason = 'betting_window_closed_before_setup';
                return false;
            }
            if (!(await stopAutoplayIfRunning())) { failReason = 'stop_autoplay'; return false; }
            if (isScriptStopped()) { failReason = 'stopped'; return false; }

            const allSeats = getSetupSeatCandidates();
            const requestedSeats = getMaxSeatCount();
            const availableChips = detectAvailableChips();
            if (availableChips.length === 0) {
                failReason = 'no_chips_detected';
                console.warn('[AutoTrigger] 칩 감지 실패');
                return false;
            }

            const initialPlan = getSeatPlan(allSeats.length, availableChips);
            let targetSeatCount = initialPlan.used;
            seatLimitOverride = targetSeatCount;

            if (targetSeatCount <= 0) {
                failReason = allSeats.length <= 0 ? 'no_bettable_seats' : 'amount_too_small_for_chips';
                console.warn(allSeats.length <= 0
                    ? '[AutoTrigger] 앉을 좌석 없음'
                    : `[AutoTrigger] 총 ${formatMoney(TARGET_BET_AMOUNT)} 기준 감지칩으로 베팅 가능한 좌석/금액 없음`);
                return false;
            }
            if (AUTO_SEAT_COUNT) {
                console.log(`[AutoTrigger] auto seat plan: 최대 ${requestedSeats}, 가능 ${allSeats.length} → ${targetSeatCount}좌석`);
            } else if (targetSeatCount < requestedSeats) {
                console.warn(`[AutoTrigger] 요청 좌석 ${requestedSeats}개 중 현재 가능한 ${targetSeatCount}개로 진행`);
            }

            let targetSeatNumbers = buildTargetSeatNumbers(allSeats, targetSeatCount);
            const plannedTargetSeatNumbers = targetSeatNumbers.slice();
            if (!(await closeExtraSeatedSeats(targetSeatNumbers))) {
                failReason = 'close_extra_seats';
                return false;
            }

            // [1.17] sit fallback: 한 좌석 실패 시 다음 빈자리(1~7 순)로 자동 이동.
            //        이미 앉은 자리는 그대로 두고, 빈자리 후보군에서 차례로 시도.
            //        타인 점유로 실패한 자리는 자연스럽게 건너뛰게 됨.
            const finalSeatNumbers = [];
            const triedEmptySeats = new Set();
            let resetExistingBet = false;
            for (const n of targetSeatNumbers) {
                if (isScriptStopped()) { failReason = 'stopped'; return false; }
                if (isSettingsInputPending() || getBetSettingsKey() !== setupSettingsKey) {
                    failReason = 'settings_changed_during_bet_setup';
                    return false;
                }
                if (finalSeatNumbers.length >= targetSeatCount) break;
                const seat = getSeatByNumber(n);
                if (seat && isControlledSeatNumber(n)) {
                    // 이미 내가 앉은 자리
                    finalSeatNumbers.push(n);
                    continue;
                }
                triedEmptySeats.add(n);
                if (await sitSeatIfNeeded(n)) {
                    finalSeatNumbers.push(n);
                    continue;
                }
                // 실패 → 다음 빈자리로 fallback
                console.warn(`[AutoTrigger] seat ${n} sit 실패 → 다음 빈자리 탐색`);
                let fallbackOk = false;
                while (finalSeatNumbers.length < targetSeatCount) {
                    if (isScriptStopped()) { failReason = 'stopped'; return false; }
                    const remainingEmpty = getEmptySeatNumbers()
                        .filter(x => !triedEmptySeats.has(x) && !finalSeatNumbers.includes(x));
                    if (remainingEmpty.length === 0) break;
                    const candidate = remainingEmpty[0];
                    triedEmptySeats.add(candidate);
                    console.log(`[AutoTrigger] fallback: seat ${candidate} 시도`);
                    if (await sitSeatIfNeeded(candidate)) {
                        finalSeatNumbers.push(candidate);
                        fallbackOk = true;
                        break;
                    }
                }
                if (!fallbackOk) {
                    console.warn(`[AutoTrigger] seat ${n} fallback 실패 (남은 빈자리 없음)`);
                    // 한 자리 실패해도 나머지로 계속 진행 (좌석 수 부족은 아래에서 재계산)
                }
            }

            targetSeatNumbers = uniqueSortedSeatNumbers(finalSeatNumbers).slice(0, targetSeatCount);

            const seatedNumbers = targetSeatNumbers.filter(n => {
                return isControlledSeatNumber(n);
            });
            const trustedRememberedTargets = getTrustedRememberedSeatNumbers().filter(n => {
                if (!plannedTargetSeatNumbers.includes(n) && !targetSeatNumbers.includes(n)) return false;
                return hasLiveRememberedSeatEvidence(n);
            });
            targetSeatNumbers = uniqueSortedSeatNumbers([
                ...seatedNumbers,
                ...trustedRememberedTargets,
            ]).slice(0, targetSeatCount);
            if (targetSeatNumbers.length <= 0) {
                failReason = 'no_seated_after_sit';
                console.warn('[AutoTrigger] 앉기 시도 후에도 앉아있는 좌석 없음 (모두 타인 점유 또는 클릭 거부)');
                return false;
            }
            if (seatedNumbers.length < targetSeatNumbers.length) {
                console.warn(`[AutoTrigger] 좌석 감지 누락 가능: 검증 ${seatedNumbers.join(',') || '없음'} / 기억 유지 ${trustedRememberedTargets.join(',') || '없음'}`);
            }
            if (targetSeatNumbers.length < targetSeatCount) {
                console.warn(`[AutoTrigger] 요청 좌석 ${requestedSeats}개 중 실제/기억 좌석 ${targetSeatNumbers.length}개로 최선 진행`);
            }

            let closeVerifiedSeatNumbers = getCloseVerifiedSeatNumbers(targetSeatNumbers);
            if (closeVerifiedSeatNumbers.length < targetSeatNumbers.length) {
                await waitForCondition(() => {
                    closeVerifiedSeatNumbers = getCloseVerifiedSeatNumbers(targetSeatNumbers);
                    return closeVerifiedSeatNumbers.length === targetSeatNumbers.length;
                }, 220, VERIFY_POLL_MS);
                closeVerifiedSeatNumbers = getCloseVerifiedSeatNumbers(targetSeatNumbers);
            }
            if (closeVerifiedSeatNumbers.length <= 0) {
                failReason = 'no_close_verified_seats_before_plan';
                console.warn('[AutoTrigger] close-icon으로 확인된 실제 좌석이 없어 칩 베팅 중단');
                pushBetLog('error', 'no_close_verified_seats_before_plan', {
                    candidates: targetSeatNumbers.join(','),
                });
                return false;
            }
            if (closeVerifiedSeatNumbers.length !== targetSeatNumbers.length) {
                console.warn(`[AutoTrigger] 좌석 계획 ${targetSeatNumbers.length}개 → close-icon 실제 ${closeVerifiedSeatNumbers.length}개로 재계산`);
                pushBetLog('warn', 'seat_plan_shrunk_to_close_verified', {
                    planned: targetSeatNumbers.join(','),
                    actual: closeVerifiedSeatNumbers.join(','),
                });
                targetSeatNumbers = closeVerifiedSeatNumbers;
                seatLimitOverride = targetSeatNumbers.length;
                rememberTargetSeatNumbers(targetSeatNumbers, {
                    allowShrink: true,
                    reason: 'close_verified_before_plan',
                });
            }
            setBetRuntimeStage('seats_ready', {
                seats: targetSeatNumbers.join(','),
                count: targetSeatNumbers.length,
            });

            const initialBroadcastSeatState = getBroadcastSeatTargetState(targetSeatNumbers);
            if (!initialBroadcastSeatState.exact) {
                failReason = 'broadcast_seat_set_mismatch_before_plan';
                pushBetLog('error', 'broadcast_seat_set_mismatch_before_plan', {
                    targets: initialBroadcastSeatState.targets.join(','),
                    live: initialBroadcastSeatState.live.join(','),
                    missing: initialBroadcastSeatState.missing.join(','),
                    extra: initialBroadcastSeatState.extra.join(','),
                    unresolvedReserved: initialBroadcastSeatState.unresolvedReserved.join(','),
                });
                return false;
            }

            let plan = getSeatPlan(targetSeatNumbers.length, availableChips);
            if (plan.used > 0 && plan.used < targetSeatNumbers.length) {
                targetSeatNumbers = targetSeatNumbers.slice(0, plan.used);
                seatLimitOverride = plan.used;
                if (!(await closeExtraSeatedSeats(targetSeatNumbers))) {
                    failReason = 'close_extra_seats_after_replan';
                    return false;
                }
                plan = getSeatPlan(targetSeatNumbers.length, availableChips);
            }
            lastSeatPlan = plan;

            if (plan.used <= 0) {
                failReason = 'no_seated_after_replan';
                return false;
            }
            if (plan.chipPlan.length === 0 || plan.perSeatActual <= 0) {
                failReason = 'amount_too_small_after_replan';
                console.warn(`[AutoTrigger] 실제 좌석 ${plan.used}개 기준 좌석당 ${plan.perSeatTarget} → 칩 분배 불가`);
                return false;
            }
            const executableChipPlan = makeSelectableChipPlan(plan.chipPlan, availableChips);
            if (!executableChipPlan || getChipPlanTotal(executableChipPlan) !== plan.perSeatActual) {
                failReason = 'chip_plan_not_selectable';
                console.warn(`[AutoTrigger] 칩 조합 실행 불가: ${formatChipPlan(plan.chipPlan)} / 감지칩 ${availableChips.map(c => formatMoney(c.value)).join(', ')}`);
                return false;
            }
            plan = { ...plan, chipPlan: executableChipPlan };
            lastSeatPlan = plan;
            console.log(`[AutoTrigger] plan: 좌석 ${plan.used}/${plan.requested}, 좌석당 목표 ${formatMoney(plan.perSeatTarget)} → 실제 ${formatMoney(plan.perSeatActual)} (${formatChipPlan(plan.chipPlan)}), 총 ${formatMoney(plan.totalActual)}/${formatMoney(plan.totalTarget)}`);
            pushBetLog('info', 'plan_ready', {
                seats: targetSeatNumbers.join(','),
                used: `${plan.used}/${plan.requested}`,
                perSeat: formatMoney(plan.perSeatActual),
                total: `${formatMoney(plan.totalActual)}/${formatMoney(plan.totalTarget)}`,
                chipPlan: formatChipPlan(plan.chipPlan),
                available: availableChips.map(c => formatMoney(c.value)).join(','),
            });
            setBetRuntimeStage('plan_ready', {
                seats: targetSeatNumbers.join(','),
                perSeat: formatMoney(plan.perSeatActual),
                total: formatMoney(plan.totalActual),
                chips: formatChipPlan(plan.chipPlan),
            });

            const currentBetSummary = getTargetSeatBetSummary(targetSeatNumbers, plan);
            if (isBetSummaryMatchingPlan(currentBetSummary, plan) || isBetSummaryWalletConfirmed(currentBetSummary, plan)) {
                const existingWalletVariance = getWalletTotalBetVariance(plan);
                if (existingWalletVariance.status === 'exact') {
                    rememberTargetSeatNumbers(targetSeatNumbers, { allowShrink: true, reason: 'setup_existing_exact' });
                    updateVerifiedBetProgress(plan, targetSeatNumbers, plan.perSeatActual, { source: 'existing_exact' });
                    setBetRuntimeStage('bet_ready', {
                        wallet: formatMoney(plan.totalActual),
                        source: 'existing_exact',
                    });
                    console.log(`[AutoTrigger] existing bet already matches plan: 총 ${formatMoney(currentBetSummary.total)} / 좌석 ${targetSeatNumbers.join(',')}`);
                    pushBetLog('info', 'existing_bet_matches_plan', {
                        seats: targetSeatNumbers.join(','),
                        total: formatMoney(currentBetSummary.total),
                        perSeat: formatMoney(plan.perSeatActual),
                    });
                    ok = true;
                    return true;
                }
                pushBetLog('warn', 'existing_seat_amounts_match_wallet_mismatch', {
                    seats: targetSeatNumbers.join(','),
                    seatTotal: formatMoney(currentBetSummary.total),
                    walletStatus: existingWalletVariance.status,
                    wallet: Number.isFinite(existingWalletVariance.reading?.amount)
                        ? formatMoney(existingWalletVariance.reading.amount)
                        : 'unknown',
                });
            }
            /*
            if (currentBetSummary.total > TARGET_BET_AMOUNT) {
                console.warn(`[AutoTrigger] 현재 총 베팅 ${formatMoney(currentBetSummary.total)} > 설정 ${formatMoney(TARGET_BET_AMOUNT)} → 칩 초기화 후 재세팅`);
            }

            // 기존 베팅이 남아있으면 초기화 (덮어쓰기 시 합산되어 초과될 수 있음)
            */
            if (currentBetSummary.total > TARGET_BET_AMOUNT) {
                console.warn(`[AutoTrigger] current total bet ${formatMoney(currentBetSummary.total)} > target ${formatMoney(TARGET_BET_AMOUNT)}; reset seats before rebuilding bet`);
                pushBetLog('warn', 'current_total_over_target_reset', {
                    current: formatMoney(currentBetSummary.total),
                    target: formatMoney(TARGET_BET_AMOUNT),
                    seats: targetSeatNumbers.join(','),
                });
            }

            const resumableProgress = getResumableVerifiedBetProgress(plan, targetSeatNumbers);
            let expectedAppliedPerSeat = resumableProgress?.perSeatApplied || 0;
            let chipPlanToExecute = resumableProgress?.remainingChipPlan || plan.chipPlan;

            if (resumableProgress) {
                setBetRuntimeStage('resume_partial', {
                    wallet: formatMoney(resumableProgress.walletAmount),
                    perSeat: formatMoney(resumableProgress.perSeatApplied),
                    nextChip: formatMoney(resumableProgress.nextChip),
                });
                pushBetLog('warn', 'verified_partial_bet_resumed', {
                    seats: targetSeatNumbers.join(','),
                    wallet: formatMoney(resumableProgress.walletAmount),
                    perSeat: formatMoney(resumableProgress.perSeatApplied),
                    remaining: formatChipPlan(chipPlanToExecute),
                });
            } else {
                setBetRuntimeStage('reset_existing', {
                    seats: targetSeatNumbers.join(','),
                });
                clearVerifiedBetProgress('new_setup_from_zero');
                let walletBeforeReset = getWalletTotalBetReading();
                if (!walletBeforeReset.detected || walletBeforeReset.ambiguous || !Number.isFinite(walletBeforeReset.amount)) {
                    failReason = walletBeforeReset.ambiguous
                        ? 'wallet_total_ambiguous_before_setup'
                        : 'wallet_total_missing_before_setup';
                    pushBetLog('error', failReason, {
                        values: (walletBeforeReset.values || []).map(formatMoney).join(','),
                    });
                    return false;
                }
                let walletHasExistingBet = walletBeforeReset.amount > 0;

                for (const n of targetSeatNumbers) {
                    if (isScriptStopped()) { failReason = 'stopped'; return false; }
                    const seat = getSeatByNumber(n);
                    const existingState = getSeatBetState(seat);

                    // 좌석 close-icon은 앉음 신호다. 기존 칩은 mainbet의 베팅 닫기 버튼으로만 지운다.
                    const betCloseBtn = getSeatBetCloseButton(seat);
                    const hasBetCloseBtn = !!(betCloseBtn && isVisible(betCloseBtn));

                    if (existingState.hasChip && !existingState.amountDetected) {
                        console.warn(`[AutoTrigger] seat ${n} has visible chip but amount unknown → force close to avoid double betting`);
                        if (!(await closeSeatBet(n))) {
                            failReason = `close_seat_${n}_unknown`;
                            return false;
                        }
                        resetExistingBet = true;
                        if (!(await sitSeatIfNeeded(n))) {
                            failReason = `resit_seat_${n}_unknown`;
                            return false;
                        }
                        const walletAfterSeatReset = getWalletTotalBetReading();
                        if (isWalletReadingExactAmount(walletAfterSeatReset, 0)) walletHasExistingBet = false;
                        continue;
                    }

                    const existing = existingState.amountDetected ? existingState.amount : 0;
                    if (existing > 0 || (walletHasExistingBet && hasBetCloseBtn)) {
                        const reasonLog = existing > 0
                            ? `existing bet ${formatMoney(existing)}`
                            : 'bet close button visible (chip exists but unrecognized)';
                        console.log(`[AutoTrigger] seat ${n} ${reasonLog}; reset before applying plan`);
                        if (!(await closeSeatBet(n))) {
                            failReason = `close_seat_${n}`;
                            return false;
                        }
                        resetExistingBet = true;
                        if (!(await sitSeatIfNeeded(n))) {
                            failReason = `resit_seat_${n}`;
                            return false;
                        }
                        const walletAfterSeatReset = getWalletTotalBetReading();
                        if (isWalletReadingExactAmount(walletAfterSeatReset, 0)) walletHasExistingBet = false;
                    }
                }

                let walletAfterReset = getWalletTotalBetReading();
                const walletResetConfirmed = isWalletReadingExactAmount(walletAfterReset, 0) || await waitForCondition(() => {
                    walletAfterReset = getWalletTotalBetReading();
                    return isWalletReadingExactAmount(walletAfterReset, 0);
                }, resetExistingBet ? WALLET_RESET_VERIFY_MS : 120, VERIFY_POLL_MS);
                if (!walletResetConfirmed) {
                    failReason = 'wallet_total_not_zero_before_setup';
                    pushBetLog('warn', 'wallet_total_not_zero_before_setup', {
                        detected: walletAfterReset.detected ? 'Y' : 'N',
                        ambiguous: walletAfterReset.ambiguous ? 'Y' : 'N',
                        amount: Number.isFinite(walletAfterReset.amount)
                            ? formatMoney(walletAfterReset.amount)
                            : 'unknown',
                    });
                    console.warn('[AutoTrigger] 기존 베팅 제거 후 지갑 총액 0원 확인 대기; 새 칩 클릭 보류');
                    return false;
                }
                updateVerifiedBetProgress(plan, targetSeatNumbers, 0, { source: 'wallet_zero' });
            }

            let finalBroadcastSeatState = getBroadcastSeatTargetState(targetSeatNumbers);
            if (!finalBroadcastSeatState.exact) {
                await waitForCondition(() => {
                    finalBroadcastSeatState = getBroadcastSeatTargetState(targetSeatNumbers);
                    return finalBroadcastSeatState.exact;
                }, 220, VERIFY_POLL_MS);
                finalBroadcastSeatState = getBroadcastSeatTargetState(targetSeatNumbers);
            }
            if (!finalBroadcastSeatState.exact) {
                failReason = 'broadcast_seat_set_mismatch_before_bet';
                pushBetLog('error', 'broadcast_seat_set_mismatch_before_bet', {
                    targets: finalBroadcastSeatState.targets.join(','),
                    live: finalBroadcastSeatState.live.join(','),
                    missing: finalBroadcastSeatState.missing.join(','),
                    extra: finalBroadcastSeatState.extra.join(','),
                    unresolvedReserved: finalBroadcastSeatState.unresolvedReserved.join(','),
                });
                return false;
            }

            // 칩별 외부 루프, 좌석별 내부 루프 (칩 선택 비용 최소화)
            // Main bet chip clicks are broadcast to every seated hand, so click one representative seat only.
            const plannedPerSeatChipTotal = getChipPlanTotal(plan.chipPlan);
            const unsafeSpec = plan.chipPlan.find(spec =>
                spec.value > plan.perSeatActual ||
                spec.value * spec.count > plan.perSeatActual
            );
            if (plannedPerSeatChipTotal !== plan.perSeatActual || unsafeSpec) {
                failReason = 'unsafe_chip_plan_over_cap';
                console.warn(`[AutoTrigger] unsafe chip plan blocked: per-seat cap ${formatMoney(plan.perSeatActual)}, plan ${formatChipPlan(plan.chipPlan)}`);
                pushBetLog('error', 'unsafe_chip_plan_blocked', {
                    perSeat: formatMoney(plan.perSeatActual),
                    chipPlan: formatChipPlan(plan.chipPlan),
                    total: formatMoney(plan.totalActual),
                    target: formatMoney(plan.totalTarget),
                });
                return false;
            }
            for (const spec of chipPlanToExecute) {
                if (isScriptStopped()) { failReason = 'stopped'; return false; }
                if (getBetSettingsKey() !== setupSettingsKey) {
                    failReason = 'settings_changed_during_bet_setup';
                    return false;
                }
                setBetRuntimeStage('select_chip', {
                    chip: formatMoney(spec.value),
                    count: spec.count,
                    appliedPerSeat: formatMoney(expectedAppliedPerSeat),
                    wallet: formatMoney(expectedAppliedPerSeat * targetSeatNumbers.length),
                });
                if (!(await selectChipByValue(spec.value))) {
                    failReason = `select_chip_${spec.value}`;
                    pushBetLog('error', 'setup_select_chip_failed', {
                        chip: formatMoney(spec.value),
                        count: spec.count,
                        chipPlan: formatChipPlan(plan.chipPlan),
                    });
                    return false;
                }
                if (isSettingsInputPending() || getBetSettingsKey() !== setupSettingsKey) {
                    failReason = 'settings_changed_during_bet_setup';
                    return false;
                }
                setBetRuntimeStage('place_chip', {
                    chip: formatMoney(spec.value),
                    count: spec.count,
                    seats: targetSeatNumbers.join(','),
                    beforeWallet: formatMoney(expectedAppliedPerSeat * targetSeatNumbers.length),
                    expectedAfterWallet: formatMoney((expectedAppliedPerSeat + spec.value * spec.count) * targetSeatNumbers.length),
                });
                if (!(await clickMainBetChipBroadcastVerified(
                    targetSeatNumbers,
                    spec.value,
                    spec.count,
                    plan.perSeatActual,
                    {
                        expectedBasePerSeatAmount: expectedAppliedPerSeat,
                        expectedWalletBaseAmount: expectedAppliedPerSeat * targetSeatNumbers.length,
                        allowWalletDerivedSeatBaseline: expectedAppliedPerSeat > 0,
                    }
                ))) {
                    failReason = `broadcast_chip_${spec.value}`;
                    pushBetLog('error', 'setup_broadcast_chip_failed', {
                        chip: formatMoney(spec.value),
                        count: spec.count,
                        seats: targetSeatNumbers.join(','),
                        perSeat: formatMoney(plan.perSeatActual),
                        chipPlan: formatChipPlan(plan.chipPlan),
                    });
                    return false;
                }
                expectedAppliedPerSeat += spec.value * spec.count;
                updateVerifiedBetProgress(plan, targetSeatNumbers, expectedAppliedPerSeat, { source: 'chip_step' });
                setBetRuntimeStage('chip_step_verified', {
                    chip: formatMoney(spec.value),
                    perSeat: formatMoney(expectedAppliedPerSeat),
                    wallet: formatMoney(expectedAppliedPerSeat * targetSeatNumbers.length),
                    nextChip: verifiedBetProgress?.nextChip ? formatMoney(verifiedBetProgress.nextChip) : '완료',
                });
            }

            rememberTargetSeatNumbers(targetSeatNumbers, { allowShrink: true, reason: 'setup_final' });
            const finalBetSummary = getTargetSeatBetSummary(lastTargetSeatNumbers, plan);
            const finalWalletConfirmed = isBetSummaryWalletConfirmed(finalBetSummary, plan);
            if (finalBetSummary.total !== plan.totalActual && !finalWalletConfirmed) {
                failReason = finalBetSummary.total > plan.totalActual
                    ? 'bet_total_over_target_after_setup'
                    : 'bet_total_under_target_after_setup';
                /*
                console.warn(`[AutoTrigger] 재세팅 후 총 베팅 ${formatMoney(finalBetSummary.total)} != 계획 ${formatMoney(plan.totalActual)} → 복구 재시도`);
                */
                console.warn(`[AutoTrigger] final total bet ${formatMoney(finalBetSummary.total)} != planned ${formatMoney(plan.totalActual)}; recovery required`);
                pushBetLog('error', 'final_total_mismatch', {
                    actual: formatMoney(finalBetSummary.total),
                    planned: formatMoney(plan.totalActual),
                    seats: lastTargetSeatNumbers.join(','),
                });
                logBetMismatchSnapshot(failReason, finalBetSummary, plan, lastTargetSeatNumbers, 'setup_final');
                return false;
            }
            if (!areBetSeatsReadyForRoundAction(plan) && !finalWalletConfirmed) {
                failReason = 'bet_amount_not_detected_after_setup';
                console.warn('[AutoTrigger] 칩 베팅 후 좌석 금액 인식 실패 → 자동베팅 활성화 중단, 복구 예정');
                pushBetLog('error', 'bet_amount_not_detected_after_setup', {
                    seats: lastTargetSeatNumbers.join(','),
                    perSeat: formatMoney(plan.perSeatActual),
                    chipPlan: formatChipPlan(plan.chipPlan),
                });
                return false;
            }
            if (!verifyWalletTotalBeforeAutoplayStart(plan, 'bet_setup_final')) {
                failReason = lastFailReason || 'wallet_total_mismatch_after_setup';
                pushBetLog('error', 'bet_setup_wallet_total_not_exact', {
                    planned: formatMoney(plan.totalActual),
                    target: formatMoney(TARGET_BET_AMOUNT),
                });
                return false;
            }
            console.log(`[AutoTrigger] bet setup OK: 총 ${formatMoney(plan.totalActual)}/${formatMoney(plan.totalTarget)}`);
            pushBetLog('info', 'bet_setup_ok', {
                total: `${formatMoney(plan.totalActual)}/${formatMoney(plan.totalTarget)}`,
                seats: targetSeatNumbers.join(','),
                perSeat: formatMoney(plan.perSeatActual),
            });
            setBetRuntimeStage('bet_ready', {
                wallet: formatMoney(plan.totalActual),
                perSeat: formatMoney(plan.perSeatActual),
                seats: targetSeatNumbers.join(','),
            });
            ok = true;
            return true;
        } finally {
            isBetSetupRunning = false;
            seatLimitOverride = null;
            forcedAutoSeatCount = null;
            lastBetSetupAt = Date.now();
            if (ok) {
                betSetupCount++;
                markBetSettingsApplied();
                betSettingsDirty = false;
                lastFailReason = null;
            } else {
                betSettingsDirty = true;
                lastFailReason = failReason;
                pushBetLog('error', 'bet_setup_failed', {
                    reason: failReason || 'unknown',
                    label: getFailReasonLabel(failReason),
                    stage: betRuntimeStage,
                    verifiedWallet: verifiedBetProgress ? formatMoney(verifiedBetProgress.walletAmount) : 'none',
                    verifiedPerSeat: verifiedBetProgress ? formatMoney(verifiedBetProgress.perSeatApplied) : 'none',
                    nextChip: verifiedBetProgress?.nextChip ? formatMoney(verifiedBetProgress.nextChip) : 'none',
                });
                setBetRuntimeStage('blocked', {
                    reason: failReason || 'unknown',
                    label: getFailReasonLabel(failReason),
                }, 'error');
                console.warn('[AutoTrigger] setupBetAmount failed:', failReason);
            }
        }
    }

    // ========== 딜/보험 ==========
    function checkAndClickDealNow() {
        if (isScriptStopped()) return;
        if (isAutomationLocked()) return;
        if (isRunning || isBetSetupRunning || betSettingsDirty) return;
        if (Date.now() - lastDealClickAt < DEAL_COOLDOWN_MS) return;
        if (!areBetSeatsReadyForRoundAction()) return;
        const dealBtn = qsDeep('[data-testid="deal_now"]');
        if (!dealBtn || !isVisible(dealBtn)) return;
        console.log('[AutoTrigger] "지금 딜" → 클릭');
        robustClick(dealBtn);
        lastDealClickAt = Date.now();
        dealClickCount++;
    }

    function isInsuranceNoEnabled(el) {
        if (!el || !isVisible(el)) return false;
        if (el.getAttribute?.('data-disabled') === 'true') return false;
        if (el.getAttribute?.('aria-disabled') === 'true') return false;
        const win = el.ownerDocument?.defaultView || window;
        const style = win.getComputedStyle?.(el);
        if (style?.pointerEvents === 'none') return false;
        return !isDisabledLike(el);
    }

    function getInsuranceNoButton() {
        for (const el of qsaDeep('[data-testid="bj-decision-panel"] [data-id="no"]')) {
            if (isInsuranceNoEnabled(el)) return el;
        }
        for (const el of qsaDeep('[data-id="no"]')) {
            if (!isInsuranceNoEnabled(el)) continue;
            if (!(el.textContent || '').includes('아니오')) continue;
            return el;
        }
        return null;
    }

    function getInsuranceNoClickTarget(noBtn) {
        if (!noBtn) return null;
        const rect = noBtn.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) return noBtn;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = noBtn.ownerDocument?.elementFromPoint?.(x, y);
        if (hit && (hit === noBtn || noBtn.contains?.(hit))) return hit;
        return noBtn;
    }

    function clickInsuranceNoElement(noBtn, attempt = 0) {
        if (!noBtn || !isInsuranceNoEnabled(noBtn)) return false;
        const root = noBtn.closest?.('[data-id="no"]') || noBtn;
        const rect = root.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) return false;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const target = getInsuranceNoClickTarget(root);
        const profile = attempt === 0 ? 'mouse' : 'touch';
        return fireFullClick(target, x, y, {
            profile,
            touch: profile === 'touch',
            nativeClick: false,
        });
    }

    async function waitForInsuranceNoResolved() {
        return waitForCondition(() => !getInsuranceNoButton(), INSURANCE_CLICK_VERIFY_MS, 10);
    }

    async function checkAndClickInsuranceNo() {
        if (isScriptStopped()) return false;
        if (isAutomationLocked()) return false;
        if (insuranceClickInFlight) return false;
        if (Date.now() - lastInsuranceClickAt < INSURANCE_COOLDOWN_MS) return false;
        const noBtn = getInsuranceNoButton();
        if (!noBtn) return false;

        insuranceClickInFlight = true;
        try {
            console.log('[AutoTrigger] 인슈어런스 "아니오" decision-panel 감지 → 즉시 클릭');
            for (let attempt = 0; attempt < INSURANCE_CLICK_MAX_ATTEMPTS; attempt++) {
                const current = getInsuranceNoButton();
                if (!current) {
                    insuranceClickCount++;
                    return true;
                }
                const clickSent = clickInsuranceNoElement(current, attempt);
                if (!clickSent) continue;

                lastInsuranceClickAt = Date.now();
                pushBetLog('info', 'insurance_no_click_try', {
                    attempt: attempt + 1,
                    profile: attempt === 0 ? 'mouse' : 'touch',
                    target: getElementLabel(current),
                });
                if (await waitForInsuranceNoResolved()) {
                    insuranceClickCount++;
                    pushBetLog('info', 'insurance_no_click_confirmed', {
                        attempt: attempt + 1,
                    });
                    console.log('[AutoTrigger] 인슈어런스 "아니오" 클릭 확인 완료');
                    return true;
                }
            }

            pushBetLog('warn', 'insurance_no_click_not_confirmed', {
                attempts: INSURANCE_CLICK_MAX_ATTEMPTS,
                visible: getInsuranceNoButton() ? 'Y' : 'N',
            });
            console.warn('[AutoTrigger] 인슈어런스 "아니오" 클릭 반응 미확인 → 다음 감시 주기에 재시도');
            return false;
        } finally {
            insuranceClickInFlight = false;
        }
    }

    // ========== [1.38] "비활성 중단" 팝업 자동 해제 ==========
    // data-testid="blocking-popup-content" + "비활성 중단" 텍스트가 보이면
    // 화면 아무 곳이나 클릭해 계속 진행. 자동 베팅이 멈춰있으면 그 후
    // 메인 루프가 자동 베팅을 다시 켜는 흐름으로 자연스럽게 이어짐.
    function findBlockingPopup() {
        for (const el of qsaDeep('[data-testid="blocking-popup-content"]')) {
            if (!isVisible(el)) continue;
            const text = (el.textContent || '').replace(/\s+/g, '');
            // "비활성 중단" 또는 "아무 곳이나 클릭해 계속하기" 둘 중 하나만 있어도 매칭
            if (text.includes('비활성중단') || text.includes('아무곳이나클릭')) return el;
        }
        return null;
    }

    function findSupportReloadPopup() {
        for (const el of qsaDeep('[data-testid="blocking-popup-content"],[data-testid="popup-content"]')) {
            if (!isVisible(el)) continue;
            const text = (el.textContent || '').replace(/\s+/g, '');
            if (!text.includes('고객지원') && !text.includes('도움이필요하면')) continue;
            if (!text.includes('확인')) continue;

            const buttons = Array.from(el.querySelectorAll('button,[role="button"],[data-testid="button"]'));
            const confirmButton = buttons.find(btn =>
                isVisible(btn) &&
                !isDisabledLike(btn) &&
                ((btn.textContent || '').replace(/\s+/g, '').includes('확인'))
            );
            return { popup: el, button: confirmButton || el };
        }
        return null;
    }

    function isBlockingPopupVisible() {
        return !!findBlockingPopup();
    }

    function isSupportReloadPopupVisible() {
        return !!findSupportReloadPopup();
    }

    function markSupportPopupReloadRecovery(reason = 'support_popup_confirm') {
        supportPopupRecoveryPendingAt = Date.now();
        GM_setValue('supportPopupRecoveryPendingAt', supportPopupRecoveryPendingAt);
        lastAppliedBetSettingsKey = '';
        GM_setValue('lastAppliedBetSettingsKey', '');
        betSettingsDirty = true;
        autoBetArmed = false;
        lastBetSetupAt = 0;
        lastTriggerAt = 0;
        lastRecoveryAt = 0;
        lastFailReason = reason;
    }

    function clearSupportPopupReloadRecovery(reason = 'done') {
        if (supportPopupRecoveryPendingAt <= 0) return;
        supportPopupRecoveryPendingAt = 0;
        GM_setValue('supportPopupRecoveryPendingAt', 0);
        console.log(`[AutoTrigger] support popup recovery cleared: ${reason}`);
    }

    function dismissSupportReloadPopupIfPresent() {
        if (Date.now() - lastBlockingPopupClickAt < BLOCKING_POPUP_CLICK_COOLDOWN_MS) return false;
        const found = findSupportReloadPopup();
        if (!found) return false;

        console.log('[AutoTrigger] 고객지원 확인 팝업 감지 → 확인 클릭 후 새로고침 복구 예약');
        lastBlockingPopupClickAt = Date.now();
        markSupportPopupReloadRecovery('support_popup_confirm_pending_reload');
        robustClick(found.button);
        blockingPopupDismissCount++;
        supportPopupConfirmCount++;
        return true;
    }

    function handleSupportPopupReloadRecovery(phaseHint = null) {
        if (supportPopupRecoveryPendingAt <= 0) return false;
        const age = Date.now() - supportPopupRecoveryPendingAt;
        if (age > SUPPORT_POPUP_RECOVERY_TTL_MS) {
            clearSupportPopupReloadRecovery('expired');
            return false;
        }
        if (isScriptStopped() || isRunning || isBetSetupRunning || isAutomationLocked()) return false;

        if (isAutoplayRunning() && isBetSettingsApplied()) {
            clearSupportPopupReloadRecovery('autoplay_running');
            return false;
        }

        const phase = phaseHint || diagnosePhase();
        if (phase === Phase.NO_TABLE || phase === Phase.STOPPED) {
            lastFailReason = 'support_popup_waiting_table';
            return false;
        }

        const controlledSeats = getControlledSeatNumbers();
        if (phase === Phase.NO_CHIPS) {
            if (controlledSeats.length > 0) {
                lastFailReason = 'support_popup_waiting_chips';
                return false;
            }
            if (Date.now() - lastSupportPopupRecoveryAttemptAt >= SUPPORT_POPUP_RECOVERY_RETRY_MS) {
                lastSupportPopupRecoveryAttemptAt = Date.now();
                sitAvailableSeatsFirst('support_popup_seat_first').catch(e => console.error('[AutoTrigger] support popup seat-first error:', e));
                return true;
            }
            return false;
        }

        if (Date.now() - lastSupportPopupRecoveryAttemptAt < SUPPORT_POPUP_RECOVERY_RETRY_MS) return false;
        lastSupportPopupRecoveryAttemptAt = Date.now();
        console.log('[AutoTrigger] 새로고침 복구 → 좌석/칩 검증 후 오토100 재시작');
        betSettingsDirty = true;
        autoBetArmed = false;
        lastBetSetupAt = 0;
        lastTriggerAt = 0;
        lastAppliedBetSettingsKey = '';
        GM_setValue('lastAppliedBetSettingsKey', '');
        lastFailReason = 'support_popup_recovery_run';
        runSequence().catch(e => console.error('[AutoTrigger] support popup recovery error:', e));
        return true;
    }

    function dismissBlockingPopupIfPresent() {
        if (Date.now() - lastBlockingPopupClickAt < BLOCKING_POPUP_CLICK_COOLDOWN_MS) return false;
        const popup = findBlockingPopup();
        if (!popup) return false;

        console.log('[AutoTrigger] "비활성 중단" 팝업 감지 → 아무곳이나 클릭');
        lastBlockingPopupClickAt = Date.now();

        // 1) 팝업 자체 클릭 (가장 직접적)
        const rect = popup.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        fireFullClick(popup, cx, cy);

        // 첫 클릭으로 팝업이 닫혔다면 여기서 종료해 아래 게임 화면 오클릭을 막음.
        if (!findBlockingPopup()) {
            blockingPopupDismissCount++;
            return true;
        }

        // 2) 팝업이 여전히 보일 때만 ownerDocument body 중앙 클릭 (백업)
        const doc = popup.ownerDocument || document;
        const win = doc.defaultView || window;
        const body = doc.body || doc.documentElement;
        if (body) {
            const bodyRect = body.getBoundingClientRect();
            const bx = (bodyRect.left + bodyRect.right) / 2 || (win.innerWidth || 0) / 2;
            const by = (bodyRect.top + bodyRect.bottom) / 2 || (win.innerHeight || 0) / 2;
            fireFullClick(body, bx, by);
        }

        blockingPopupDismissCount++;
        return true;
    }

    // ========== [1.38] 자동 베팅 단독 재활성화 ==========
    // [1.39] 베팅 윈도우가 닫혀있는 라운드 중간 시점(카드 딜링/인슈어런스/결과 정산)에
    //        자동베팅이 풀려도 동작하도록 진입 조건 완화. 베팅 윈도우가 닫혀있을 때는
    //        좌석 금액 검증 자체를 스킵하고, 열려있을 때만 좌석 금액 정합성 확인.
    async function reArmAutoplayOnly() {
        if (isScriptStopped() || isRunning || isBetSetupRunning) return false;
        if (isAutomationLocked()) return false;
        if (Date.now() - lastAutoplayRearmAt < AUTOPLAY_REARM_COOLDOWN_MS) return false;
        if (isAutoplayRunning()) return false;

        // 베팅 설정 적용 자체가 안 되어 있으면 단독 재활성화 의미 없음
        if (!isBetSettingsApplied()) return false;
        if (betSettingsDirty) {
            lastFailReason = 'bet_settings_dirty_before_rearm';
            pushBetLog('warn', 'rearm_blocked_bet_settings_dirty', {});
            return false;
        }
        if (!isAutoplayButtonReady()) return false;

        // 베팅 윈도우가 열려있을 때만 좌석 금액 정합성 검사.
        // 닫혀있으면 (카드 딜링/결과 정산 중) 좌석 금액 인식이 원래 불가능하므로 스킵.
        if (isBettingWindowOpen() && !areBetSeatsReadyForRoundAction()) return false;
        if (!verifyAutoplayStartSafety(getExpectedBetPlan(), 'rearm')) return false;

        isRunning = true;
        let succeeded = false;
        let menuOpened = false;
        // [1.40] 일단 짧은 cooldown만 잡아서 다음 사이클 재진입을 막고,
        //        메뉴가 실제로 열린 시점에 정식 cooldown으로 갱신.
        //        이렇게 하면 메뉴 열기 자체가 실패해도 다음 사이클에서 빠르게 재시도 가능.
        const provisionalCooldownAt = Date.now() - (AUTOPLAY_REARM_COOLDOWN_MS - 400);
        lastAutoplayRearmAt = provisionalCooldownAt;
        try {
            const autoplayBtn = getAutoplayButton();
            if (!autoplayBtn) {
                console.warn('[AutoTrigger] re-arm: autoplay button missing');
                return false;
            }
            console.log('[AutoTrigger] 자동 베팅 단독 꺼짐 감지 → 베팅 유지하고 자동 베팅만 재활성화');
            pushBetLog('info', 'rearm_autoplay_button_click', {
                target: getElementLabel(autoplayBtn),
            });
            robustClick(autoplayBtn);
            await sleep(70);
            if (isScriptStopped()) return false;

            const startSelector = `[data-testid="autoplay-start-button-${AUTOPLAY_START_ROUNDS}"]`;
            let startBtn = null;
            await waitForCondition(() => {
                startBtn = getClickableByMarker(startSelector);
                return !!startBtn;
            }, AUTOPLAY_MENU_WAIT_MS, 30);

            if (!startBtn) {
                console.warn(`[AutoTrigger] re-arm: ${AUTOPLAY_START_ROUNDS} rounds start button not found`);
                pushBetLog('error', 'rearm_start_button_missing', {
                    selector: startSelector,
                });
                return false;
            }

            // 메뉴가 열린 시점에 정식 cooldown 적용 (이후 동일 cooldown 안에 재시도 차단)
            menuOpened = true;
            lastAutoplayRearmAt = Date.now();

            if (!verifyAutoplayStartSafety(getExpectedBetPlan(), 'rearm_start_click')) {
                if (typeof closeAutoplayDialogIfOpen === 'function') closeAutoplayDialogIfOpen();
                return false;
            }

            pushBetLog('info', 'rearm_start_click', {
                rounds: AUTOPLAY_START_ROUNDS,
                target: getElementLabel(startBtn),
            });
            robustClick(startBtn);
            autoplayStartCount++;
            autoplayRearmCount++;
            console.log(`[AutoTrigger] re-arm: autoplay ${AUTOPLAY_START_ROUNDS} rounds clicked`);

            const countDetected = await waitForCondition(() => observeAutoplayRoundNumber() !== null, AUTOBET_COUNT_VERIFY_MS, 30);
            if (!countDetected) {
                console.warn('[AutoTrigger] re-arm: round count not detected after click');
                pushBetLog('error', 'rearm_count_missing_after_start', {
                    rounds: AUTOPLAY_START_ROUNDS,
                });
                return false;
            }

            await sleep(40);
            // 메뉴 닫기 (있을 경우)
            if (typeof closeAutoplayDialogIfOpen === 'function') closeAutoplayDialogIfOpen();

            succeeded = true;
            lastFailReason = null;
            return true;
        } catch (e) {
            console.error('[AutoTrigger] re-arm error:', e);
            return false;
        } finally {
            isRunning = false;
            if (succeeded) {
                lastTriggerAt = Date.now();
            } else if (!menuOpened) {
                // [1.40] 메뉴 자체가 안 열렸으면 cooldown을 short(=600ms)로 적용해서
                //        다음 사이클이 빠르게 재시도하게 함.
                lastAutoplayRearmAt = Date.now() - (AUTOPLAY_REARM_COOLDOWN_MS - 600);
            }
        }
    }

    function shouldRestartAutoplayForThreshold(roundNumber, activeSeatNumbers = getRememberedBetSeatNumbers()) {
        if (!Number.isFinite(roundNumber) || roundNumber < 0) return false;
        if (THRESHOLD <= 0 || roundNumber >= THRESHOLD) return false;
        if (Date.now() - lastAutoplayThresholdRestartAt < AUTOPLAY_THRESHOLD_RESTART_COOLDOWN_MS) return false;
        if (!isBetSettingsApplied() || betSettingsDirty) return false;
        if (activeSeatNumbers.length <= 0) return false;

        // 실행 중 보충은 정확한 +10 control 버튼만 누른다. 현재 라운드의
        // 더블/스플릿 금액이나 잠시 숨겨진 좌석 금액은 보충과 무관하다.
        if (isAutoplayRunning()) return !!getAutoplayModifyButton() || isAutoplayButtonReady();

        if (isBettingWindowOpen() && !areBetSeatsReadyForRoundAction()) return false;
        const safety = getWalletTotalBetVariance(getExpectedBetPlan());
        if (getVisibleDecisionPanelInfo().active || safety.status === 'increased' || safety.status === 'ambiguous') return false;
        return isAutoplayButtonReady();
    }

    async function restartAutoplayForThreshold(currentRoundNumber) {
        if (isScriptStopped() || isRunning || isBetSetupRunning) return false;
        if (isAutomationLocked()) return false;
        if (!shouldRestartAutoplayForThreshold(currentRoundNumber)) return false;

        isRunning = true;
        let succeeded = false;
        lastAutoplayThresholdRestartAt = Date.now();
        try {
            console.log(`[AutoTrigger] 기준미만 ${currentRoundNumber}/${THRESHOLD} 감지 → 베팅 유지 후 자동베팅 ${AUTOPLAY_START_ROUNDS}회 보충`);

            if (isAutoplayRunning()) {
                if (!(await topUpAutoplayRoundsByModify(currentRoundNumber))) {
                    lastFailReason = lastFailReason || 'threshold_modify_failed';
                    return false;
                }
                autoplayThresholdRestartCount++;
                autoBetArmed = true;
                betSettingsDirty = false;
                lastFailReason = null;
                succeeded = true;
                console.log(`[AutoTrigger] 기준미만 보충: autoplay modify(+10) 버튼 클릭 완료`);
                return true;
            }
            if (isScriptStopped()) return false;

            const autoplayBtn = getAutoplayButton();
            if (!autoplayBtn || !isVisible(autoplayBtn) || isDisabledLike(autoplayBtn)) {
                lastFailReason = 'threshold_autoplay_btn_not_ready';
                console.warn('[AutoTrigger] 기준미만 재시작: autoplay 버튼 준비 안 됨');
                pushBetLog('error', 'threshold_autoplay_button_not_ready', {});
                return false;
            }
            if (!verifyAutoplayStartSafety(getExpectedBetPlan(), 'threshold_restart')) return false;

            pushBetLog('info', 'threshold_autoplay_button_click', {
                current: currentRoundNumber,
                threshold: THRESHOLD,
                target: getElementLabel(autoplayBtn),
            });
            robustClick(autoplayBtn);
            await sleep(70);
            if (isScriptStopped()) return false;

            const startSelector = `[data-testid="autoplay-start-button-${AUTOPLAY_START_ROUNDS}"]`;
            let startBtn = null;
            await waitForCondition(() => {
                startBtn = getClickableByMarker(startSelector);
                return !!startBtn;
            }, AUTOPLAY_MENU_WAIT_MS, 30);

            if (!startBtn) {
                closeAutoplayDialogIfOpen();
                lastFailReason = 'threshold_start_btn_missing';
                console.warn(`[AutoTrigger] 기준미만 재시작: ${AUTOPLAY_START_ROUNDS}회 시작 버튼 없음`);
                pushBetLog('error', 'threshold_start_button_missing', {
                    selector: startSelector,
                });
                return false;
            }

            if (!verifyAutoplayStartSafety(getExpectedBetPlan(), 'threshold_start_click')) {
                closeAutoplayDialogIfOpen();
                return false;
            }

            pushBetLog('info', 'threshold_start_click', {
                rounds: AUTOPLAY_START_ROUNDS,
                target: getElementLabel(startBtn),
            });
            robustClick(startBtn);
            autoplayStartCount++;
            autoplayThresholdRestartCount++;
            autoBetArmed = true;
            console.log(`[AutoTrigger] 기준미만 재시작: autoplay ${AUTOPLAY_START_ROUNDS} rounds clicked`);

            const countDetected = await waitForCondition(() => observeAutoplayRoundNumber() !== null, AUTOBET_COUNT_VERIFY_MS, 30);
            if (!countDetected) {
                pushBetLog('error', 'threshold_count_missing_after_start', {
                    rounds: AUTOPLAY_START_ROUNDS,
                });
                markBetStateNeedsRecovery('autoplay_count_missing_after_start');
                return false;
            }

            await sleep(40);
            closeAutoplayDialogIfOpen();

            succeeded = true;
            betSettingsDirty = false;
            lastFailReason = null;
            return true;
        } catch (e) {
            console.error('[AutoTrigger] threshold restart error:', e);
            lastFailReason = 'threshold_restart_exception';
            return false;
        } finally {
            isRunning = false;
            if (succeeded) lastTriggerAt = Date.now();
        }
    }

    // ========== 메인 시퀀스 ==========
    async function runSequence() {
        if (typeof isSettingsInputPending === 'function' && isSettingsInputPending()) return;
        syncSettingsFromUI();
        if (isScriptStopped() || isRunning) return;
        if (isAutomationLocked()) {
            lastFailReason = 'read_only_safety_mode';
            console.warn('[AutoTrigger] read-only safety mode: automation sequence blocked');
            return;
        }
        if (isBetClickGuardActive()) {
            lastFailReason = lastBetClickGuardReason || 'bet_click_verification_guard';
            return;
        }
        isRunning = true;
        let succeeded = false;
        setBetRuntimeStage('sequence_start', {
            settingsKey: getBetSettingsKey(),
        });
        try {
            const currentRoundNumber = observeAutoplayRoundNumber();
            const controlledSeats = getControlledSeatNumbers();
            if (controlledSeats.length > 0) {
                rememberTargetSeatNumbers(controlledSeats.slice(0, getPlannedSeatLimit()), { reason: 'sequence_controlled_detected' });
            }
            const trackedSeatNumbers = getRememberedBetSeatNumbers(getPlannedSeatLimit());
            const activeSeatNumbers = trackedSeatNumbers.length > 0 ? trackedSeatNumbers : controlledSeats;
            let expectedPlan = getExpectedBetPlan();
            let readyForRound = areBetSeatsReadyForRoundAction(expectedPlan);
            const currentBetSummary = getTargetSeatBetSummary(activeSeatNumbers, expectedPlan);
            const walletConfirmed = isBetSummaryWalletConfirmed(currentBetSummary, expectedPlan);
            if (walletConfirmed) readyForRound = true;
            if (isBettingWindowOpen() && currentBetSummary.ambiguousCount > 0 && !walletConfirmed) {
                const recovery = getUnknownBetWalletRecovery(currentBetSummary, expectedPlan);
                if (!recovery.recoverable) {
                    lastFailReason = 'bet_amount_unknown_current';
                    logBetMismatchSnapshot(lastFailReason, currentBetSummary, expectedPlan, activeSeatNumbers, 'sequence_unknown');
                    setBetRuntimeStage('blocked', {
                        reason: lastFailReason,
                        label: getFailReasonLabel(lastFailReason),
                    }, 'warn');
                    console.warn('[AutoTrigger] visible chip exists but amount is unknown; recovery paused to avoid double betting');
                    return;
                }
                console.warn(`[AutoTrigger] 좌석 금액 미인식 + 지갑 상태 ${recovery.variance.status} ${formatMoney(recovery.variance.reading.amount)}/${formatMoney(recovery.variance.expected)} → 베팅 초기화 후 복구`);
                markBetStateNeedsRecovery(recovery.reason);
                readyForRound = false;
            }
            if (readyForRound && !isBetSettingsApplied()) {
                markBetSettingsApplied();
            }
            const betMismatch = isTargetBetTotalMismatch(activeSeatNumbers, expectedPlan);
            const betNeedsSetup = isBettingWindowOpen() && !readyForRound;
            const shouldSetupBet =
                (!isAutoplayButtonReady() && !readyForRound) ||
                (!isBetSettingsApplied() && !readyForRound) ||
                betNeedsSetup ||
                (betSettingsDirty && !readyForRound && (currentRoundNumber === null || !!lastFailReason || betMismatch));

            if (shouldSetupBet) {
                if (!(await stopAutoplayIfRunning())) return;
                if (isScriptStopped()) return;
                const setupOk = await setupBetAmount(betSettingsDirty || !isBetSettingsApplied());
                if (!setupOk) return;
                expectedPlan = getExpectedBetPlan();
                readyForRound = areBetSeatsReadyForRoundAction(expectedPlan);
                await sleep(25);
                if (isScriptStopped()) return;
                if (!readyForRound) {
                    lastFailReason = 'bet_not_ready_after_setup';
                    pushBetLog('error', 'bet_not_ready_after_setup', {
                        planned: formatMoney(expectedPlan.totalActual),
                        seats: getRememberedBetSeatNumbers(expectedPlan.used).join(','),
                    });
                    logBetMismatchSnapshot(
                        lastFailReason,
                        getTargetSeatBetSummary(getRememberedBetSeatNumbers(expectedPlan.used), expectedPlan),
                        expectedPlan,
                        getRememberedBetSeatNumbers(expectedPlan.used),
                        'sequence_after_setup'
                    );
                    return;
                }
            } else if (readyForRound && betSettingsDirty && isBetSettingsApplied() && !betMismatch) {
                console.log('[AutoTrigger] 자동베팅 횟수 인식만 지연됨: 칩 재세팅 없이 기존 베팅 상태 유지');
                betSettingsDirty = false;
                lastFailReason = null;
            }

            await waitForCondition(() => isAutoplayButtonReady(), AUTOPLAY_BUTTON_READY_WAIT_MS, 30);
            const autoplayBtn = getAutoplayButton();
            if (!autoplayBtn) {
                console.warn('[AutoTrigger] autoplay-button not found');
                lastFailReason = 'autoplay_btn_missing';
                return;
            }
            if (!isAutoplayButtonReady()) {
                console.warn('[AutoTrigger] autoplay-button not ready');
                lastFailReason = 'autoplay_btn_not_ready';
                return;
            }
            if (!verifyAutoplayStartSafety(expectedPlan, 'sequence')) {
                return;
            }

            setBetRuntimeStage('autoplay_open', {
                wallet: formatMoney(expectedPlan.totalActual),
                seats: getRememberedBetSeatNumbers(expectedPlan.used).join(','),
            });
            pushBetLog('info', 'autoplay_button_click', {
                target: getElementLabel(autoplayBtn),
                readyForRound,
                applied: isBetSettingsApplied() ? 'Y' : 'N',
            });
            robustClick(autoplayBtn);
            await sleep(55);
            if (isScriptStopped()) return;

            let clicked = false;
            const startSelector = `[data-testid="autoplay-start-button-${AUTOPLAY_START_ROUNDS}"]`;
            let startBtn = null;
            await waitForCondition(() => {
                startBtn = getClickableByMarker(startSelector);
                return !!startBtn;
            }, AUTOPLAY_MENU_WAIT_MS, 25);
            if (startBtn) {
                const startSafetyPlan = getExpectedBetPlan();
                if (!verifyAutoplayStartSafety(startSafetyPlan, 'sequence_start_click')) {
                    if (typeof closeAutoplayDialogIfOpen === 'function') closeAutoplayDialogIfOpen();
                    return;
                }
                setBetRuntimeStage('autoplay_start', {
                    rounds: AUTOPLAY_START_ROUNDS,
                });
                pushBetLog('info', 'autoplay_start_click', {
                    rounds: AUTOPLAY_START_ROUNDS,
                    target: getElementLabel(startBtn),
                });
                robustClick(startBtn);
                autoplayStartCount++;
                clicked = true;
                console.log(`[AutoTrigger] autoplay ${AUTOPLAY_START_ROUNDS} rounds clicked`);
                const countDetected = await waitForCondition(() => observeAutoplayRoundNumber() !== null, AUTOBET_COUNT_VERIFY_MS, 30);
                if (!countDetected) {
                    pushBetLog('error', 'autoplay_count_missing_after_start', {
                        rounds: AUTOPLAY_START_ROUNDS,
                    });
                    markBetStateNeedsRecovery('autoplay_count_missing_after_start');
                    return;
                }
                pushBetLog('info', 'autoplay_count_detected', {
                    round: observeAutoplayRoundNumber(),
                });
                setBetRuntimeStage('running', {
                    round: observeAutoplayRoundNumber(),
                    threshold: THRESHOLD,
                });
            } else {
                console.warn(`[AutoTrigger] ${AUTOPLAY_START_ROUNDS} rounds start button not found`);
                pushBetLog('error', 'autoplay_start_button_missing', {
                    selector: startSelector,
                });
                markBetStateNeedsRecovery('start_btn_missing');
                return;
            }

            await sleep(45);

            if (typeof closeAutoplayDialogIfOpen === 'function' && !closeAutoplayDialogIfOpen()) {
                console.warn('[AutoTrigger] close button not found');
            }

            if (clicked) {
                succeeded = true;
                lastFailReason = null;
            }
        } catch (e) {
            console.error('[AutoTrigger] error:', e);
            lastFailReason = 'exception';
            betSettingsDirty = true;
            setBetRuntimeStage('blocked', {
                reason: 'exception',
                message: e?.message || String(e),
            }, 'error');
        } finally {
            isRunning = false;
            if (succeeded) {
                lastTriggerAt = Date.now();
                clearSupportPopupReloadRecovery('sequence_success');
            }
        }
    }

    setInterval(() => {
        handleImmediateSeatOpportunities('fast');
    }, FAST_SEAT_CHECK_INTERVAL_MS);

    setInterval(() => {
        checkAndClickInsuranceNo().catch(e => console.error('[AutoTrigger] insurance watcher error:', e));
    }, INSURANCE_WATCH_INTERVAL_MS);

    // ========== 감시 루프 ==========
    setInterval(() => {
        const settingsInputPending = isSettingsInputPending();
        if (!settingsInputPending) syncSettingsFromUI();

        if (!isAutomationLocked() && isSupportReloadPopupVisible()) {
            dismissSupportReloadPopupIfPresent();
            return;
        }

        // [1.38] "비활성 중단" 팝업은 다른 어떤 작업보다 우선 — 화면이 막혀있으면
        //        클릭/감지 자체가 안 되므로 SCRIPT_ENABLED 여부와 무관하게 우선 해제.
        //        단, isAutomationLocked() 인 경우는 모든 클릭이 차단되므로 의미 없음.
        if (!isAutomationLocked() && isBlockingPopupVisible()) {
            dismissBlockingPopupIfPresent();
            return;
        }

        if (closeIdleAutoplayBottomSheetIfStale()) return;
        if (settingsInputPending) return;

        const phase = diagnosePhase();
        lastDiagnosedPhase = phase;
        if (phase === Phase.STOPPED) return;

        if (isRunning || isBetSetupRunning) return;
        if (isAutomationLocked()) {
            lastFailReason = 'read_only_safety_mode';
            return;
        }
        if (isBetClickGuardActive()) {
            lastFailReason = lastBetClickGuardReason || 'bet_click_verification_guard';
            return;
        }

        if (handleSupportPopupReloadRecovery(phase)) return;

        if (handleImmediateSeatOpportunities('main', phase)) return;

        // [1.39] 자동 베팅 단독 꺼짐 FAST PATH — phase 분기보다 먼저.
        //        한 번이라도 자동베팅이 시작된 적 있고(autoBetArmed), 라운드 카운트가 사라졌고,
        //        베팅 설정이 적용 상태이며, 자동베팅 버튼이 클릭 가능하면 cooldown 검사 후 즉시 재활성화.
        //        실패/cooldown 안인 경우는 그대로 fallthrough → 기존 흐름이 처리.
        if (
            !isAutoplayRunning() &&
            getRoundNumber() === null &&
            isBetSettingsApplied() &&
            autoBetArmed &&
            isAutoplayButtonReady() &&
            Date.now() - lastAutoplayRearmAt >= AUTOPLAY_REARM_COOLDOWN_MS
        ) {
            console.log('[AutoTrigger] fast path: 자동베팅 단독 꺼짐 감지 → 즉시 재활성화 시도');
            reArmAutoplayOnly().catch(e => console.error('[AutoTrigger] re-arm chain error:', e));
            return;
        }

        const roundNumber = observeAutoplayRoundNumber();
        const controlledSeats = getControlledSeatNumbers();
        if (controlledSeats.length > 0) {
            rememberTargetSeatNumbers(controlledSeats.slice(0, getPlannedSeatLimit()), { reason: 'controlled_detected' });
        }
        const trackedSeatNumbers = getRememberedBetSeatNumbers(getPlannedSeatLimit());
        const activeSeatNumbers = trackedSeatNumbers.length > 0 ? trackedSeatNumbers : controlledSeats;
        const expectedPlan = getExpectedBetPlan();
        const betSummary = getTargetSeatBetSummary(activeSeatNumbers, expectedPlan);
        const walletConfirmed = isBetSummaryWalletConfirmed(betSummary, expectedPlan);
        if (isBettingWindowOpen() && betSummary.ambiguousCount > 0 && !walletConfirmed) {
            const recovery = getUnknownBetWalletRecovery(betSummary, expectedPlan);
            if (recovery.recoverable) {
                logBetMismatchSnapshot(recovery.reason, betSummary, expectedPlan, activeSeatNumbers, 'watcher_unknown');
                console.warn(`[AutoTrigger] 좌석 금액 미인식 + 지갑 상태 ${recovery.variance.status} ${formatMoney(recovery.variance.reading.amount)}/${formatMoney(recovery.variance.expected)} → 재설정`);
                if (markBetStateNeedsRecovery(recovery.reason)) runSequence();
                return;
            }
            if (lastFailReason !== 'bet_amount_unknown_current') {
                console.warn('[AutoTrigger] visible chip exists but amount is unknown; wait instead of adding more chips');
            }
            lastFailReason = 'bet_amount_unknown_current';
            logBetMismatchSnapshot(lastFailReason, betSummary, expectedPlan, activeSeatNumbers, 'watcher_unknown_paused');
            setBetRuntimeStage('blocked', {
                reason: lastFailReason,
                label: getFailReasonLabel(lastFailReason),
            }, 'warn');
            return;
        }
        if (isTargetBetTotalMismatch(activeSeatNumbers, expectedPlan)) {
            const expectedTotal = expectedPlan.totalActual;
            const reason = betSummary.total > expectedTotal ? 'bet_total_over_target' : 'bet_total_mismatch';
            logBetMismatchSnapshot(reason, betSummary, expectedPlan, activeSeatNumbers, 'watcher_total');
            console.warn(`[AutoTrigger] 현재 총 베팅 ${formatMoney(betSummary.total)} != 기대 ${formatMoney(expectedTotal)} → 복구`);
            if (markBetStateNeedsRecovery(reason)) runSequence();
            return;
        }

        if (isBetSettingsApplied() && activeSeatNumbers.length > 0 && isBettingWindowOpen() && !walletConfirmed && !areBetSeatsReadyForRoundAction(expectedPlan)) {
            logBetMismatchSnapshot('bet_amount_not_detected_current', betSummary, expectedPlan, activeSeatNumbers, 'watcher_ready');
            console.warn('[AutoTrigger] betting window open but controlled seats have no valid chips; recovery required');
            if (markBetStateNeedsRecovery('bet_amount_not_detected_current')) runSequence();
            return;
        }

        if (shouldRestartAutoplayForThreshold(roundNumber, activeSeatNumbers)) {
            restartAutoplayForThreshold(roundNumber).catch(e => console.error('[AutoTrigger] threshold restart chain error:', e));
            return;
        }

        checkAndClickDealNow();
        checkAndClickInsuranceNo().catch(e => console.error('[AutoTrigger] insurance check error:', e));

        if (Date.now() - lastTriggerAt < COOLDOWN_MS) return;

        switch (phase) {
            case Phase.NO_TABLE:
                return;
            case Phase.NO_CHIPS:
                if (activeSeatNumbers.length > 0) {
                    lastFailReason = 'chips_missing_seated_waiting';
                    return;
                }
                if (roundNumber === null) markBetStateNeedsRecovery('chips_missing');
                return;
            case Phase.BUTTON_DOWN: {
                if (!hasBettableSeats()) return;
                console.log('[AutoTrigger] phase=BUTTON_DOWN → 시퀀스');
                runSequence();
                return;
            }
            case Phase.READY: {
                if (roundNumber === null) {
                    // [1.39] fast path는 메인 루프 상단에서 처리됨. 여기까지 온 경우는
                    //        cooldown 안이거나 autoBetArmed=false거나 isBetSettingsApplied=false 상태.
                    //        grace 후 fallback recovery.
                    if (autoBetArmed && Date.now() - lastRoundCountSeenAt < AUTOBET_COUNT_MISSING_GRACE_MS) return;
                    if (markBetStateNeedsRecovery('autoplay_count_missing')) runSequence();
                    return;
                }
                if (!isBetSettingsApplied() || betSettingsDirty) {
                    console.log(`[AutoTrigger] phase=READY, dirty=${betSettingsDirty}, round=${roundNumber} → 시퀀스`);
                    runSequence();
                }
                return;
            }
        }
    }, CHECK_INTERVAL_MS);

    // ========== 드래그 ==========
    function makeDraggable(panel, handle) {
        let dragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;
        const savedPos = GM_getValue('panelPos', null);
        if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
            const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
            const left = Math.min(Math.max(0, savedPos.left), maxLeft);
            const top = Math.min(Math.max(0, savedPos.top), maxTop);
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        }
        const onDown = (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'button' || tag === 'select') return;
            dragging = true;
            const evt = e.touches ? e.touches[0] : e;
            startX = evt.clientX;
            startY = evt.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.left = startLeft + 'px';
            panel.style.top = startTop + 'px';
            panel.style.right = 'auto';
            handle.style.cursor = 'grabbing';
            e.preventDefault();
        };
        const onMove = (e) => {
            if (!dragging) return;
            const evt = e.touches ? e.touches[0] : e;
            const dx = evt.clientX - startX;
            const dy = evt.clientY - startY;
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;
            const maxLeft = window.innerWidth - panel.offsetWidth;
            const maxTop = window.innerHeight - panel.offsetHeight;
            newLeft = Math.min(Math.max(0, newLeft), Math.max(0, maxLeft));
            newTop = Math.min(Math.max(0, newTop), Math.max(0, maxTop));
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            handle.style.cursor = 'grab';
            const rect = panel.getBoundingClientRect();
            GM_setValue('panelPos', { left: rect.left, top: rect.top });
        };
        handle.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        handle.addEventListener('touchstart', onDown, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }

    // ========== UI ==========
    function createUI() {
        if (document.getElementById('at-panel')) return;

        if (!document.getElementById('at-panel-style')) {
            const style = document.createElement('style');
            style.id = 'at-panel-style';
            style.textContent = `
                #at-panel, #at-panel * { box-sizing: border-box; letter-spacing: 0; }
                #at-panel {
                    position: fixed; top: 10px; right: 10px; z-index: 2147483647;
                    width: 430px; max-width: calc(100vw - 20px); max-height: calc(100vh - 20px);
                    overflow: hidden; color: #f3f5f7; background: rgba(18, 20, 23, 0.96);
                    border: 1px solid #3c4249; border-radius: 6px;
                    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.48);
                    font-family: Arial, "Malgun Gothic", sans-serif; font-size: 12px; line-height: 1.42;
                }
                #at-header {
                    min-height: 52px; padding: 9px 10px; cursor: grab;
                    display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    background: #20242a; border-bottom: 1px solid #3c4249;
                }
                #at-header:active { cursor: grabbing; }
                .at-brand { min-width: 0; }
                .at-title-line { display: flex; align-items: center; gap: 7px; min-width: 0; }
                .at-title { font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; }
                .at-version {
                    display: inline-flex; align-items: center; min-height: 20px; padding: 2px 6px;
                    border: 1px solid #3f8f68; border-radius: 4px; color: #b9f1cf; background: #173225;
                    font-size: 11px; font-weight: 700; white-space: nowrap;
                }
                .at-source { margin-top: 2px; color: #aeb5bd; font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                #at-toggle {
                    flex: 0 0 auto; min-width: 46px; height: 28px; border: 1px solid #555d66;
                    border-radius: 4px; color: #e6e9ec; background: #2d3238; font-size: 11px; cursor: pointer;
                }
                #at-body { max-height: calc(100vh - 74px); overflow: auto; scrollbar-width: thin; }
                .at-section { padding: 10px; border-bottom: 1px solid #343941; }
                .at-section:last-child { border-bottom: 0; }
                .at-section-title { margin: 0 0 7px; color: #cbd1d7; font-size: 10.5px; font-weight: 700; text-transform: uppercase; }
                .at-settings { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .at-field { display: grid; gap: 4px; min-width: 0; }
                .at-field label { color: #cbd1d7; font-size: 11px; }
                .at-field input[type="number"] {
                    width: 100%; height: 31px; padding: 4px 7px; border: 1px solid #59616a;
                    border-radius: 4px; outline: 0; color: #111315; background: #f5f6f7; font-size: 12px;
                }
                .at-field input[type="number"]:focus { border-color: #e4b84b; box-shadow: 0 0 0 2px rgba(228, 184, 75, 0.2); }
                .at-check {
                    height: 31px; padding: 0 8px; display: flex; align-items: center; gap: 7px;
                    border: 1px solid #515861; border-radius: 4px; color: #eef1f3; background: #272c32;
                }
                .at-check input { width: 16px; height: 16px; margin: 0; accent-color: #2da56b; }
                .at-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 9px; }
                .at-button {
                    min-width: 0; min-height: 31px; padding: 5px 7px; border: 1px solid #5a626c;
                    border-radius: 4px; color: #f4f6f7; background: #30363d; font-size: 11px; cursor: pointer;
                    white-space: normal; overflow-wrap: anywhere;
                }
                .at-button:hover { background: #3a4149; }
                .at-button.at-primary { border-color: #3d9767; background: #216743; }
                .at-button.at-primary:hover { background: #287a50; }
                .at-button.at-danger { border-color: #b85c60; background: #71373a; }
                .at-live-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
                .at-state-badge {
                    flex: 0 0 auto; min-width: 48px; padding: 3px 6px; border-radius: 4px;
                    text-align: center; color: #dfe3e7; background: #555d66; font-size: 10.5px; font-weight: 700;
                }
                .at-state-badge[data-tone="ok"] { color: #c8f5d8; background: #246444; }
                .at-state-badge[data-tone="work"] { color: #fff0bd; background: #765c1d; }
                .at-state-badge[data-tone="error"] { color: #ffd6d7; background: #7d373b; }
                .at-stage { min-width: 0; color: #ffffff; font-size: 13px; overflow-wrap: anywhere; }
                .at-failure {
                    display: none; margin-top: 7px; padding: 7px 8px; border-left: 3px solid #d7686d;
                    color: #ffd5d7; background: #3b2427; overflow-wrap: anywhere; user-select: text;
                }
                .at-failure.is-visible { display: block; }
                .at-failure-code { display: block; margin-top: 2px; color: #dfaeb0; font: 10px Consolas, monospace; }
                .at-progress-wrap { margin-top: 9px; }
                .at-progress-label { display: flex; justify-content: space-between; gap: 8px; color: #c8ced4; font-size: 10.5px; }
                .at-progress-track { height: 7px; margin-top: 4px; overflow: hidden; border-radius: 3px; background: #3a4047; }
                .at-progress-fill { width: 0; height: 100%; background: #d2a83e; transition: width 120ms linear; }
                .at-progress-fill.is-exact { background: #39a970; }
                .at-progress-fill.is-over { background: #d35f64; }
                .at-kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 12px; margin-top: 9px; }
                .at-kv { min-width: 0; }
                .at-kv-label { color: #929aa3; font-size: 10px; }
                .at-kv-value { margin-top: 1px; color: #f4f6f7; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
                .at-plan-line { color: #e9ecef; overflow-wrap: anywhere; }
                .at-plan-line + .at-plan-line { margin-top: 4px; }
                .at-muted { color: #9ca4ac; }
                .at-details { padding: 0; border-bottom: 1px solid #343941; }
                .at-details summary { padding: 9px 10px; color: #d7dce1; cursor: pointer; font-weight: 700; }
                .at-details-content { padding: 0 10px 10px; color: #bbc2c9; user-select: text; }
                .at-detail-row { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 8px; padding: 2px 0; }
                .at-detail-label { color: #858e98; }
                .at-detail-value { color: #dce0e4; overflow-wrap: anywhere; }
                .at-log-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
                .at-log-head .at-section-title { margin: 0; }
                .at-log-count { color: #929aa3; font-size: 10px; }
                #at-log-list { max-height: 168px; overflow: auto; padding-right: 3px; user-select: text; }
                .at-log-row { padding: 5px 0; border-top: 1px solid #30353b; }
                .at-log-row:first-child { border-top: 0; padding-top: 0; }
                .at-log-line { display: grid; grid-template-columns: 7px 84px 66px minmax(0, 1fr); gap: 4px; align-items: start; }
                .at-log-dot { width: 6px; height: 6px; margin-top: 4px; border-radius: 50%; background: #64a8c9; }
                .at-log-warn .at-log-dot { background: #e0b84f; }
                .at-log-error .at-log-dot { background: #df6d72; }
                .at-log-time, .at-log-stage { color: #89929b; font: 9.5px Consolas, monospace; }
                .at-log-message { color: #dfe3e6; font: 10px Consolas, monospace; overflow-wrap: anywhere; }
                .at-log-data { margin: 2px 0 0 11px; color: #9fa8b1; font: 9.5px Consolas, monospace; overflow-wrap: anywhere; }
                .at-log-empty { color: #89929b; font-size: 10.5px; }
                @media (max-width: 520px) {
                    #at-panel { top: 6px; right: 6px; max-width: calc(100vw - 12px); max-height: calc(100vh - 12px); }
                    #at-body { max-height: calc(100vh - 66px); }
                    .at-log-line { grid-template-columns: 7px 79px minmax(0, 1fr); }
                    .at-log-stage { display: none; }
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        }

        const panel = document.createElement('div');
        panel.id = 'at-panel';
        panel.innerHTML = `
            <div id="at-header">
                <div class="at-brand">
                    <div class="at-title-line">
                        <span class="at-title">Autoplay Auto Trigger</span>
                        <span class="at-version">v${escapeHtml(SCRIPT_VERSION)}</span>
                    </div>
                    <div id="at-source" class="at-source">${escapeHtml(getScriptLoadLabel())}</div>
                </div>
                <button id="at-toggle" type="button" aria-label="패널 접기">접기</button>
            </div>
            <div id="at-body">
                <section class="at-section">
                    <div class="at-section-title">베팅 설정</div>
                    <div class="at-settings">
                        <div class="at-field">
                            <label for="at-threshold">기준 미만</label>
                            <input id="at-threshold" type="number" min="0" value="${THRESHOLD}">
                        </div>
                        <div class="at-field">
                            <label for="at-bet-amount">총 베팅금액</label>
                            <input id="at-bet-amount" type="number" min="0" step="100" value="${TARGET_BET_AMOUNT}">
                        </div>
                        <div class="at-field">
                            <label for="at-auto-seat">좌석 계산 방식</label>
                            <label class="at-check"><input id="at-auto-seat" type="checkbox" ${AUTO_SEAT_COUNT ? 'checked' : ''}>자동 계산</label>
                        </div>
                        <div class="at-field">
                            <label for="at-seat-count">최대 좌석 수</label>
                            <input id="at-seat-count" type="number" min="1" max="7" value="${SEAT_COUNT}">
                        </div>
                    </div>
                    <div class="at-actions">
                        <button id="at-save" class="at-button" type="button">저장</button>
                        <button id="at-setup-bet" class="at-button at-primary" type="button">베팅 설정</button>
                        <button id="at-export-log" class="at-button" type="button">최근 로그 내보내기</button>
                        <button id="at-script-toggle" class="at-button" type="button">스크립트 정지</button>
                        <button id="at-reset" class="at-button" type="button">상태 초기화</button>
                    </div>
                </section>

                <section class="at-section">
                    <div class="at-live-head">
                        <span id="at-state-badge" class="at-state-badge">대기</span>
                        <strong id="at-stage" class="at-stage">대기</strong>
                    </div>
                    <div id="at-failure" class="at-failure"></div>
                    <div class="at-progress-wrap">
                        <div class="at-progress-label"><span>지갑 총 베팅</span><span id="at-wallet-label">확인 중</span></div>
                        <div class="at-progress-track"><div id="at-progress-fill" class="at-progress-fill"></div></div>
                    </div>
                    <div class="at-kv-grid">
                        <div class="at-kv"><div class="at-kv-label">좌석</div><div id="at-seat-summary" class="at-kv-value">확인 중</div></div>
                        <div class="at-kv"><div class="at-kv-label">자동베팅</div><div id="at-autoplay-summary" class="at-kv-value">확인 중</div></div>
                        <div class="at-kv"><div class="at-kv-label">검증된 진행</div><div id="at-verified-progress" class="at-kv-value">없음</div></div>
                        <div class="at-kv"><div class="at-kv-label">선택 / 다음 칩</div><div id="at-chip-progress" class="at-kv-value">확인 중</div></div>
                    </div>
                </section>

                <section class="at-section">
                    <div class="at-section-title">계산 결과</div>
                    <div id="at-plan-summary"></div>
                </section>

                <details class="at-details">
                    <summary>좌석 및 감지 상세</summary>
                    <div id="at-detail-content" class="at-details-content"></div>
                </details>

                <section class="at-section">
                    <div class="at-log-head">
                        <div class="at-section-title">최근 실행 로그</div>
                        <span id="at-log-count" class="at-log-count">0건</span>
                    </div>
                    <div id="at-log-list"></div>
                </section>
            </div>
        `;
        document.body.appendChild(panel);
        const header = document.getElementById('at-header');
        makeDraggable(panel, header);

        let settingsCommitTimer = null;
        const saveSettings = () => {
            if (settingsCommitTimer !== null) {
                clearTimeout(settingsCommitTimer);
                settingsCommitTimer = null;
            }
            clearSettingsInputPending();
            syncSettingsFromUI();
        };

        const queueSettingsSave = () => {
            markSettingsInputPending();
            if (settingsCommitTimer !== null) clearTimeout(settingsCommitTimer);
            settingsCommitTimer = setTimeout(() => {
                settingsCommitTimer = null;
                clearSettingsInputPending();
                syncSettingsFromUI();
            }, SETTINGS_INPUT_SETTLE_MS);
        };

        const updateScriptToggle = () => {
            const btn = document.getElementById('at-script-toggle');
            if (!btn) return;
            btn.textContent = SCRIPT_ENABLED ? '스크립트 정지' : '스크립트 시작';
            btn.classList.toggle('at-danger', SCRIPT_ENABLED);
            btn.classList.toggle('at-primary', !SCRIPT_ENABLED);
        };

        document.getElementById('at-save').addEventListener('click', saveSettings);
        ['at-threshold', 'at-bet-amount', 'at-seat-count', 'at-auto-seat'].forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('input', queueSettingsSave);
            input.addEventListener('change', saveSettings);
        });

        document.getElementById('at-setup-bet').addEventListener('click', () => {
            saveSettings();
            if (isScriptStopped()) {
                console.warn('[AutoTrigger] script stopped; bet setup ignored');
                return;
            }
            setupBetAmount(true).catch(e => console.error('[AutoTrigger] bet setup error:', e));
        });

        let exportButtonResetTimer = null;
        document.getElementById('at-export-log').addEventListener('click', async event => {
            const button = event.currentTarget;
            if (button.disabled) return;
            if (exportButtonResetTimer !== null) {
                clearTimeout(exportButtonResetTimer);
                exportButtonResetTimer = null;
            }
            button.disabled = true;
            button.textContent = '내보내는 중...';
            try {
                const result = await exportBetDebugLog();
                const copied = result.copied ? ' / 복사 완료' : '';
                const status = result.method === 'tampermonkey_download' ? '저장 완료' : '다운로드 요청';
                button.textContent = `${status} ${result.logCount}건${copied}`;
                button.title = result.filename;
            } catch (e) {
                console.error('[AutoTrigger] bet log export failed:', e);
                pushBetLog('error', 'bet_log_export_failed', {
                    error: e?.message || String(e),
                    logs: betDebugLog.length,
                });
                button.textContent = '내보내기 실패';
                button.title = e?.message || String(e);
            } finally {
                button.disabled = false;
                exportButtonResetTimer = setTimeout(() => {
                    exportButtonResetTimer = null;
                    button.textContent = '최근 로그 내보내기';
                    button.title = '';
                }, 3500);
            }
        });

        document.getElementById('at-script-toggle').addEventListener('click', () => {
            SCRIPT_ENABLED = !SCRIPT_ENABLED;
            GM_setValue('scriptEnabled', SCRIPT_ENABLED);
            if (SCRIPT_ENABLED) {
                resetTransientState('script_start');
            } else {
                setBetRuntimeStage('stopped', { reason: 'manual_stop' });
                console.log('[AutoTrigger] script stopped (in-flight will drain)');
            }
            updateScriptToggle();
        });
        updateScriptToggle();

        document.getElementById('at-reset').addEventListener('click', () => {
            resetTransientState('manual_reset');
        });

        const toggleButton = document.getElementById('at-toggle');
        toggleButton.addEventListener('mousedown', event => event.stopPropagation());
        toggleButton.addEventListener('click', event => {
            event.stopPropagation();
            const body = document.getElementById('at-body');
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            toggleButton.textContent = isHidden ? '접기' : '펼치기';
            toggleButton.setAttribute('aria-label', isHidden ? '패널 접기' : '패널 펼치기');
        });

        const updateUI = () => {
            const roundNumber = getRoundNumber();
            const availableChips = detectAvailableChips();
            const expectedPlan = getExpectedBetPlan();
            const wallet = getWalletTotalBetReading();
            const yellowSeatNumbers = getYellowSeatRayNumbers();
            const verifiedSeatNumbers = getControlledSeatNumbers();
            const pendingSeatNumbers = getPendingSitSeatNumbers();
            const setupSeatNumbers = uniqueSortedSeatNumbers(getSetupSeatCandidates().map(getSeatNumber));
            const visibleEmptySeatNumbers = getVisibleEmptySeatNumbers();
            const closeButtonSeatNumbers = getVisibleMainBetSeats().filter(hasSeatCloseButton).map(getSeatNumber);
            const rememberedSeatNumbers = uniqueSortedSeatNumbers(lastTargetSeatNumbers || []);
            const trustedRememberedSeatNumbers = getTrustedRememberedSeatNumbers();
            const displaySeatNumbers = uniqueSortedSeatNumbers([
                ...verifiedSeatNumbers,
                ...rememberedSeatNumbers,
            ]);
            const activeProgress = verifiedBetProgress;

            document.getElementById('at-source').textContent = `${getScriptLoadLabel()} / 게임 ${SCRIPT_GAME_VERSION} / ${SCRIPT_FRAME_MODE}`;

            let stateText = '대기';
            let stateTone = 'idle';
            if (isScriptStopped()) {
                stateText = '정지';
            } else if (isBetClickGuardActive() || betRuntimeStage === 'blocked') {
                stateText = '중단';
                stateTone = 'error';
            } else if (isRunning || isBetSetupRunning) {
                stateText = '실행';
                stateTone = 'work';
            } else if (isAutoplayRunning()) {
                stateText = '정상';
                stateTone = 'ok';
            } else if (lastFailReason) {
                stateText = '복구';
                stateTone = 'work';
            }
            const badge = document.getElementById('at-state-badge');
            badge.textContent = stateText;
            badge.dataset.tone = stateTone;
            document.getElementById('at-stage').textContent = getBetRuntimeStageLabel();

            const failure = document.getElementById('at-failure');
            if (lastFailReason) {
                failure.classList.add('is-visible');
                failure.innerHTML = `${escapeHtml(getFailReasonLabel(lastFailReason))}<span class="at-failure-code">${escapeHtml(lastFailReason)}</span>`;
            } else {
                failure.classList.remove('is-visible');
                failure.textContent = '';
            }

            const expectedTotal = Number.isFinite(expectedPlan.totalActual) ? expectedPlan.totalActual : TARGET_BET_AMOUNT;
            const walletAmount = wallet.detected && !wallet.ambiguous && Number.isFinite(wallet.amount) ? wallet.amount : null;
            const progressRatio = expectedTotal > 0 && Number.isFinite(walletAmount)
                ? Math.min(100, Math.max(0, walletAmount / expectedTotal * 100))
                : 0;
            const progressFill = document.getElementById('at-progress-fill');
            progressFill.style.width = `${progressRatio}%`;
            progressFill.classList.toggle('is-exact', walletAmount === expectedTotal && expectedTotal > 0);
            progressFill.classList.toggle('is-over', Number.isFinite(walletAmount) && walletAmount > expectedTotal);
            document.getElementById('at-wallet-label').textContent = Number.isFinite(walletAmount)
                ? `${formatMoney(walletAmount)} / ${formatMoney(expectedTotal)}원`
                : `미인식 / ${formatMoney(expectedTotal)}원`;

            const plannedSeats = Math.max(1, toInt(expectedPlan.used, getMaxSeatCount(), 1, 7));
            document.getElementById('at-seat-summary').textContent = `${verifiedSeatNumbers.length}/${plannedSeats} (${verifiedSeatNumbers.join(', ') || '없음'})`;
            const autoplayState = isAutoplayRunning()
                ? `${roundNumber ?? '실행 중'}회`
                : (isAutoplayButtonReady() ? '시작 가능' : '대기');
            document.getElementById('at-autoplay-summary').textContent = autoplayState;

            document.getElementById('at-verified-progress').textContent = activeProgress
                ? `${formatMoney(activeProgress.walletAmount)}원 / 좌석당 ${formatMoney(activeProgress.perSeatApplied)}원`
                : '없음';
            const selectedChip = getEffectiveSelectedChipAmount();
            document.getElementById('at-chip-progress').textContent = `${selectedChip > 0 ? formatMoney(selectedChip) : '미인식'} / ${activeProgress?.nextChip ? formatMoney(activeProgress.nextChip) : '없음'}`;

            const difference = expectedPlan.totalTarget - expectedPlan.totalActual;
            const differenceText = difference > 0 ? `, 목표보다 ${formatMoney(difference)}원 부족` : ', 정확';
            document.getElementById('at-plan-summary').innerHTML = `
                <div class="at-plan-line"><strong>${expectedPlan.used}/${expectedPlan.requested}좌석</strong> · 좌석당 ${formatMoney(expectedPlan.perSeatActual)}원 · 총 ${formatMoney(expectedPlan.totalActual)}원<span class="at-muted">${differenceText}</span></div>
                <div class="at-plan-line"><span class="at-muted">칩 순서</span> ${escapeHtml(formatChipPlan(expectedPlan.chipPlan))}</div>
                <div class="at-plan-line"><span class="at-muted">감지 칩</span> ${escapeHtml(availableChips.length ? availableChips.map(chip => formatMoney(chip.value)).join(', ') : '없음')}</div>
            `;

            const seatAmounts = displaySeatNumbers.map(seatNumber => {
                const seat = getSeatByNumber(seatNumber);
                if (!seat) return `${seatNumber}=없음`;
                const state = getSeatBetState(seat);
                if (state.amountDetected) return `${seatNumber}=${formatMoney(state.amount)}`;
                return `${seatNumber}=${state.hasChip ? '금액 미인식' : '칩 없음'}`;
            }).join(' / ') || '없음';
            const guardText = isBetClickGuardActive()
                ? `${Math.ceil(Math.max(0, betClickGuardUntil - Date.now()) / 1000)}초 / ${lastBetClickGuardReason || '검증 대기'}`
                : '없음';
            document.getElementById('at-detail-content').innerHTML = `
                <div class="at-detail-row"><span class="at-detail-label">단계 코드</span><span class="at-detail-value">${escapeHtml(lastDiagnosedPhase || '없음')} / ${escapeHtml(betRuntimeStage)}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">좌석별 금액</span><span class="at-detail-value">${escapeHtml(seatAmounts)}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">기억 좌석</span><span class="at-detail-value">${escapeHtml(rememberedSeatNumbers.join(', ') || '없음')} / 보호 ${escapeHtml(trustedRememberedSeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">노란 좌석</span><span class="at-detail-value">${escapeHtml(yellowSeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">후보 / 빈 좌석</span><span class="at-detail-value">${escapeHtml(setupSeatNumbers.join(', ') || '없음')} / ${escapeHtml(visibleEmptySeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">닫기 버튼</span><span class="at-detail-value">${escapeHtml(closeButtonSeatNumbers.join(', ') || '없음')} / 대기 ${escapeHtml(pendingSeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">베팅 가드</span><span class="at-detail-value">${escapeHtml(guardText)}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">최근 클릭</span><span class="at-detail-value">${escapeHtml(lastBetClickDebug || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">누적 실행</span><span class="at-detail-value">베팅 ${betSetupCount}, 오토100 ${autoplayStartCount}, 재활성 ${autoplayRearmCount}, 기준재시작 ${autoplayThresholdRestartCount}, 보험 ${insuranceClickCount}</span></div>
            `;

            document.getElementById('at-log-list').innerHTML = getBetDebugLogHtml(10);
            document.getElementById('at-log-count').textContent = `${betDebugLog.length}건`;
            updateScriptToggle();
        };

        updateUI();
        setInterval(updateUI, 250);
    }

    const restoredBetLogCount = betDebugLog.length;
    pushBetLog('info', 'script_session_started', {
        sessionId: SCRIPT_SESSION_ID,
        version: SCRIPT_VERSION,
        restoredLogs: restoredBetLogCount,
        frame: SCRIPT_FRAME_MODE,
        game: SCRIPT_GAME_VERSION,
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }

})();
