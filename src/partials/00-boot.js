    'use strict';

    function isBlackjackGameDocument(doc = document) {
        if (!doc?.querySelector) return false;
        const root = doc.querySelector('#root[data-game-version],#root[data-build-number]');
        if (root) {
            const build = `${root.getAttribute?.('data-build-number') || ''} ${root.getAttribute?.('data-version') || ''}`.trim();
            if (build) return /blackjackx/i.test(build);
        }
        return !!doc.querySelector('[data-testid="game-grid-wrapper"],[data-testid^="seat_"]');
    }

    if (!isBlackjackGameDocument(document)) return;

    const SCRIPT_FRAME_MODE = window.top === window.self ? 'top' : 'iframe';
    const SCRIPT_GAME_VERSION = document.querySelector('#root')?.getAttribute?.('data-game-version') || 'unknown';
    const SCRIPT_ACTIVE_ATTRIBUTE = 'data-autotrigger-script-active';
    if (document.documentElement?.hasAttribute?.(SCRIPT_ACTIVE_ATTRIBUTE)) return;
    document.documentElement?.setAttribute?.(SCRIPT_ACTIVE_ATTRIBUTE, 'true');

    function getScriptLoadState() {
        const info = globalThis.__BLACKJACKT_LOADER_INFO__;
        if (!info || info.mode !== 'github') {
            return {
                mode: 'direct',
                source: 'direct',
                version: null,
                updateReadyVersion: null,
            };
        }
        return {
            mode: 'github',
            source: info.source === 'cache' ? 'cache' : 'remote',
            version: typeof info.version === 'string' ? info.version : null,
            updateReadyVersion: typeof info.updateReadyVersion === 'string'
                ? info.updateReadyVersion
                : null,
        };
    }

    function getScriptLoadLabel() {
        const state = getScriptLoadState();
        if (state.mode !== 'github') return '직접 파일';
        const source = state.source === 'cache' ? 'GitHub 캐시' : 'GitHub 원격';
        const version = state.version ? ` v${state.version}` : '';
        const update = state.updateReadyVersion ? ` / 업데이트 v${state.updateReadyVersion} 대기` : '';
        return `${source}${version}${update}`;
    }
