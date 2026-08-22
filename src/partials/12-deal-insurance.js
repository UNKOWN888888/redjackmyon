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

    function clickInsuranceNoElement(noBtn) {
        if (!noBtn || !isInsuranceNoEnabled(noBtn)) return false;
        const target = noBtn.closest?.('[data-id="no"]') || noBtn;
        return robustClick(target);
    }

    function checkAndClickInsuranceNo() {
        if (isScriptStopped()) return;
        if (isAutomationLocked()) return;
        if (Date.now() - lastInsuranceClickAt < INSURANCE_COOLDOWN_MS) return;
        const noBtn = getInsuranceNoButton();
        if (!noBtn) return;
        console.log('[AutoTrigger] 인슈어런스 "아니오" decision-panel 감지 → 즉시 클릭');
        if (clickInsuranceNoElement(noBtn)) {
            lastInsuranceClickAt = Date.now();
            insuranceClickCount++;
        }
    }
