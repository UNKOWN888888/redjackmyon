    // ========== UI ==========
    function createUI() {
        if (document.getElementById('at-panel')) return;

        if (!document.getElementById('at-panel-style')) {
            const style = document.createElement('style');
            style.id = 'at-panel-style';
            style.textContent = `
                #at-panel, #at-panel * { box-sizing: border-box; letter-spacing: 0; }
                #at-panel {
                    position: fixed; top: 10px; right: 10px; z-index: 2147483647;
                    width: 430px; max-width: calc(100vw - 20px); max-height: calc(100vh - 20px);
                    overflow: hidden; color: #f3f5f7; background: rgba(18, 20, 23, 0.96);
                    border: 1px solid #3c4249; border-radius: 6px;
                    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.48);
                    font-family: Arial, "Malgun Gothic", sans-serif; font-size: 12px; line-height: 1.42;
                }
                #at-header {
                    min-height: 52px; padding: 9px 10px; cursor: grab;
                    display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    background: #20242a; border-bottom: 1px solid #3c4249;
                }
                #at-header:active { cursor: grabbing; }
                .at-brand { min-width: 0; }
                .at-title-line { display: flex; align-items: center; gap: 7px; min-width: 0; }
                .at-title { font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; }
                .at-version {
                    display: inline-flex; align-items: center; min-height: 20px; padding: 2px 6px;
                    border: 1px solid #3f8f68; border-radius: 4px; color: #b9f1cf; background: #173225;
                    font-size: 11px; font-weight: 700; white-space: nowrap;
                }
                .at-source { margin-top: 2px; color: #aeb5bd; font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                #at-toggle {
                    flex: 0 0 auto; min-width: 46px; height: 28px; border: 1px solid #555d66;
                    border-radius: 4px; color: #e6e9ec; background: #2d3238; font-size: 11px; cursor: pointer;
                }
                #at-body { max-height: calc(100vh - 74px); overflow: auto; scrollbar-width: thin; }
                .at-section { padding: 10px; border-bottom: 1px solid #343941; }
                .at-section:last-child { border-bottom: 0; }
                .at-section-title { margin: 0 0 7px; color: #cbd1d7; font-size: 10.5px; font-weight: 700; text-transform: uppercase; }
                .at-settings { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .at-field { display: grid; gap: 4px; min-width: 0; }
                .at-field label { color: #cbd1d7; font-size: 11px; }
                .at-field input[type="number"] {
                    width: 100%; height: 31px; padding: 4px 7px; border: 1px solid #59616a;
                    border-radius: 4px; outline: 0; color: #111315; background: #f5f6f7; font-size: 12px;
                }
                .at-field input[type="number"]:focus { border-color: #e4b84b; box-shadow: 0 0 0 2px rgba(228, 184, 75, 0.2); }
                .at-check {
                    height: 31px; padding: 0 8px; display: flex; align-items: center; gap: 7px;
                    border: 1px solid #515861; border-radius: 4px; color: #eef1f3; background: #272c32;
                }
                .at-check input { width: 16px; height: 16px; margin: 0; accent-color: #2da56b; }
                .at-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 9px; }
                .at-button {
                    min-width: 0; min-height: 31px; padding: 5px 7px; border: 1px solid #5a626c;
                    border-radius: 4px; color: #f4f6f7; background: #30363d; font-size: 11px; cursor: pointer;
                    white-space: normal; overflow-wrap: anywhere;
                }
                .at-button:hover { background: #3a4149; }
                .at-button.at-primary { border-color: #3d9767; background: #216743; }
                .at-button.at-primary:hover { background: #287a50; }
                .at-button.at-danger { border-color: #b85c60; background: #71373a; }
                .at-live-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
                .at-state-badge {
                    flex: 0 0 auto; min-width: 48px; padding: 3px 6px; border-radius: 4px;
                    text-align: center; color: #dfe3e7; background: #555d66; font-size: 10.5px; font-weight: 700;
                }
                .at-state-badge[data-tone="ok"] { color: #c8f5d8; background: #246444; }
                .at-state-badge[data-tone="work"] { color: #fff0bd; background: #765c1d; }
                .at-state-badge[data-tone="error"] { color: #ffd6d7; background: #7d373b; }
                .at-stage { min-width: 0; color: #ffffff; font-size: 13px; overflow-wrap: anywhere; }
                .at-failure {
                    display: none; margin-top: 7px; padding: 7px 8px; border-left: 3px solid #d7686d;
                    color: #ffd5d7; background: #3b2427; overflow-wrap: anywhere; user-select: text;
                }
                .at-failure.is-visible { display: block; }
                .at-failure-code { display: block; margin-top: 2px; color: #dfaeb0; font: 10px Consolas, monospace; }
                .at-progress-wrap { margin-top: 9px; }
                .at-progress-label { display: flex; justify-content: space-between; gap: 8px; color: #c8ced4; font-size: 10.5px; }
                .at-progress-track { height: 7px; margin-top: 4px; overflow: hidden; border-radius: 3px; background: #3a4047; }
                .at-progress-fill { width: 0; height: 100%; background: #d2a83e; transition: width 120ms linear; }
                .at-progress-fill.is-exact { background: #39a970; }
                .at-progress-fill.is-over { background: #d35f64; }
                .at-kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 12px; margin-top: 9px; }
                .at-kv { min-width: 0; }
                .at-kv-label { color: #929aa3; font-size: 10px; }
                .at-kv-value { margin-top: 1px; color: #f4f6f7; font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
                .at-plan-line { color: #e9ecef; overflow-wrap: anywhere; }
                .at-plan-line + .at-plan-line { margin-top: 4px; }
                .at-muted { color: #9ca4ac; }
                .at-details { padding: 0; border-bottom: 1px solid #343941; }
                .at-details summary { padding: 9px 10px; color: #d7dce1; cursor: pointer; font-weight: 700; }
                .at-details-content { padding: 0 10px 10px; color: #bbc2c9; user-select: text; }
                .at-detail-row { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 8px; padding: 2px 0; }
                .at-detail-label { color: #858e98; }
                .at-detail-value { color: #dce0e4; overflow-wrap: anywhere; }
                .at-log-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
                .at-log-head .at-section-title { margin: 0; }
                .at-log-count { color: #929aa3; font-size: 10px; }
                #at-log-list { max-height: 168px; overflow: auto; padding-right: 3px; user-select: text; }
                .at-log-row { padding: 5px 0; border-top: 1px solid #30353b; }
                .at-log-row:first-child { border-top: 0; padding-top: 0; }
                .at-log-line { display: grid; grid-template-columns: 7px 84px 66px minmax(0, 1fr); gap: 4px; align-items: start; }
                .at-log-dot { width: 6px; height: 6px; margin-top: 4px; border-radius: 50%; background: #64a8c9; }
                .at-log-warn .at-log-dot { background: #e0b84f; }
                .at-log-error .at-log-dot { background: #df6d72; }
                .at-log-time, .at-log-stage { color: #89929b; font: 9.5px Consolas, monospace; }
                .at-log-message { color: #dfe3e6; font: 10px Consolas, monospace; overflow-wrap: anywhere; }
                .at-log-data { margin: 2px 0 0 11px; color: #9fa8b1; font: 9.5px Consolas, monospace; overflow-wrap: anywhere; }
                .at-log-empty { color: #89929b; font-size: 10.5px; }
                @media (max-width: 520px) {
                    #at-panel { top: 6px; right: 6px; max-width: calc(100vw - 12px); max-height: calc(100vh - 12px); }
                    #at-body { max-height: calc(100vh - 66px); }
                    .at-log-line { grid-template-columns: 7px 79px minmax(0, 1fr); }
                    .at-log-stage { display: none; }
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        }

        const panel = document.createElement('div');
        panel.id = 'at-panel';
        panel.innerHTML = `
            <div id="at-header">
                <div class="at-brand">
                    <div class="at-title-line">
                        <span class="at-title">Autoplay Auto Trigger</span>
                        <span class="at-version">v${escapeHtml(SCRIPT_VERSION)}</span>
                    </div>
                    <div id="at-source" class="at-source">${escapeHtml(getScriptLoadLabel())}</div>
                </div>
                <button id="at-toggle" type="button" aria-label="패널 접기">접기</button>
            </div>
            <div id="at-body">
                <section class="at-section">
                    <div class="at-section-title">베팅 설정</div>
                    <div class="at-settings">
                        <div class="at-field">
                            <label for="at-threshold">기준 미만</label>
                            <input id="at-threshold" type="number" min="0" value="${THRESHOLD}">
                        </div>
                        <div class="at-field">
                            <label for="at-bet-amount">총 베팅금액</label>
                            <input id="at-bet-amount" type="number" min="0" step="100" value="${TARGET_BET_AMOUNT}">
                        </div>
                        <div class="at-field">
                            <label for="at-auto-seat">좌석 계산 방식</label>
                            <label class="at-check"><input id="at-auto-seat" type="checkbox" ${AUTO_SEAT_COUNT ? 'checked' : ''}>자동 계산</label>
                        </div>
                        <div class="at-field">
                            <label for="at-seat-count">최대 좌석 수</label>
                            <input id="at-seat-count" type="number" min="1" max="7" value="${SEAT_COUNT}">
                        </div>
                    </div>
                    <div class="at-actions">
                        <button id="at-save" class="at-button" type="button">저장</button>
                        <button id="at-setup-bet" class="at-button at-primary" type="button">베팅 설정</button>
                        <button id="at-export-log" class="at-button" type="button">로그 내보내기</button>
                        <button id="at-script-toggle" class="at-button" type="button">스크립트 정지</button>
                        <button id="at-reset" class="at-button" type="button">상태 초기화</button>
                    </div>
                </section>

                <section class="at-section">
                    <div class="at-live-head">
                        <span id="at-state-badge" class="at-state-badge">대기</span>
                        <strong id="at-stage" class="at-stage">대기</strong>
                    </div>
                    <div id="at-failure" class="at-failure"></div>
                    <div class="at-progress-wrap">
                        <div class="at-progress-label"><span>지갑 총 베팅</span><span id="at-wallet-label">확인 중</span></div>
                        <div class="at-progress-track"><div id="at-progress-fill" class="at-progress-fill"></div></div>
                    </div>
                    <div class="at-kv-grid">
                        <div class="at-kv"><div class="at-kv-label">좌석</div><div id="at-seat-summary" class="at-kv-value">확인 중</div></div>
                        <div class="at-kv"><div class="at-kv-label">자동베팅</div><div id="at-autoplay-summary" class="at-kv-value">확인 중</div></div>
                        <div class="at-kv"><div class="at-kv-label">검증된 진행</div><div id="at-verified-progress" class="at-kv-value">없음</div></div>
                        <div class="at-kv"><div class="at-kv-label">선택 / 다음 칩</div><div id="at-chip-progress" class="at-kv-value">확인 중</div></div>
                    </div>
                </section>

                <section class="at-section">
                    <div class="at-section-title">계산 결과</div>
                    <div id="at-plan-summary"></div>
                </section>

                <details class="at-details">
                    <summary>좌석 및 감지 상세</summary>
                    <div id="at-detail-content" class="at-details-content"></div>
                </details>

                <section class="at-section">
                    <div class="at-log-head">
                        <div class="at-section-title">최근 실행 로그</div>
                        <span id="at-log-count" class="at-log-count">0건</span>
                    </div>
                    <div id="at-log-list"></div>
                </section>
            </div>
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
            btn.classList.toggle('at-danger', SCRIPT_ENABLED);
            btn.classList.toggle('at-primary', !SCRIPT_ENABLED);
        };

        document.getElementById('at-save').addEventListener('click', saveSettings);
        ['at-threshold', 'at-bet-amount', 'at-seat-count', 'at-auto-seat'].forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('input', queueSettingsSave);
            input.addEventListener('change', saveSettings);
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
                setBetRuntimeStage('stopped', { reason: 'manual_stop' });
                console.log('[AutoTrigger] script stopped (in-flight will drain)');
            }
            updateScriptToggle();
        });
        updateScriptToggle();

        document.getElementById('at-reset').addEventListener('click', () => {
            resetTransientState('manual_reset');
        });

        const toggleButton = document.getElementById('at-toggle');
        toggleButton.addEventListener('mousedown', event => event.stopPropagation());
        toggleButton.addEventListener('click', event => {
            event.stopPropagation();
            const body = document.getElementById('at-body');
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            toggleButton.textContent = isHidden ? '접기' : '펼치기';
            toggleButton.setAttribute('aria-label', isHidden ? '패널 접기' : '패널 펼치기');
        });

        const updateUI = () => {
            const roundNumber = getRoundNumber();
            const availableChips = detectAvailableChips();
            const expectedPlan = getExpectedBetPlan();
            const wallet = getWalletTotalBetReading();
            const yellowSeatNumbers = getYellowSeatRayNumbers();
            const verifiedSeatNumbers = getControlledSeatNumbers();
            const pendingSeatNumbers = getPendingSitSeatNumbers();
            const setupSeatNumbers = uniqueSortedSeatNumbers(getSetupSeatCandidates().map(getSeatNumber));
            const visibleEmptySeatNumbers = getVisibleEmptySeatNumbers();
            const closeButtonSeatNumbers = getVisibleMainBetSeats().filter(hasSeatCloseButton).map(getSeatNumber);
            const rememberedSeatNumbers = uniqueSortedSeatNumbers(lastTargetSeatNumbers || []);
            const trustedRememberedSeatNumbers = getTrustedRememberedSeatNumbers();
            const displaySeatNumbers = uniqueSortedSeatNumbers([
                ...verifiedSeatNumbers,
                ...rememberedSeatNumbers,
            ]);
            const activeProgress = verifiedBetProgress;

            document.getElementById('at-source').textContent = `${getScriptLoadLabel()} / 게임 ${SCRIPT_GAME_VERSION} / ${SCRIPT_FRAME_MODE}`;

            let stateText = '대기';
            let stateTone = 'idle';
            if (isScriptStopped()) {
                stateText = '정지';
            } else if (isBetClickGuardActive() || betRuntimeStage === 'blocked') {
                stateText = '중단';
                stateTone = 'error';
            } else if (isRunning || isBetSetupRunning) {
                stateText = '실행';
                stateTone = 'work';
            } else if (isAutoplayRunning()) {
                stateText = '정상';
                stateTone = 'ok';
            } else if (lastFailReason) {
                stateText = '복구';
                stateTone = 'work';
            }
            const badge = document.getElementById('at-state-badge');
            badge.textContent = stateText;
            badge.dataset.tone = stateTone;
            document.getElementById('at-stage').textContent = getBetRuntimeStageLabel();

            const failure = document.getElementById('at-failure');
            if (lastFailReason) {
                failure.classList.add('is-visible');
                failure.innerHTML = `${escapeHtml(getFailReasonLabel(lastFailReason))}<span class="at-failure-code">${escapeHtml(lastFailReason)}</span>`;
            } else {
                failure.classList.remove('is-visible');
                failure.textContent = '';
            }

            const expectedTotal = Number.isFinite(expectedPlan.totalActual) ? expectedPlan.totalActual : TARGET_BET_AMOUNT;
            const walletAmount = wallet.detected && !wallet.ambiguous && Number.isFinite(wallet.amount) ? wallet.amount : null;
            const progressRatio = expectedTotal > 0 && Number.isFinite(walletAmount)
                ? Math.min(100, Math.max(0, walletAmount / expectedTotal * 100))
                : 0;
            const progressFill = document.getElementById('at-progress-fill');
            progressFill.style.width = `${progressRatio}%`;
            progressFill.classList.toggle('is-exact', walletAmount === expectedTotal && expectedTotal > 0);
            progressFill.classList.toggle('is-over', Number.isFinite(walletAmount) && walletAmount > expectedTotal);
            document.getElementById('at-wallet-label').textContent = Number.isFinite(walletAmount)
                ? `${formatMoney(walletAmount)} / ${formatMoney(expectedTotal)}원`
                : `미인식 / ${formatMoney(expectedTotal)}원`;

            const plannedSeats = Math.max(1, toInt(expectedPlan.used, getMaxSeatCount(), 1, 7));
            document.getElementById('at-seat-summary').textContent = `${verifiedSeatNumbers.length}/${plannedSeats} (${verifiedSeatNumbers.join(', ') || '없음'})`;
            const autoplayState = isAutoplayRunning()
                ? `${roundNumber ?? '실행 중'}회`
                : (isAutoplayButtonReady() ? '시작 가능' : '대기');
            document.getElementById('at-autoplay-summary').textContent = autoplayState;

            document.getElementById('at-verified-progress').textContent = activeProgress
                ? `${formatMoney(activeProgress.walletAmount)}원 / 좌석당 ${formatMoney(activeProgress.perSeatApplied)}원`
                : '없음';
            const selectedChip = getEffectiveSelectedChipAmount();
            document.getElementById('at-chip-progress').textContent = `${selectedChip > 0 ? formatMoney(selectedChip) : '미인식'} / ${activeProgress?.nextChip ? formatMoney(activeProgress.nextChip) : '없음'}`;

            const difference = expectedPlan.totalTarget - expectedPlan.totalActual;
            const differenceText = difference > 0 ? `, 목표보다 ${formatMoney(difference)}원 부족` : ', 정확';
            document.getElementById('at-plan-summary').innerHTML = `
                <div class="at-plan-line"><strong>${expectedPlan.used}/${expectedPlan.requested}좌석</strong> · 좌석당 ${formatMoney(expectedPlan.perSeatActual)}원 · 총 ${formatMoney(expectedPlan.totalActual)}원<span class="at-muted">${differenceText}</span></div>
                <div class="at-plan-line"><span class="at-muted">칩 순서</span> ${escapeHtml(formatChipPlan(expectedPlan.chipPlan))}</div>
                <div class="at-plan-line"><span class="at-muted">감지 칩</span> ${escapeHtml(availableChips.length ? availableChips.map(chip => formatMoney(chip.value)).join(', ') : '없음')}</div>
            `;

            const seatAmounts = displaySeatNumbers.map(seatNumber => {
                const seat = getSeatByNumber(seatNumber);
                if (!seat) return `${seatNumber}=없음`;
                const state = getSeatBetState(seat);
                if (state.amountDetected) return `${seatNumber}=${formatMoney(state.amount)}`;
                return `${seatNumber}=${state.hasChip ? '금액 미인식' : '칩 없음'}`;
            }).join(' / ') || '없음';
            const guardText = isBetClickGuardActive()
                ? `${Math.ceil(Math.max(0, betClickGuardUntil - Date.now()) / 1000)}초 / ${lastBetClickGuardReason || '검증 대기'}`
                : '없음';
            document.getElementById('at-detail-content').innerHTML = `
                <div class="at-detail-row"><span class="at-detail-label">단계 코드</span><span class="at-detail-value">${escapeHtml(lastDiagnosedPhase || '없음')} / ${escapeHtml(betRuntimeStage)}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">좌석별 금액</span><span class="at-detail-value">${escapeHtml(seatAmounts)}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">기억 좌석</span><span class="at-detail-value">${escapeHtml(rememberedSeatNumbers.join(', ') || '없음')} / 보호 ${escapeHtml(trustedRememberedSeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">노란 좌석</span><span class="at-detail-value">${escapeHtml(yellowSeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">후보 / 빈 좌석</span><span class="at-detail-value">${escapeHtml(setupSeatNumbers.join(', ') || '없음')} / ${escapeHtml(visibleEmptySeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">닫기 버튼</span><span class="at-detail-value">${escapeHtml(closeButtonSeatNumbers.join(', ') || '없음')} / 대기 ${escapeHtml(pendingSeatNumbers.join(', ') || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">베팅 가드</span><span class="at-detail-value">${escapeHtml(guardText)}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">최근 클릭</span><span class="at-detail-value">${escapeHtml(lastBetClickDebug || '없음')}</span></div>
                <div class="at-detail-row"><span class="at-detail-label">누적 실행</span><span class="at-detail-value">베팅 ${betSetupCount}, 오토100 ${autoplayStartCount}, 재활성 ${autoplayRearmCount}, 기준재시작 ${autoplayThresholdRestartCount}, 보험 ${insuranceClickCount}</span></div>
            `;

            document.getElementById('at-log-list').innerHTML = getBetDebugLogHtml(10);
            document.getElementById('at-log-count').textContent = `${betDebugLog.length}건`;
            updateScriptToggle();
        };

        updateUI();
        setInterval(updateUI, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }
