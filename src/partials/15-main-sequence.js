    // ========== 메인 시퀀스 ==========
    async function runSequence() {
        if (typeof isSettingsInputPending === 'function' && isSettingsInputPending()) return;
        syncSettingsFromUI();
        if (typeof isAutoplayStartConfirmationPending === 'function' && isAutoplayStartConfirmationPending()) return;
        if (typeof isAutoplayStartTransitionGuardActive === 'function' && isAutoplayStartTransitionGuardActive()) return;
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
            if (!ensureBetSetupWalletReady('sequence', {
                phase: lastDiagnosedPhase || 'unknown',
                seats: activeSeatNumbers.join(','),
            })) return;
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
            markAutoplayModalAction();
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
                if (!robustClick(startBtn)) {
                    pushBetLog('error', 'autoplay_start_dispatch_failed', {
                        rounds: AUTOPLAY_START_ROUNDS,
                        target: getElementLabel(startBtn),
                    });
                    markAutoplayOnlyRecovery('autoplay_start_dispatch_failed', {
                        context: 'sequence',
                    });
                    return;
                }
                autoplayStartCount++;
                clicked = true;
                beginAutoplayStartConfirmation('sequence', {
                    rounds: AUTOPLAY_START_ROUNDS,
                });
                console.log(`[AutoTrigger] autoplay ${AUTOPLAY_START_ROUNDS} rounds clicked`);
                const confirmation = await waitForAutoplayStartConfirmation('sequence');
                if (!confirmation.confirmed) {
                    succeeded = true;
                    return;
                }
                pushBetLog('info', 'autoplay_count_detected', {
                    round: confirmation.round !== null ? confirmation.round : 'not_visible',
                    signal: confirmation.signal,
                });
                setBetRuntimeStage('running', {
                    round: confirmation.round !== null ? confirmation.round : '확인 중',
                    threshold: THRESHOLD,
                });
            } else {
                console.warn(`[AutoTrigger] ${AUTOPLAY_START_ROUNDS} rounds start button not found`);
                pushBetLog('error', 'autoplay_start_button_missing', {
                    selector: startSelector,
                });
                markAutoplayOnlyRecovery('start_btn_missing', {
                    context: 'sequence',
                });
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
