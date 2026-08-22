    // ========== [1.38] "비활성 중단" 팝업 자동 해제 ==========
    // data-testid="blocking-popup-content" + "비활성 중단" 텍스트가 보이면
    // 화면 아무 곳이나 클릭해 계속 진행. 자동 베팅이 멈춰있으면 그 후
    // 메인 루프가 자동 베팅을 다시 켜는 흐름으로 자연스럽게 이어짐.
    function findBlockingPopup() {
        for (const el of qsaDeep('[data-testid="blocking-popup-content"]')) {
            if (!isVisible(el)) continue;
            const text = (el.textContent || '').replace(/\s+/g, '');
            // "비활성 중단" 또는 "아무 곳이나 클릭해 계속하기" 둘 중 하나만 있어도 매칭
            if (text.includes('비활성중단') || text.includes('아무곳이나클릭')) return el;
        }
        return null;
    }

    function findSupportReloadPopup() {
        for (const el of qsaDeep('[data-testid="blocking-popup-content"],[data-testid="popup-content"]')) {
            if (!isVisible(el)) continue;
            const text = (el.textContent || '').replace(/\s+/g, '');
            if (!text.includes('고객지원') && !text.includes('도움이필요하면')) continue;
            if (!text.includes('확인')) continue;

            const buttons = Array.from(el.querySelectorAll('button,[role="button"],[data-testid="button"]'));
            const confirmButton = buttons.find(btn =>
                isVisible(btn) &&
                !isDisabledLike(btn) &&
                ((btn.textContent || '').replace(/\s+/g, '').includes('확인'))
            );
            return { popup: el, button: confirmButton || el };
        }
        return null;
    }

    function isBlockingPopupVisible() {
        return !!findBlockingPopup();
    }

    function isSupportReloadPopupVisible() {
        return !!findSupportReloadPopup();
    }

    function markSupportPopupReloadRecovery(reason = 'support_popup_confirm') {
        supportPopupRecoveryPendingAt = Date.now();
        GM_setValue('supportPopupRecoveryPendingAt', supportPopupRecoveryPendingAt);
        lastAppliedBetSettingsKey = '';
        GM_setValue('lastAppliedBetSettingsKey', '');
        betSettingsDirty = true;
        autoBetArmed = false;
        lastBetSetupAt = 0;
        lastTriggerAt = 0;
        lastRecoveryAt = 0;
        lastFailReason = reason;
    }

    function clearSupportPopupReloadRecovery(reason = 'done') {
        if (supportPopupRecoveryPendingAt <= 0) return;
        supportPopupRecoveryPendingAt = 0;
        GM_setValue('supportPopupRecoveryPendingAt', 0);
        console.log(`[AutoTrigger] support popup recovery cleared: ${reason}`);
    }

    function dismissSupportReloadPopupIfPresent() {
        if (Date.now() - lastBlockingPopupClickAt < BLOCKING_POPUP_CLICK_COOLDOWN_MS) return false;
        const found = findSupportReloadPopup();
        if (!found) return false;

        console.log('[AutoTrigger] 고객지원 확인 팝업 감지 → 확인 클릭 후 새로고침 복구 예약');
        lastBlockingPopupClickAt = Date.now();
        markSupportPopupReloadRecovery('support_popup_confirm_pending_reload');
        robustClick(found.button);
        blockingPopupDismissCount++;
        supportPopupConfirmCount++;
        return true;
    }

    function handleSupportPopupReloadRecovery(phaseHint = null) {
        if (supportPopupRecoveryPendingAt <= 0) return false;
        const age = Date.now() - supportPopupRecoveryPendingAt;
        if (age > SUPPORT_POPUP_RECOVERY_TTL_MS) {
            clearSupportPopupReloadRecovery('expired');
            return false;
        }
        if (isScriptStopped() || isRunning || isBetSetupRunning || isAutomationLocked()) return false;

        if (isAutoplayRunning() && isBetSettingsApplied()) {
            clearSupportPopupReloadRecovery('autoplay_running');
            return false;
        }

        const phase = phaseHint || diagnosePhase();
        if (phase === Phase.NO_TABLE || phase === Phase.STOPPED) {
            lastFailReason = 'support_popup_waiting_table';
            return false;
        }

        const controlledSeats = getControlledSeatNumbers();
        if (phase === Phase.NO_CHIPS) {
            if (controlledSeats.length > 0) {
                lastFailReason = 'support_popup_waiting_chips';
                return false;
            }
            if (Date.now() - lastSupportPopupRecoveryAttemptAt >= SUPPORT_POPUP_RECOVERY_RETRY_MS) {
                lastSupportPopupRecoveryAttemptAt = Date.now();
                sitAvailableSeatsFirst('support_popup_seat_first').catch(e => console.error('[AutoTrigger] support popup seat-first error:', e));
                return true;
            }
            return false;
        }

        if (Date.now() - lastSupportPopupRecoveryAttemptAt < SUPPORT_POPUP_RECOVERY_RETRY_MS) return false;
        lastSupportPopupRecoveryAttemptAt = Date.now();
        console.log('[AutoTrigger] 새로고침 복구 → 좌석/칩 검증 후 오토100 재시작');
        betSettingsDirty = true;
        autoBetArmed = false;
        lastBetSetupAt = 0;
        lastTriggerAt = 0;
        lastAppliedBetSettingsKey = '';
        GM_setValue('lastAppliedBetSettingsKey', '');
        lastFailReason = 'support_popup_recovery_run';
        runSequence().catch(e => console.error('[AutoTrigger] support popup recovery error:', e));
        return true;
    }

    function dismissBlockingPopupIfPresent() {
        if (Date.now() - lastBlockingPopupClickAt < BLOCKING_POPUP_CLICK_COOLDOWN_MS) return false;
        const popup = findBlockingPopup();
        if (!popup) return false;

        console.log('[AutoTrigger] "비활성 중단" 팝업 감지 → 아무곳이나 클릭');
        lastBlockingPopupClickAt = Date.now();

        // 1) 팝업 자체 클릭 (가장 직접적)
        const rect = popup.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        fireFullClick(popup, cx, cy);

        // 첫 클릭으로 팝업이 닫혔다면 여기서 종료해 아래 게임 화면 오클릭을 막음.
        if (!findBlockingPopup()) {
            blockingPopupDismissCount++;
            return true;
        }

        // 2) 팝업이 여전히 보일 때만 ownerDocument body 중앙 클릭 (백업)
        const doc = popup.ownerDocument || document;
        const win = doc.defaultView || window;
        const body = doc.body || doc.documentElement;
        if (body) {
            const bodyRect = body.getBoundingClientRect();
            const bx = (bodyRect.left + bodyRect.right) / 2 || (win.innerWidth || 0) / 2;
            const by = (bodyRect.top + bodyRect.bottom) / 2 || (win.innerHeight || 0) / 2;
            fireFullClick(body, bx, by);
        }

        blockingPopupDismissCount++;
        return true;
    }
