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
