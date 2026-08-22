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

            const currentBetSummary = getTargetSeatBetSummary(targetSeatNumbers, plan);
            if (isBetSummaryMatchingPlan(currentBetSummary, plan)) {
                const existingWalletVariance = getWalletTotalBetVariance(plan);
                if (existingWalletVariance.status === 'exact') {
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
            let expectedAppliedPerSeat = 0;
            for (const spec of plan.chipPlan) {
                if (isScriptStopped()) { failReason = 'stopped'; return false; }
                if (getBetSettingsKey() !== setupSettingsKey) {
                    failReason = 'settings_changed_during_bet_setup';
                    return false;
                }
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
                if (!(await clickMainBetChipBroadcastVerified(
                    targetSeatNumbers,
                    spec.value,
                    spec.count,
                    plan.perSeatActual,
                    {
                        expectedBasePerSeatAmount: expectedAppliedPerSeat,
                        expectedWalletBaseAmount: expectedAppliedPerSeat * targetSeatNumbers.length,
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
