// ==UserScript==
// @name         Autoplay Auto Trigger
// @namespace    http://tampermonkey.net/
// @version      1.85
// @description  BlackjackX 3.2.51 게임 iframe에서도 실행하고 seat-taken-nickname으로 점유 좌석을 검증, 실행 정지/시작, 좌석/칩 베팅 속도 최적화, 자동베팅 버튼/100회 시작을 누르기 직전에 wallet-total-bet 및 wallet-mobile-total-bet의 총 베팅값을 판독해 계획 총액과 정확히 일치할 때만 진행하고 더블다운/스플릿 잔여 금액 등으로 총액이 다르면 자동베팅 시작을 차단하며 로그 내보내기에 지갑 총액 판독값 포함, 자동베팅 bottom-sheet modal이 자동베팅 시작/충전 작업 없이 3초 이상 열린 채 남아 있으면 idle 상태로 판단해 닫기 버튼을 자동 클릭하고 로그 기록, bottom-sheet-modal 래퍼가 감지되지 않는 자동베팅창도 autoplay-container/start/modify/stop 마커에서 부모 창과 닫기 버튼을 역추적해 자동 닫기, 자동베팅 bottom-sheet modal이 열린 상태에서 좌석/칩 베팅 클릭을 가로막는 문제를 막기 위해 베팅 직전에만 자동베팅 bottom-sheet를 닫고 robustBetClick이 modal 내부 요소를 좌석 클릭 대상으로 오인하지 않도록 차단, 좌석에 올라간 단일 칩이 DOM 조각 5개로 감지되는 로그 케이스를 반영해 7,500×1 계획에서 chipCount 1~8을 단일 칩으로 추정하여 베팅 성공/자동베팅 100회 단계로 진행, 기준미만 보충은 내부 div가 아닌 button[data-testid=autoplay-control-button]을 직접 클릭하고 보충 전후 라운드 로그 기록, 자동베팅 버튼/100회 시작/단독 재활성화/기준미만 재시작 실패 로그 강화, probe의 실제 hit-test 요소(div/span)가 mainbetSeat 경계 밖으로 판정되어 버려지던 문제를 수정해 베팅 좌표 위 실제 elementFromPoint 대상을 안전하면 직접 클릭, selected=unknown 상태의 chip-stack 선택 실패 가능성을 줄이도록 무반응 재시도 전에 계획 칩을 재선택, 베팅 스팟 클릭을 touch/mouse 단일 프로필로 분리해 무반응일 때만 제한적으로 대체 프로필을 재시도하고 칩이 조금이라도 감지되면 즉시 가드로 중복 베팅 차단, 실패 로그를 최근 200개까지 보관하고 UI의 "로그 내보내기" 버튼으로 설정/좌석/칩/계획/최근 로그 JSON 파일 다운로드 지원, 베팅 스팟 robustBetClick을 다중 좌표×다중 타겟 발사에서 단일 클릭 발사로 변경해 한 번의 의도된 베팅이 여러 칩으로 들어가는 과베팅 경로 차단, 베팅 클릭 후 금액 검증이 안 되면 2.2초 가드로 재클릭/재세팅을 막고 금액 미인식 칩이 보이는 동안 dirty 상태와 관계없이 복구를 멈춰 중복 베팅 방지, 베팅 가능 DOM의 mainbetSeat_N/ghost-chip/svg를 mainbet_N보다 먼저 클릭하고 실패 로그에 후보목록/probe 좌표를 기록해 좌석 베팅 클릭 누락 원인을 즉시 확인, 칩 선택 버튼은 native click까지 병행해 chip-stack 선택 안정화, 칩 선택/좌석 클릭/검증 실패 원인을 상태 패널에 최근 5개 표시해 선택칩/계획칩/좌석/타겟/관측금액/하드캡 차단 사유를 즉시 확인, chip-stack-value 선언값을 텍스트보다 우선해 7,500 계획이 60,000 칩 버튼으로 오인되는 문제를 차단하고 좌석 클릭 직전 선택칩/계획칩/좌석당 한도를 재검증해 총액 초과 과베팅 방지, 750×2/750×4 같은 동일칩 다중 베팅은 원래 기준금액을 유지한 채 1클릭 단위 진행률을 칩 개수/금액으로 즉시 확인하고 부족분만 빠르게 보충해 동시 클릭 누락 방지, 트레이/스택/전체 chip DOM을 병합 감지해 750/1500 최소칩 변동에도 정확금액 우선 + 클릭 수 최소 조합으로 계산, 칩 자동 감지 + 총 베팅금액 기준 좌석수/칩 자동 계산(초과 금지), 인슈어런스 "아니오"는 bj-decision-panel 안의 div[data-id=no]를 40ms 별도 감시 루프로 텍스트 의존 없이 raw div/내부 자식까지 즉시 클릭, 기준미만 자동베팅 보충 시 실행 중이면 stop 버튼을 누르지 않고 autoplay-modify-button(+10) control 버튼만 직접 클릭해 100회까지 보충, seat_N DOM 분석 기반으로 mainbetSeat_N 내부 ghost-chip/svg를 최우선 클릭하고 raw child + ancestor 양쪽에 이벤트를 발사해 실제 베팅 스팟 클릭 누락 방지, ghost placeholder만 보이는 무반응 상태는 다음 베팅 영역으로 빠르게 재시도, 좌석 칩 금액 텍스트가 숨겨진 경우에도 계획 좌석/칩 조합이 정확히 맞으면 금액을 추정해 자동베팅 클릭 차단 방지, 실제 좌석 칩 얼굴 텍스트는 읽고 일반 UI 숫자는 제외해 7,500 오인식/미인식 동시 방지, 이미 목표 베팅금액이면 추가 칩 클릭 없이 즉시 완료 처리, 선택 불가 칩값은 실제 칩 조합으로 분해, 고객지원 확인 팝업 새로고침 후 베팅/오토100 복구, chips_missing 중에도 좌석 우선 착석 후 칩 대기, seat_N/mainbetSeat_N 이중 기준으로 1~7번 빈시트 재검수, 빈시트 오인 pending 즉시 해제와 실제 빈자리 마커 우선 착석, 자리에 앉으십시오 감지 시 실제 미착석이면 stale 좌석기억 해제 후 즉시 착석, seat_N 내부 close-icon 기반 내 좌석 검증, 베팅 중 내 좌석 기억 고정으로 순간 감지 누락 시 3좌석 오착석 방지, 빠른 루프 경량화와 좌석기억 캐시로 전체 속도 개선, 좌석 close와 베팅 close 분리, "자리에 앉으십시오" 즉시 착석 트리거, 좌석 추가 발생 시 자동베팅 취소 후 재분배, 빈자리 자동 탐색(1~7), 자동 베팅 100회 보충, "지금 딜" 자동 클릭, "비활성 중단" 팝업 자동 해제, 자동 베팅만 꺼진 경우 베팅 재설정 없이 단독 재활성화. iframe + React + Touch + 오버레이 대응.
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
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function isBlackjackGameDocument(doc = document) {
        if (!doc?.querySelector) return false;
        const root = doc.querySelector('#root[data-game-version],#root[data-build-number]');
        if (root) {
            const build = `${root.getAttribute?.('data-build-number') || ''} ${root.getAttribute?.('data-version') || ''}`;
            if (!build || /blackjackx/i.test(build)) return true;
        }
        return !!doc.querySelector('[data-testid="game-grid-wrapper"],[data-testid^="seat_"]');
    }

    if (!isBlackjackGameDocument(document)) return;

    const SCRIPT_FRAME_MODE = window.top === window.self ? 'top' : 'iframe';
    const SCRIPT_GAME_VERSION = document.querySelector('#root')?.getAttribute?.('data-game-version') || 'unknown';
    const SCRIPT_ACTIVE_ATTRIBUTE = 'data-autotrigger-script-active';
    if (document.documentElement?.hasAttribute?.(SCRIPT_ACTIVE_ATTRIBUTE)) return;
    document.documentElement?.setAttribute?.(SCRIPT_ACTIVE_ATTRIBUTE, 'true');

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
    const CHECK_INTERVAL_MS = 80;
    const FAST_SEAT_CHECK_INTERVAL_MS = 30;
    const BET_CLOSE_ICON_SELECTOR = '[data-testid="bet-spot-close-icon-button"]';
    const SEAT_LEAVE_ICON_SELECTOR = '[data-testid="close-icon"]';
    const SEAT_CLOSE_ICON_SELECTOR = `${BET_CLOSE_ICON_SELECTOR},${SEAT_LEAVE_ICON_SELECTOR}`;
    const CLICK_DELAY_MS = 8;
    const SEAT_CLICK_DELAY_MS = 8;
    const BROADCAST_CLICK_PROGRESS_WAIT_MS = 220;
    const BET_CLICK_VERIFY_MS = 240;
    const BET_CLICK_RETRY_LIMIT = 3;
    const BET_UNCHANGED_RECHECK_MS = 45;
    const BET_NO_EFFECT_RECHECK_MS = 180;
    const BET_NO_EFFECT_RETRY_LIMIT = 2;
    const BET_CLICK_UNCERTAIN_GUARD_MS = 2200;
    const EXTRA_SEAT_CLOSE_WAIT_MS = 90;
    const COOLDOWN_MS = 550;
    const BET_SETUP_COOLDOWN_MS = 450;
    const STOP_AUTOPLAY_WAIT_MS = 700;
    const DEAL_COOLDOWN_MS = 450;
    const INSURANCE_COOLDOWN_MS = 200;
    const INSURANCE_WATCH_INTERVAL_MS = 40;
    const AUTOBET_COUNT_VERIFY_MS = 650;
    const AUTOBET_COUNT_MISSING_GRACE_MS = 420;
    const AUTOBET_RECOVERY_COOLDOWN_MS = 800;
    const AUTOPLAY_BUTTON_READY_WAIT_MS = 800;
    const AUTOPLAY_MENU_WAIT_MS = 800;
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
    const BET_DEBUG_LOG_LIMIT = 200;
    const SINGLE_CHIP_DOM_PART_LIMIT = 8;
    const SELECTED_STACK_CHIP_TTL_MS = 2500;
    const BET_BLOCKING_MODAL_CLOSE_WAIT_MS = 180;
    const AUTOPLAY_MODAL_IDLE_CLOSE_MS = 3000;

    let isRunning = false;
    let isBetSetupRunning = false;
    let lastTriggerAt = 0;
    let lastDealClickAt = 0;
    let dealClickCount = 0;
    let lastInsuranceClickAt = 0;
    let insuranceClickCount = 0;
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
    let betDebugLog = [];
    let autoplayModalVisibleSince = 0;
    let lastAutoplayModalActionAt = 0;
    let lastAutoplayModalIdleCloseAt = 0;
    let sitPromptTriggerCount = 0;
    const SIT_PROMPT_COOLDOWN_MS = 180;
    const SIT_PROMPT_FORCE_SEAT_MS = 1200;
    let lastSeatExpansionHandledAt = 0;
    const SEAT_EXPANSION_COOLDOWN_MS = 350;
    let forceSitPromptSeatUntil = 0;

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

    function isTargetSeatMemoryTrusted(numbers = lastTargetSeatNumbers) {
        const remembered = uniqueSortedSeatNumbers(numbers);
        if (remembered.length <= 0) return false;

        const recentlyConfirmed = lastTargetSeatRememberedAt > 0 &&
            Date.now() - lastTargetSeatRememberedAt <= TARGET_SEAT_MEMORY_GUARD_MS;
        const activeBetContext = isBetSetupRunning ||
            betSettingsDirty ||
            autoBetArmed ||
            isBetSettingsApplied() ||
            (lastRoundCountSeenAt > 0 && Date.now() - lastRoundCountSeenAt <= TARGET_SEAT_MEMORY_GUARD_MS) ||
            (lastSeatPlan?.totalActual || 0) > 0;

        if (recentlyConfirmed && activeBetContext) return true;
        return getLiveRememberedSeatEvidence(remembered).length > 0;
    }

    function getTrustedRememberedSeatNumbers() {
        const now = Date.now();
        const limit = getPlannedSeatLimit();
        const remembered = uniqueSortedSeatNumbers(lastTargetSeatNumbers).slice(0, limit);
        const cacheKey = [
            remembered.join(','),
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

        const value = remembered.length > 0 && isTargetSeatMemoryTrusted(remembered)
            ? remembered
            : [];
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

        let next = incoming;
        if (!allowShrink && memoryTrusted && previous.length > 0) {
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
        if (Date.now() - lastRecoveryAt < AUTOBET_RECOVERY_COOLDOWN_MS) return false;
        autoBetArmed = false;
        betSettingsDirty = true;
        lastBetSetupAt = 0;
        lastRecoveryAt = Date.now();
        lastFailReason = reason;
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
        lastSeatPlan = emptyPlan();
        clearRememberedSeatNumbers();
        betSettingsDirty = true;
        lastFailReason = null;
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

    // ========== 라운드/오토 버튼 ==========
    function getRoundNumber() {
        const now = Date.now();
        if (_roundNumberCacheAt > 0 && now - _roundNumberCacheAt < DOM_MICRO_CACHE_MS) {
            return _roundNumberCache;
        }
        const btn = getAutoplayButton();
        const text = (btn?.textContent || '').trim();
        if (!/^\d+$/.test(text)) {
            _roundNumberCache = null;
            _roundNumberCacheAt = now;
            return null;
        }
        const value = parseInt(text, 10);
        _roundNumberCache = Number.isFinite(value) && value > 0 ? value : null;
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
        for (const marker of qsaDeep('[data-testid="autoplay-modify-button"]')) {
            const control = marker.closest?.('button[data-testid="autoplay-control-button"]') || marker.closest?.('button');
            if (control && isVisible(control) && !isDisabledLike(control) && marker && isVisible(marker)) return control;
        }
        for (const control of qsaDeep('button[data-testid="autoplay-control-button"]')) {
            const marker = control.querySelector?.('[data-testid="autoplay-modify-button"]');
            if (marker && isVisible(marker) && isVisible(control) && !isDisabledLike(control)) return control;
        }
        return null;
    }

    async function topUpAutoplayRoundsByModify(currentRoundNumber) {
        const missingRounds = Math.max(1, AUTOPLAY_START_ROUNDS - toInt(currentRoundNumber, AUTOPLAY_START_ROUNDS - 10, 0, AUTOPLAY_START_ROUNDS));
        const clickCount = Math.max(1, Math.min(10, Math.ceil(missingRounds / 10)));
        let clicked = 0;
        let latestRound = Number.isFinite(currentRoundNumber) ? currentRoundNumber : observeAutoplayRoundNumber();
        for (let i = 0; i < clickCount; i++) {
            if (isScriptStopped()) return Number.isFinite(latestRound) && latestRound >= AUTOPLAY_START_ROUNDS;
            if (!verifyAutoplayStartSafety(getExpectedBetPlan(), 'threshold_modify')) return false;
            const modifyBtn = getAutoplayModifyButton();
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
            robustClick(modifyBtn);
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

    function getSelectedChipAmount() {
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
            ...getTrustedRememberedSeatNumbers(),
            ...getYellowSeatRayNumbers(),
        ]);
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
        const remembered = forceSeat ? [] : getTrustedRememberedSeatNumbers();
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

        const clickCount = getChipPlanClickCount(chipPlan);
        if (clickCount <= 0) return false;

        const singleExactChip = chipPlan.length === 1 &&
            chipPlan[0].count === 1 &&
            chipPlan[0].value === plan.perSeatActual;
        if (singleExactChip) {
            return state.chipCount > 0 && state.chipCount <= SINGLE_CHIP_DOM_PART_LIMIT;
        }

        return state.chipCount > 0 && state.chipCount === clickCount;
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
            const amount = state.amountDetected ? state.amount : (inferred ? expectedPlan.perSeatActual : null);
            return {
                seatNumber: n,
                amount,
                hasChip: state.hasChip,
                chipCount: state.chipCount,
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
        if (summary.seats.length < expected) return false;
        if (summary.detectedCount < expected || summary.ambiguousCount > 0) return false;
        if (summary.total !== plan.totalActual) return false;
        return summary.amounts
            .filter(item => Number.isFinite(item.amount))
            .slice(0, expected)
            .every(item => item.amount === plan.perSeatActual);
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
        const currentUsed = Math.max(
            currentSeats.length,
            Number.isFinite(lastSeatPlan?.used) ? lastSeatPlan.used : 0
        );
        if (currentUsed <= 0 || currentUsed >= maxSeats) return null;
        if (!isBettingWindowOpen()) return null;

        const availableChips = detectAvailableChips();
        if (availableChips.length === 0) return null;

        const allSeats = getSetupSeatCandidates();
        if (allSeats.length <= currentUsed) return null;

        const expandedSeatCount = Math.min(maxSeats, allSeats.length);
        if (expandedSeatCount <= currentUsed) return null;

        const nextPlan = buildSeatPlanForCount(expandedSeatCount, maxSeats, allSeats.length, TARGET_BET_AMOUNT, availableChips);
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
        return summary.detectedCount >= expected &&
            summary.total === expectedPlan.totalActual &&
            summary.amounts.every(item => item.amount === expectedPlan.perSeatActual);
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

    function hasGhostChip(seat) { return !!seat?.querySelector?.('[data-testid="ghostChip"],[data-testid="ghost-chip"]'); }

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
            mainBetGhost,
            mainBetSvg,
            directSeat,
            mainBetChipLayer,
            directSpot,
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
        const extraSeats = getBettableSeats().filter(s => isOwnSeat(s) && !keep.has(getSeatNumber(s)));
        for (const seat of extraSeats) {
            if (isScriptStopped()) return false;
            const n = getSeatNumber(seat);
            const closeBtn = getSeatCloseButton(seat);
            if (!closeBtn || !isVisible(closeBtn)) {
                console.warn(`[AutoTrigger] extra seat ${n} close button not found`);
                continue;
            }
            robustClick(closeBtn);
            closed++;
            await sleep(EXTRA_SEAT_CLOSE_WAIT_MS);
        }
        if (closed > 0) {
            await waitForCondition(() => {
                return getBettableSeats().filter(s => isOwnSeat(s) && !keep.has(getSeatNumber(s))).length === 0;
            }, 500, 30);
            console.log(`[AutoTrigger] closed extra seated: ${closed}`);
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
            ...getTrustedRememberedSeatNumbers(),
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
        clearRememberedSelectedStackChip();
        pushBetLog('info', 'select_chip', {
            planned: formatMoney(chipValue),
            target: getElementLabel(chip),
            available: detectAvailableChips().map(c => formatMoney(c.value)).join(','),
        });
        robustClick(chip);
        const stackBtn = chip.closest?.('button[data-testid^="chip-stack-value-"]') ||
            (chip.matches?.('button[data-testid^="chip-stack-value-"]') ? chip : null);
        await sleep(CLICK_DELAY_MS);
        const selectedAmount = getSelectedChipAmount();
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
            pushBetLog('info', 'select_chip_ok_stack', {
                planned: formatMoney(chipValue),
                selected: Number.isFinite(selectedAmount) && selectedAmount > 0 ? formatMoney(selectedAmount) : 'unknown',
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
        pushBetLog('info', 'select_chip_ok_tray', {
            planned: formatMoney(chipValue),
            selected: formatMoney(getSelectedChipAmount()),
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

    function areObservedStatesSafelyAtExpectedByChipCount(states, chipValue, clickCount) {
        if (!states || states.length <= 0) return false;
        if (!Number.isFinite(chipValue) || chipValue <= 0 || !Number.isFinite(clickCount) || clickCount <= 0) return false;
        return states.every(item => {
            if (item.hasGhost) return false;
            if (item.observedAmount === item.expectedAmount) return true;
            if (item.observedAmount !== null || !item.hasChip) return false;
            const baseAmount = Math.max(0, item.baseAmount || 0);
            const expectedDelta = item.expectedAmount - baseAmount;
            if (expectedDelta !== chipValue * clickCount) return false;
            const baseChipCount = Math.max(0, item.baseChipCount || 0);
            return item.chipCount === baseChipCount + clickCount;
        });
    }

    function areObservedStatesAtHardCap(states, maxPerSeatAmount) {
        if (!Number.isFinite(maxPerSeatAmount) || maxPerSeatAmount <= 0) return false;
        return states.length > 0 && states.every(item =>
            !item.hasGhost && item.observedAmount === maxPerSeatAmount
        );
    }

    function getUniformObservedChipClicks(states, chipValue, maxClickCount, requireAmount = false) {
        if (!states || states.length <= 0 || !Number.isFinite(chipValue) || chipValue <= 0) return null;
        const counts = [];
        for (const item of states) {
            if (item.hasGhost) return null;
            let count = null;
            if (Number.isFinite(item.observedAmount)) {
                const delta = item.observedAmount - Math.max(0, item.baseAmount || 0);
                if (delta < 0 || delta % chipValue !== 0) return null;
                count = delta / chipValue;
            } else {
                if (requireAmount || !item.hasChip) return null;
                count = (item.chipCount || 0) - Math.max(0, item.baseChipCount || 0);
            }
            if (!Number.isInteger(count) || count < 0 || count > maxClickCount) return null;
            counts.push(count);
        }
        return counts.every(count => count === counts[0]) ? counts[0] : null;
    }

    async function clickSingleSeatChipVerified(seatNumber, chipValue, maxPerSeatAmount = Infinity) {
        for (let attempt = 0; attempt <= BET_CLICK_RETRY_LIMIT; attempt++) {
            if (isScriptStopped()) return false;
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
            if (areObservedStatesSafelyAtExpectedByChipCount([observed], chipValue, 1)) {
                console.log(`[AutoTrigger] individual chip=${chipValue} verified by chip-count inference`);
                return true;
            }
            if (areObservedStatesSafelyAtSingleChipTarget([observed], chipValue, maxPerSeatAmount)) {
                console.log(`[AutoTrigger] individual chip=${chipValue} verified by visible single-chip target inference`);
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
                if (areObservedStatesSafelyAtExpectedByChipCount([rechecked], chipValue, 1)) {
                    console.log(`[AutoTrigger] individual chip=${chipValue} verified by delayed chip-count inference`);
                    return true;
                }
                if (areObservedStatesSafelyAtSingleChipTarget([rechecked], chipValue, maxPerSeatAmount)) {
                    console.log(`[AutoTrigger] individual chip=${chipValue} verified by delayed visible single-chip inference`);
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

    async function clickMainBetChipBroadcastBatchVerified(seatNumbers, chipValue, clickCount, maxPerSeatAmount = Infinity) {
        const targets = uniqueSortedSeatNumbers(seatNumbers);
        if (targets.length <= 0 || clickCount <= 1) return false;

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

        const expectations = [];
        for (const n of targets) {
            const baseSeat = getSeatByNumber(n);
            const baseState = getSeatBetState(baseSeat);
            const baseAmount = baseState.amountDetected ? baseState.amount : (baseState.hasChip ? null : 0);
            if (baseAmount === null) {
                pushBetLog('error', 'broadcast_base_unknown', {
                    seat: n,
                    chip: formatMoney(chipValue),
                    count: clickCount,
                    chipCount: baseState.chipCount,
                });
                console.warn(`[AutoTrigger] seat ${n} has chip but amount is unknown; skip batch chip click`);
                return false;
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

        let appliedClicks = 0;
        while (appliedClicks < clickCount) {
            if (isScriptStopped()) return false;

            const beforeStates = readSeatAmountsForExpectations(expectations);
            const alreadyApplied = getUniformObservedChipClicks(beforeStates, chipValue, clickCount, false);
            if (Number.isFinite(alreadyApplied) && alreadyApplied > appliedClicks) {
                appliedClicks = alreadyApplied;
                if (appliedClicks >= clickCount) return true;
            }
            if (areObservedStatesSafelyAtExpectedByChipCount(beforeStates, chipValue, clickCount) ||
                areObservedStatesAtHardCap(beforeStates, maxPerSeatAmount)) {
                return true;
            }

            const nextApplied = appliedClicks + 1;
            let progressed = false;
            for (let attempt = 0; attempt <= BET_CLICK_RETRY_LIMIT; attempt++) {
                if (isScriptStopped()) return false;
                const seat = getSeatByNumber(clickSeatNumber);
                if (!seat || !isVisible(seat) || isDisabledLike(seat)) {
                    console.warn(`[AutoTrigger] broadcast batch click seat ${clickSeatNumber} not ready`);
                    return false;
                }
                await closeBetBlockingBottomSheetIfOpen('broadcast_batch_bet_click');

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
                    if (areObservedStatesSafelyAtExpectedByChipCount(states, chipValue, clickCount)) return true;
                    if (areObservedStatesAtHardCap(states, maxPerSeatAmount)) return true;
                    const applied = getUniformObservedChipClicks(states, chipValue, clickCount, false);
                    return Number.isFinite(applied) && applied >= nextApplied;
                }, BROADCAST_CLICK_PROGRESS_WAIT_MS, VERIFY_POLL_MS);

                const observedStates = readSeatAmountsForExpectations(expectations);
                const observed = formatObservedSeatStates(observedStates);
                if (areObservedStatesSafelyAtExpectedByChipCount(observedStates, chipValue, clickCount)) {
                    console.log(`[AutoTrigger] broadcast progress chip=${chipValue} x${clickCount} verified by chip-count inference (${observed})`);
                    return true;
                }
                if (areObservedStatesAtHardCap(observedStates, maxPerSeatAmount)) {
                    console.log(`[AutoTrigger] broadcast progress chip=${chipValue} reached hard cap (${observed})`);
                    return true;
                }
                const observedApplied = getUniformObservedChipClicks(observedStates, chipValue, clickCount, false);
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
                    if (areObservedStatesSafelyAtExpectedByChipCount(recheckedStates, chipValue, clickCount)) {
                        console.log(`[AutoTrigger] broadcast progress chip=${chipValue} x${clickCount} verified by delayed chip-count inference (${rechecked})`);
                        return true;
                    }
                    if (areObservedStatesAtHardCap(recheckedStates, maxPerSeatAmount)) {
                        console.log(`[AutoTrigger] broadcast progress chip=${chipValue} reached hard cap after delayed read (${rechecked})`);
                        return true;
                    }
                    const recheckedApplied = getUniformObservedChipClicks(recheckedStates, chipValue, clickCount, false);
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
        if (areObservedStatesSafelyAtExpectedByChipCount(finalStates, chipValue, clickCount) ||
            areObservedStatesAtHardCap(finalStates, maxPerSeatAmount)) {
            return true;
        }
        return waitForAllSeatBetAmountsExactly(expectations);
    }

    async function clickMainBetChipBroadcastVerified(seatNumbers, chipValue, clickCount, maxPerSeatAmount = Infinity) {
        const targets = uniqueSortedSeatNumbers(seatNumbers);
        if (targets.length <= 0) return false;
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
            return clickMainBetChipBroadcastBatchVerified(targets, chipValue, clickCount, maxPerSeatAmount);
        }

        for (let i = 0; i < clickCount; i++) {
            if (Number.isFinite(maxPerSeatAmount) && areSeatsAlreadyAtAmount(targets, maxPerSeatAmount)) {
                return true;
            }
            let clicked = false;
            for (let attempt = 0; attempt <= BET_CLICK_RETRY_LIMIT; attempt++) {
                if (isScriptStopped()) return false;
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
                const expectations = [];
                for (const n of targets) {
                    const baseSeat = getSeatByNumber(n);
                    const baseState = getSeatBetState(baseSeat);
                    const baseAmount = baseState.amountDetected ? baseState.amount : (baseState.hasChip ? null : 0);
                    if (baseAmount === null) {
                        pushBetLog('error', 'broadcast_single_base_unknown', {
                            seat: n,
                            chip: formatMoney(chipValue),
                            chipCount: baseState.chipCount,
                        });
                        console.warn(`[AutoTrigger] seat ${n} has chip but amount is unknown; skip extra chip click`);
                        return false;
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

                if (await waitForAllSeatBetAmountsExactly(expectations)) {
                    clicked = true;
                    break;
                }
                const observedStates = readSeatAmountsForExpectations(expectations);
                const observed = formatObservedSeatStates(observedStates);
                if (areObservedStatesSafelyAtExpectedByChipCount(observedStates, chipValue, 1)) {
                    console.log(`[AutoTrigger] broadcast chip=${chipValue} verified by chip-count inference (${observed})`);
                    clicked = true;
                    break;
                }
                if (areObservedStatesAtHardCap(observedStates, maxPerSeatAmount)) {
                    console.log(`[AutoTrigger] broadcast chip=${chipValue} reached hard cap (${observed})`);
                    return true;
                }
                if (areObservedStatesSafelyAtSingleChipTarget(observedStates, chipValue, maxPerSeatAmount)) {
                    console.log(`[AutoTrigger] broadcast chip=${chipValue} verified by visible single-chip target inference (${observed})`);
                    clicked = true;
                    break;
                }
                if (areObservedStatesUnchangedSafe(observedStates)) {
                    await sleep(BET_NO_EFFECT_RECHECK_MS);
                    const recheckedStates = readSeatAmountsForExpectations(expectations);
                    const rechecked = formatObservedSeatStates(recheckedStates);
                    if (areObservedStatesSafelyAtExpectedByChipCount(recheckedStates, chipValue, 1)) {
                        console.log(`[AutoTrigger] broadcast chip=${chipValue} verified by delayed chip-count inference (${rechecked})`);
                        clicked = true;
                        break;
                    }
                    if (areObservedStatesAtHardCap(recheckedStates, maxPerSeatAmount)) {
                        console.log(`[AutoTrigger] broadcast chip=${chipValue} reached hard cap after delayed read (${rechecked})`);
                        return true;
                    }
                    if (areObservedStatesSafelyAtSingleChipTarget(recheckedStates, chipValue, maxPerSeatAmount)) {
                        console.log(`[AutoTrigger] broadcast chip=${chipValue} verified by delayed visible single-chip inference (${rechecked})`);
                        clicked = true;
                        break;
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
                            chip: formatMoney(chipValue),
                            observed: rechecked,
                        });
                        markBetClickGuard('broadcast_single_unverified_wait', {
                            chip: formatMoney(chipValue),
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

        try {
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
            for (const n of targetSeatNumbers) {
                if (isScriptStopped()) { failReason = 'stopped'; return false; }
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

            const currentBetSummary = getTargetSeatBetSummary(targetSeatNumbers, plan);
            if (isBetSummaryMatchingPlan(currentBetSummary, plan)) {
                rememberTargetSeatNumbers(targetSeatNumbers, { allowShrink: true, reason: 'setup_existing_exact' });
                console.log(`[AutoTrigger] existing bet already matches plan: 총 ${formatMoney(currentBetSummary.total)} / 좌석 ${targetSeatNumbers.join(',')}`);
                pushBetLog('info', 'existing_bet_matches_plan', {
                    seats: targetSeatNumbers.join(','),
                    total: formatMoney(currentBetSummary.total),
                    perSeat: formatMoney(plan.perSeatActual),
                });
                ok = true;
                return true;
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

            for (const n of targetSeatNumbers) {
                if (isScriptStopped()) { failReason = 'stopped'; return false; }
                const seat = getSeatByNumber(n);
                const existingState = getSeatBetState(seat);

                // [1.46] 좌석 close-icon은 "앉음" 신호이고 베팅 close가 아니다.
                //        기존 베팅 초기화는 mainbet 영역의 bet-spot-close-icon-button만 사용한다.
                const betCloseBtn = getSeatBetCloseButton(seat);
                const hasBetCloseBtn = !!(betCloseBtn && isVisible(betCloseBtn));

                if (existingState.hasChip && !existingState.amountDetected) {
                    console.warn(`[AutoTrigger] seat ${n} has visible chip but amount unknown → force close to avoid double betting`);
                    if (!(await closeSeatBet(n))) {
                        failReason = `close_seat_${n}_unknown`;
                        return false;
                    }
                    if (!(await sitSeatIfNeeded(n))) {
                        failReason = `resit_seat_${n}_unknown`;
                        return false;
                    }
                    continue;
                }

                const existing = existingState.amountDetected ? existingState.amount : 0;
                if (existing > 0 || hasBetCloseBtn) {
                    const reasonLog = existing > 0
                        ? `existing bet ${formatMoney(existing)}`
                        : 'bet close button visible (chip exists but unrecognized)';
                    console.log(`[AutoTrigger] seat ${n} ${reasonLog}; reset before applying plan`);
                    if (!(await closeSeatBet(n))) {
                        failReason = `close_seat_${n}`;
                        return false;
                    }
                    if (!(await sitSeatIfNeeded(n))) {
                        failReason = `resit_seat_${n}`;
                        return false;
                    }
                }
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
            for (const spec of plan.chipPlan) {
                if (isScriptStopped()) { failReason = 'stopped'; return false; }
                if (!(await selectChipByValue(spec.value))) {
                    failReason = `select_chip_${spec.value}`;
                    pushBetLog('error', 'setup_select_chip_failed', {
                        chip: formatMoney(spec.value),
                        count: spec.count,
                        chipPlan: formatChipPlan(plan.chipPlan),
                    });
                    return false;
                }
                if (!(await clickMainBetChipBroadcastVerified(targetSeatNumbers, spec.value, spec.count, plan.perSeatActual))) {
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
            }

            rememberTargetSeatNumbers(targetSeatNumbers, { allowShrink: true, reason: 'setup_final' });
            const finalBetSummary = getTargetSeatBetSummary(lastTargetSeatNumbers, plan);
            if (finalBetSummary.total !== plan.totalActual) {
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
                return false;
            }
            if (!areBetSeatsReadyForRoundAction(plan)) {
                failReason = 'bet_amount_not_detected_after_setup';
                console.warn('[AutoTrigger] 칩 베팅 후 좌석 금액 인식 실패 → 자동베팅 활성화 중단, 복구 예정');
                pushBetLog('error', 'bet_amount_not_detected_after_setup', {
                    seats: lastTargetSeatNumbers.join(','),
                    perSeat: formatMoney(plan.perSeatActual),
                    chipPlan: formatChipPlan(plan.chipPlan),
                });
                return false;
            }
            console.log(`[AutoTrigger] bet setup OK: 총 ${formatMoney(plan.totalActual)}/${formatMoney(plan.totalTarget)}`);
            pushBetLog('info', 'bet_setup_ok', {
                total: `${formatMoney(plan.totalActual)}/${formatMoney(plan.totalTarget)}`,
                seats: targetSeatNumbers.join(','),
                perSeat: formatMoney(plan.perSeatActual),
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

    function clickInsuranceNoElement(noBtn) {
        const rect = noBtn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const targets = new Set([noBtn]);
        const doc = noBtn.ownerDocument || document;
        const topEl = doc.elementFromPoint?.(x, y);
        if (topEl && noBtn.contains?.(topEl)) targets.add(topEl);
        Array.from(noBtn.querySelectorAll?.('div,span,svg,path') || [])
            .filter(isVisible)
            .slice(0, 8)
            .forEach(el => targets.add(el));
        let clicked = false;
        for (const target of targets) {
            if (fireFullClick(target, x, y)) clicked = true;
        }
        if (!clicked) clicked = robustClick(noBtn);
        return clicked;
    }

    function checkAndClickInsuranceNo() {
        if (isScriptStopped()) return;
        if (isAutomationLocked()) return;
        if (Date.now() - lastInsuranceClickAt < INSURANCE_COOLDOWN_MS) return;
        const noBtn = getInsuranceNoButton();
        if (!noBtn) return;
        console.log('[AutoTrigger] 인슈어런스 "아니오" decision-panel 감지 → 즉시 클릭');
        if (clickInsuranceNoElement(noBtn)) {
            lastInsuranceClickAt = Date.now();
            insuranceClickCount++;
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
        if (isBettingWindowOpen() && !areBetSeatsReadyForRoundAction()) return false;
        const safety = getWalletTotalBetVariance(getExpectedBetPlan());
        if (getVisibleDecisionPanelInfo().active || safety.status === 'increased' || safety.status === 'ambiguous') return false;
        return isAutoplayRunning() || isAutoplayButtonReady();
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
            if (isBettingWindowOpen() && currentBetSummary.ambiguousCount > 0) {
                lastFailReason = 'bet_amount_unknown_current';
                console.warn('[AutoTrigger] visible chip exists but amount is unknown; recovery paused to avoid double betting');
                return;
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
        checkAndClickInsuranceNo();
    }, INSURANCE_WATCH_INTERVAL_MS);

    // ========== 감시 루프 ==========
    setInterval(() => {
        syncSettingsFromUI();

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
        if (isBettingWindowOpen() && betSummary.ambiguousCount > 0) {
            if (lastFailReason !== 'bet_amount_unknown_current') {
                console.warn('[AutoTrigger] visible chip exists but amount is unknown; wait instead of adding more chips');
            }
            lastFailReason = 'bet_amount_unknown_current';
            return;
        }
        if (isTargetBetTotalMismatch(activeSeatNumbers, expectedPlan)) {
            const expectedTotal = expectedPlan.totalActual;
            const reason = betSummary.total > expectedTotal ? 'bet_total_over_target' : 'bet_total_mismatch';
            console.warn(`[AutoTrigger] 현재 총 베팅 ${formatMoney(betSummary.total)} != 기대 ${formatMoney(expectedTotal)} → 복구`);
            if (markBetStateNeedsRecovery(reason)) runSequence();
            return;
        }

        if (isBetSettingsApplied() && activeSeatNumbers.length > 0 && isBettingWindowOpen() && !areBetSeatsReadyForRoundAction(expectedPlan)) {
            console.warn('[AutoTrigger] betting window open but controlled seats have no valid chips; recovery required');
            if (markBetStateNeedsRecovery('bet_amount_not_detected_current')) runSequence();
            return;
        }

        if (shouldRestartAutoplayForThreshold(roundNumber, activeSeatNumbers)) {
            restartAutoplayForThreshold(roundNumber).catch(e => console.error('[AutoTrigger] threshold restart chain error:', e));
            return;
        }

        checkAndClickDealNow();
        checkAndClickInsuranceNo();

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
        const panel = document.createElement('div');
        panel.id = 'at-panel';
        panel.style.cssText = `
            position: fixed; top: 10px; right: 10px; z-index: 2147483647;
            background: rgba(0,0,0,0.85); color: #fff; padding: 10px 12px;
            border-radius: 8px; font-family: sans-serif; font-size: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5); min-width: 320px;
            user-select: none;
        `;
        panel.innerHTML = `
            <div id="at-header" style="font-weight:bold; margin-bottom:6px; cursor:grab; display:flex; align-items:center; gap:6px;">
                <span style="opacity:0.6;">⠿</span>
                <span>Autoplay Auto Trigger</span>
            </div>
            <div id="at-body">
                <div style="display:grid; grid-template-columns:96px 1fr; gap:5px 6px; align-items:center;">
                    <label for="at-threshold">기준 미만</label>
                    <input id="at-threshold" type="number" min="0" value="${THRESHOLD}" style="width:100%; color:#000; box-sizing:border-box;">
                    <label for="at-bet-amount">총 베팅금액</label>
                    <input id="at-bet-amount" type="number" min="0" step="100" value="${TARGET_BET_AMOUNT}" style="width:100%; color:#000; box-sizing:border-box;">
                    <label for="at-auto-seat">좌석 자동</label>
                    <input id="at-auto-seat" type="checkbox" ${AUTO_SEAT_COUNT ? 'checked' : ''} style="justify-self:start;">
                    <label for="at-seat-count">최대 좌석 수</label>
                    <input id="at-seat-count" type="number" min="1" max="7" value="${SEAT_COUNT}" style="width:100%; color:#000; box-sizing:border-box;">
                </div>
                <div style="margin-top:5px; font-size:10.5px; opacity:0.7;">칩/좌석은 총 베팅금액 기준으로 자동 계산됩니다 (초과 없음, 부족 시 아래 단계로)</div>
                <div id="at-actions" style="margin-top:7px; display:flex; gap:6px; flex-wrap:wrap;">
                    <button id="at-save" style="font-size:11px;">저장</button>
                    <button id="at-setup-bet" style="font-size:11px;">베팅 설정</button>
                    <button id="at-export-log" style="font-size:11px;">로그 내보내기</button>
                    <button id="at-script-toggle" style="font-size:11px;">스크립트 정지</button>
                    <button id="at-reset" style="font-size:11px;">상태 초기화</button>
                </div>
                <div id="at-status" style="margin-top:6px; font-size:11px; opacity:0.85; line-height:1.5;"></div>
            </div>
            <div style="margin-top:4px;"><button id="at-toggle" style="font-size:11px;">숨기기</button></div>
        `;
        document.body.appendChild(panel);
        const header = document.getElementById('at-header');
        makeDraggable(panel, header);

        const saveSettings = () => {
            syncSettingsFromUI();
        };

        const updateScriptToggle = () => {
            const btn = document.getElementById('at-script-toggle');
            if (!btn) return;
            btn.textContent = SCRIPT_ENABLED ? '스크립트 정지' : '스크립트 시작';
            btn.style.background = SCRIPT_ENABLED ? '#fff' : '#ffe08a';
            btn.style.color = '#000';
        };

        document.getElementById('at-save').addEventListener('click', saveSettings);
        ['at-threshold', 'at-bet-amount', 'at-seat-count', 'at-auto-seat'].forEach(id => {
            document.getElementById(id).addEventListener('input', saveSettings);
            document.getElementById(id).addEventListener('change', saveSettings);
        });

        document.getElementById('at-setup-bet').addEventListener('click', () => {
            saveSettings();
            if (isScriptStopped()) {
                console.warn('[AutoTrigger] script stopped; bet setup ignored');
                return;
            }
            setupBetAmount(true).catch(e => console.error('[AutoTrigger] bet setup error:', e));
        });

        document.getElementById('at-export-log').addEventListener('click', () => {
            try {
                exportBetDebugLog();
            } catch (e) {
                console.error('[AutoTrigger] bet log export failed:', e);
            }
        });

        document.getElementById('at-script-toggle').addEventListener('click', () => {
            SCRIPT_ENABLED = !SCRIPT_ENABLED;
            GM_setValue('scriptEnabled', SCRIPT_ENABLED);
            if (SCRIPT_ENABLED) {
                resetTransientState('script_start');
            } else {
                console.log('[AutoTrigger] script stopped (in-flight will drain)');
            }
            updateScriptToggle();
        });
        updateScriptToggle();

        document.getElementById('at-reset').addEventListener('click', () => {
            resetTransientState('manual_reset');
        });

        document.getElementById('at-toggle').addEventListener('click', () => {
            const body = document.getElementById('at-body');
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            document.getElementById('at-toggle').textContent = isHidden ? '숨기기' : '보이기';
        });

        setInterval(() => {
            const n = getRoundNumber();
            const dealEl = qsDeep('[data-testid="deal_now"]');
            const dealVisible = dealEl ? isVisible(dealEl) : false;
            const insEl = qsDeep('[data-id="no"]');
            const insVisible = insEl && (insEl.textContent || '').includes('아니오') ? isVisible(insEl) : false;
            const sitVisible = isSitPromptVisible();
            const status = document.getElementById('at-status');
            if (status) {
                const availableChips = detectAvailableChips();
                const plan = getSeatPlan(getBettableSeats().length, availableChips);
                const expectedPlanForStatus = getExpectedBetPlan();
                const yellowSeatNumbers = getYellowSeatRayNumbers();
                const verifiedSeatNumbers = getControlledSeatNumbers();
                const pendingSeatNumbers = getPendingSitSeatNumbers();
                const setupSeatNumbers = uniqueSortedSeatNumbers(getSetupSeatCandidates().map(getSeatNumber));
                const visibleEmptySeatNumbers = getVisibleEmptySeatNumbers();
                const closeButtonSeatNumbers = getVisibleMainBetSeats().filter(hasSeatCloseButton).map(getSeatNumber);
                const rememberedSeatNumbers = uniqueSortedSeatNumbers(lastTargetSeatNumbers || []);
                const trustedRememberedSeatNumbers = getTrustedRememberedSeatNumbers();
                const runLabel = isRunning ? 'Y' : (isBetSetupRunning ? 'BET' : 'N');
                const ready = isScriptStopped() ? '정지됨' : (isAutoplayRunning() ? '실행중' : (isAutoplayButtonReady() ? '활성' : '비활성'));
                const scriptState = isAutomationLocked() ? '읽기전용' : (SCRIPT_ENABLED ? '켜짐' : '정지');
                const phaseLabel = lastDiagnosedPhase || '—';
                const reasonLabel = lastFailReason ? ` / 실패: <span style="color:#ff9c9c;">${lastFailReason}</span>` : '';
                const chipAvail = availableChips.length > 0
                    ? availableChips.map(c => formatMoney(c.value)).join(', ')
                    : '—';
                const diff = plan.totalTarget - plan.totalActual;
                const diffLabel = diff > 0
                    ? ` <span style="color:#ffd97a;">(부족 ${formatMoney(diff)})</span>`
                    : (plan.totalActual > 0 ? ' <span style="color:#9cffa1;">(정확)</span>' : '');
                const seatModeLabel = AUTO_SEAT_COUNT ? '자동' : '수동';
                const sitLabel = sitVisible
                    ? ' <span style="color:#9cffa1;">(자리에 앉으십시오 감지)</span>'
                    : '';
                const popupLabel = isBlockingPopupVisible()
                    ? ' <span style="color:#ffd97a;">(비활성 중단 팝업 감지)</span>'
                    : '';
                const supportPopupLabel = isSupportReloadPopupVisible()
                    ? ' <span style="color:#ffd97a;">(고객지원 팝업 감지)</span>'
                    : (supportPopupRecoveryPendingAt > 0 ? ' <span style="color:#ffd97a;">(새로고침 복구 대기)</span>' : '');
                const betClickDebugLabel = lastBetClickDebug && Date.now() - lastBetClickDebugAt < 12000
                    ? `베팅클릭: ${lastBetClickDebug}<br>`
                    : '';
                const betGuardLabel = isBetClickGuardActive()
                    ? `베팅가드: ${Math.ceil(Math.max(0, betClickGuardUntil - Date.now()) / 1000)}초 (${lastBetClickGuardReason || 'guard'})<br>`
                    : '';
                const betDebugLogLabel = getBetDebugLogHtml(5);
                // [1.40] 좌석별 실제 인식 금액 — 화면에 보이는 칩과 패널 인식이 다른 케이스를 즉시 감지하기 위함.
                //        '?' 는 칩은 보이지만 금액 인식 실패, '∅' 는 칩 자체가 없음을 의미.
                const verifiedSeatLabel = verifiedSeatNumbers.length ? verifiedSeatNumbers.join(', ') : '—';
                const pendingSeatLabel = pendingSeatNumbers.length ? ` / 대기 ${pendingSeatNumbers.join(', ')}` : '';
                const rememberedSeatLabel = rememberedSeatNumbers.length ? rememberedSeatNumbers.join(', ') : '—';
                const trustedRememberedLabel = trustedRememberedSeatNumbers.length
                    ? ` / 보호 ${trustedRememberedSeatNumbers.join(', ')}${lastTargetSeatMemoryReason ? ` (${lastTargetSeatMemoryReason})` : ''}`
                    : '';
                const displayedSeatNumbers = uniqueSortedSeatNumbers([
                    ...verifiedSeatNumbers,
                    ...(lastTargetSeatNumbers || []),
                ]);
                const statusExpectedSeats = Math.max(1, toInt(expectedPlanForStatus.used, getMaxSeatCount(), 1, 7));
                const canShowPlanInference = displayedSeatNumbers.length === statusExpectedSeats;
                const seatAmounts = displayedSeatNumbers.map(sn => {
                    const seat = getSeatByNumber(sn);
                    if (!seat) return `${sn}=—`;
                    const state = getSeatBetState(seat);
                    if (state.amountDetected) return `${sn}=${formatMoney(state.amount)}`;
                    if (canShowPlanInference && canInferSeatAmountFromPlan(state, expectedPlanForStatus)) {
                        return `${sn}=${formatMoney(expectedPlanForStatus.perSeatActual)}<span style="color:#ffd97a;">*</span>`;
                    }
                    if (state.hasChip) return `${sn}=<span style="color:#ff9c9c;">?</span>`;
                    return `${sn}=∅`;
                }).join(' ');
                const seatAmountsLabel = seatAmounts
                    ? `좌석별 인식: ${seatAmounts}<br>`
                    : '';
                status.innerHTML =
                    `런타임: ${SCRIPT_FRAME_MODE} / 게임 ${SCRIPT_GAME_VERSION} / 로드: ${getScriptLoadLabel()}<br>` +
                    `스크립트: ${scriptState} / 단계: <b>${phaseLabel}</b>${reasonLabel}<br>` +
                    `라운드: ${n ?? '—'} / 기준: ${THRESHOLD} / 버튼: ${ready} / 실행: ${runLabel}${sitLabel}${popupLabel}${supportPopupLabel}<br>` +
                    `노란좌석: ${yellowSeatNumbers.length ? yellowSeatNumbers.join(', ') : '—'}<br>` +
                    `후보시트: ${setupSeatNumbers.length ? setupSeatNumbers.join(', ') : '—'} / 빈시트: ${visibleEmptySeatNumbers.length ? visibleEmptySeatNumbers.join(', ') : '—'}<br>` +
                    `닫기버튼: ${closeButtonSeatNumbers.length ? closeButtonSeatNumbers.join(', ') : '—'}<br>` +
                    `실제앉음: ${verifiedSeatNumbers.length}/${getMaxSeatCount()} (${verifiedSeatLabel}${pendingSeatLabel})<br>` +
                    `기억좌석: ${rememberedSeatLabel}${trustedRememberedLabel}<br>` +
                    `계획좌석(${seatModeLabel}): ${plan.used}/${plan.requested} (가능 ${plan.available}) / 좌석당 목표 ${formatMoney(plan.perSeatTarget)} → 실제 ${formatMoney(plan.perSeatActual)}<br>` +
                    betClickDebugLabel +
                    betGuardLabel +
                    seatAmountsLabel +
                    `분배: ${formatChipPlan(plan.chipPlan)}<br>` +
                    `총: 목표 ${formatMoney(plan.totalTarget)} → 실제 ${formatMoney(plan.totalActual)}${diffLabel}<br>` +
                    `감지칩: ${chipAvail}<br>` +
                    betDebugLogLabel +
                    `오토100: ${autoplayStartCount} / 중지: ${autoplayStopCount} / 재활성: ${autoplayRearmCount} / 기준재시작: ${autoplayThresholdRestartCount} / 팝업해제: ${blockingPopupDismissCount} / 고객확인: ${supportPopupConfirmCount} / 베팅설정: ${betSetupCount} / 앉기트리거: ${sitPromptTriggerCount} / 딜: ${dealClickCount}${dealVisible ? ' (보임)' : ''} / 보험: ${insuranceClickCount}${insVisible ? ' (보임)' : ''}`;
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }

})();
