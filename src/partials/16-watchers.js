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
                console.warn(`[AutoTrigger] 좌석 금액 미인식 + 지갑 상태 ${recovery.variance.status} ${formatMoney(recovery.variance.reading.amount)}/${formatMoney(recovery.variance.expected)} → 재설정`);
                if (markBetStateNeedsRecovery(recovery.reason)) runSequence();
                return;
            }
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

        if (isBetSettingsApplied() && activeSeatNumbers.length > 0 && isBettingWindowOpen() && !walletConfirmed && !areBetSeatsReadyForRoundAction(expectedPlan)) {
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
