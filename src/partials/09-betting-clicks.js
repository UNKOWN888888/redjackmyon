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
