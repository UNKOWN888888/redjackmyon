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
