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
