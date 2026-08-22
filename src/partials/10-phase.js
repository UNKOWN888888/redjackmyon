    // ========== DOM 진단 ==========
    function diagnosePhase() {
        if (isScriptStopped()) return Phase.STOPPED;
        if (!hasBettableSeats()) return Phase.NO_TABLE;
        if (detectAvailableChips().length === 0) return Phase.NO_CHIPS;
        if (!isAutoplayButtonReady() && !isAutoplayRunning()) return Phase.BUTTON_DOWN;
        return Phase.READY;
    }
