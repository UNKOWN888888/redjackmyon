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
            btn.style.background = SCRIPT_ENABLED ? '#fff' : '#ffe08a';
            btn.style.color = '#000';
        };

        document.getElementById('at-save').addEventListener('click', saveSettings);
        ['at-threshold', 'at-bet-amount', 'at-seat-count', 'at-auto-seat'].forEach(id => {
            document.getElementById(id).addEventListener('input', queueSettingsSave);
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
            const insEl = getInsuranceNoButton();
            const insVisible = !!insEl;
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
