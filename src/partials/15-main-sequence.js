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
