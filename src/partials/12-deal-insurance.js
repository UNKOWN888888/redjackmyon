    // ========== 딜/보험 ==========
    function checkAndClickDealNow() {
        if (isScriptStopped()) return;
        if (isAutomationLocked()) return;
        if (isRunning || isBetSetupRunning || betSettingsDirty) return;
        if (Date.now() - lastDealClickAt < DEAL_COOLDOWN_MS) return;
        if (!areBetSeatsReadyForRoundAction()) return;
        const dealBtn = qsDeep('[data-testid="deal_now"]');
        if (!dealBtn || !isVisible(dealBtn)) return;
        console.log('[AutoTrigger] "지금 딜" → 클릭');
        robustClick(dealBtn);
        lastDealClickAt = Date.now();
        dealClickCount++;
    }

    function isInsuranceNoEnabled(el) {
        if (!el || !isVisible(el)) return false;
        if (el.getAttribute?.('data-disabled') === 'true') return false;
        if (el.getAttribute?.('aria-disabled') === 'true') return false;
        const win = el.ownerDocument?.defaultView || window;
        const style = win.getComputedStyle?.(el);
        if (style?.pointerEvents === 'none') return false;
        return !isDisabledLike(el);
    }

    function getInsuranceNoButton() {
        for (const el of qsaDeep('[data-testid="bj-decision-panel"] [data-id="no"]')) {
            if (isInsuranceNoEnabled(el)) return el;
        }
        for (const el of qsaDeep('[data-id="no"]')) {
            if (!isInsuranceNoEnabled(el)) continue;
            if (!(el.textContent || '').includes('아니오')) continue;
            return el;
        }
        return null;
    }

    function getInsuranceNoClickTarget(noBtn) {
        if (!noBtn) return null;
        const rect = noBtn.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) return noBtn;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = noBtn.ownerDocument?.elementFromPoint?.(x, y);
        if (hit && (hit === noBtn || noBtn.contains?.(hit))) return hit;
        return noBtn;
    }

    function clickInsuranceNoElement(noBtn, attempt = 0) {
        if (!noBtn || !isInsuranceNoEnabled(noBtn)) return false;
        const root = noBtn.closest?.('[data-id="no"]') || noBtn;
        const rect = root.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) return false;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const target = getInsuranceNoClickTarget(root);
        const profile = attempt === 0 ? 'mouse' : 'touch';
        return fireFullClick(target, x, y, {
            profile,
            touch: profile === 'touch',
            nativeClick: false,
        });
    }

    async function waitForInsuranceNoResolved() {
        return waitForCondition(() => !getInsuranceNoButton(), INSURANCE_CLICK_VERIFY_MS, 10);
    }

    async function checkAndClickInsuranceNo() {
        if (isScriptStopped()) return false;
        if (isAutomationLocked()) return false;
        if (insuranceClickInFlight) return false;
        if (Date.now() - lastInsuranceClickAt < INSURANCE_COOLDOWN_MS) return false;
        const noBtn = getInsuranceNoButton();
        if (!noBtn) return false;

        insuranceClickInFlight = true;
        try {
            console.log('[AutoTrigger] 인슈어런스 "아니오" decision-panel 감지 → 즉시 클릭');
            for (let attempt = 0; attempt < INSURANCE_CLICK_MAX_ATTEMPTS; attempt++) {
                const current = getInsuranceNoButton();
                if (!current) {
                    insuranceClickCount++;
                    return true;
                }
                const clickSent = clickInsuranceNoElement(current, attempt);
                if (!clickSent) continue;

                lastInsuranceClickAt = Date.now();
                pushBetLog('info', 'insurance_no_click_try', {
                    attempt: attempt + 1,
                    profile: attempt === 0 ? 'mouse' : 'touch',
                    target: getElementLabel(current),
                });
                if (await waitForInsuranceNoResolved()) {
                    insuranceClickCount++;
                    pushBetLog('info', 'insurance_no_click_confirmed', {
                        attempt: attempt + 1,
                    });
                    console.log('[AutoTrigger] 인슈어런스 "아니오" 클릭 확인 완료');
                    return true;
                }
            }

            pushBetLog('warn', 'insurance_no_click_not_confirmed', {
                attempts: INSURANCE_CLICK_MAX_ATTEMPTS,
                visible: getInsuranceNoButton() ? 'Y' : 'N',
            });
            console.warn('[AutoTrigger] 인슈어런스 "아니오" 클릭 반응 미확인 → 다음 감시 주기에 재시도');
            return false;
        } finally {
            insuranceClickInFlight = false;
        }
    }
