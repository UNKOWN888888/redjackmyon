// ==UserScript==
// @name         Autoplay Auto Trigger
// @namespace    http://tampermonkey.net/
// @version      2.0.2
// @description  공개 GitHub 저장소의 BlackjackT 빌드 파일을 검증·캐시하여 빠르게 실행하는 로더
// @homepageURL  https://github.com/UNKOWN888888/redjackmyon
// @supportURL   https://github.com/UNKOWN888888/redjackmyon/issues
// @updateURL    https://raw.githubusercontent.com/UNKOWN888888/redjackmyon/main/loader/blackjackT-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/UNKOWN888888/redjackmyon/main/loader/blackjackT-loader.user.js
// @match        https://client.pragmaticplaylive.net/*
// @match        https://*.pragmaticplaylive.net/*
// @match        https://widget.xma8riyvac.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const REMOTE_URL_KEY = 'blackjackTLoaderRemoteUrl';
    const CACHE_KEY = 'blackjackTLoaderCacheV1';
    const DEFAULT_REMOTE_URL = 'https://raw.githubusercontent.com/UNKOWN888888/redjackmyon/main/dist/blackjackT.user.js';
    const LOADER_ACTIVE_ATTRIBUTE = 'data-autotrigger-loader-active';
    const MAIN_ACTIVE_ATTRIBUTE = 'data-autotrigger-script-active';
    const SOURCE_MIN_LENGTH = 10000;
    const SOURCE_MAX_LENGTH = 2 * 1024 * 1024;
    const GAME_WAIT_TIMEOUT_MS = 30000;
    const REMOTE_TIMEOUT_MS = 6000;

    function isBlackjackGameDocument(doc = document) {
        if (!doc?.querySelector) return false;
        const root = doc.querySelector('#root[data-game-version],#root[data-build-number]');
        if (root) {
            const build = `${root.getAttribute?.('data-build-number') || ''} ${root.getAttribute?.('data-version') || ''}`;
            if (!build || /blackjackx/i.test(build)) return true;
        }
        return !!doc.querySelector('[data-testid="game-grid-wrapper"],[data-testid^="seat_"]');
    }

    function waitForGameDocument(timeoutMs = GAME_WAIT_TIMEOUT_MS) {
        if (isBlackjackGameDocument(document)) return Promise.resolve(true);
        return new Promise(resolve => {
            let settled = false;
            let observer = null;
            let timer = null;
            const finish = value => {
                if (settled) return;
                settled = true;
                observer?.disconnect();
                clearTimeout(timer);
                resolve(value);
            };
            const check = () => {
                if (isBlackjackGameDocument(document)) finish(true);
            };
            observer = new MutationObserver(check);
            observer.observe(document, { childList: true, subtree: true });
            timer = setTimeout(() => finish(false), timeoutMs);
            check();
        });
    }

    function normalizeRemoteUrl(input) {
        const raw = String(input || '').trim();
        if (!raw) throw new Error('GitHub 주소가 비어 있습니다.');

        let url;
        try {
            url = new URL(raw);
        } catch {
            throw new Error('올바른 GitHub URL을 입력하십시오.');
        }
        if (url.protocol !== 'https:') throw new Error('HTTPS GitHub 주소만 사용할 수 있습니다.');
        url.hash = '';
        url.search = '';

        const parts = url.pathname.split('/').filter(Boolean);
        if (url.hostname === 'raw.githubusercontent.com') {
            if (parts.length < 4 || !/\.js$/i.test(parts.at(-1))) {
                throw new Error('GitHub raw JavaScript 파일 주소가 아닙니다.');
            }
            return url.toString();
        }

        if (url.hostname !== 'github.com' || parts.length < 2) {
            throw new Error('github.com 또는 raw.githubusercontent.com 주소만 사용할 수 있습니다.');
        }

        const owner = parts[0];
        const repository = parts[1].replace(/\.git$/i, '');
        if (!owner || !repository) throw new Error('GitHub 저장소 주소를 확인하십시오.');

        if (parts.length === 2) {
            return `https://raw.githubusercontent.com/${owner}/${repository}/main/dist/blackjackT.user.js`;
        }

        if ((parts[2] === 'blob' || parts[2] === 'raw') && parts.length >= 5) {
            const branch = parts[3];
            const filePath = parts.slice(4).join('/');
            if (!/\.js$/i.test(filePath)) throw new Error('JavaScript 파일 주소를 입력하십시오.');
            return `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${filePath}`;
        }

        throw new Error('저장소 주소 또는 dist/blackjackT.user.js 파일 주소를 입력하십시오.');
    }

    function getSourceVersion(source) {
        return String(source || '').match(/^\s*\/\/\s*@version\s+([^\s]+)\s*$/m)?.[1] || 'unknown';
    }

    function validateRemoteSource(source) {
        if (typeof source !== 'string' || source.length < SOURCE_MIN_LENGTH) {
            throw new Error('받은 파일이 너무 짧아 실행을 차단했습니다.');
        }
        if (source.length > SOURCE_MAX_LENGTH) {
            throw new Error('받은 파일이 허용 크기를 초과해 실행을 차단했습니다.');
        }
        const requiredMarkers = [
            '// ==UserScript==',
            'Autoplay Auto Trigger',
            'data-autotrigger-script-active',
            'function getSeatPlan',
            'function setupBetAmount',
            'wallet-total-bet-value',
        ];
        if (requiredMarkers.some(marker => !source.includes(marker))) {
            throw new Error('BlackjackT 빌드 파일 검증에 실패했습니다.');
        }
        try {
            new Function('GM_getValue', 'GM_setValue', source);
        } catch (error) {
            throw new Error(`받은 스크립트 문법 오류: ${error.message}`);
        }
        return {
            source,
            version: getSourceVersion(source),
        };
    }

    function getStoredRemoteUrl() {
        const saved = GM_getValue(REMOTE_URL_KEY, '');
        if (saved) {
            try {
                return normalizeRemoteUrl(saved);
            } catch (error) {
                console.warn('[AutoTrigger Loader] 저장된 GitHub 주소가 잘못되었습니다:', error);
                GM_setValue(REMOTE_URL_KEY, '');
            }
        }

        const inferred = inferRemoteUrlFromInstallSource(
            typeof GM_info === 'object' && GM_info ? GM_info : null,
        );
        const remoteUrl = inferred || DEFAULT_REMOTE_URL;
        GM_setValue(REMOTE_URL_KEY, remoteUrl);
        return remoteUrl;
    }

    function inferRemoteUrlFromInstallSource(info) {
        const candidates = [
            info?.script?.downloadURL,
            info?.script?.updateURL,
            info?.scriptUpdateURL,
        ].filter(Boolean);

        for (const candidate of candidates) {
            try {
                const url = new URL(candidate);
                const parts = url.pathname.split('/').filter(Boolean);
                if (url.hostname === 'raw.githubusercontent.com' && parts.length >= 4) {
                    const [owner, repository, branch] = parts;
                    return `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/dist/blackjackT.user.js`;
                }
                if (url.hostname === 'github.com' && parts.length >= 5 && (parts[2] === 'blob' || parts[2] === 'raw')) {
                    const [owner, repository, , branch] = parts;
                    return `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/dist/blackjackT.user.js`;
                }
            } catch {
                // Local file installations intentionally fall through to the one-time prompt.
            }
        }
        return '';
    }

    function promptForRemoteUrl(currentUrl = '') {
        const entered = window.prompt(
            '공개 GitHub 저장소 주소를 입력하십시오.\n' +
            '예: https://github.com/사용자명/저장소명\n' +
            '기본 파일: main/dist/blackjackT.user.js',
            currentUrl,
        );
        if (entered === null) return '';
        const normalized = normalizeRemoteUrl(entered);
        GM_setValue(REMOTE_URL_KEY, normalized);
        GM_setValue(CACHE_KEY, null);
        return normalized;
    }

    function getCachedRecord(remoteUrl) {
        const cache = GM_getValue(CACHE_KEY, null);
        if (!cache || cache.url !== remoteUrl || typeof cache.source !== 'string') return null;
        try {
            const validated = validateRemoteSource(cache.source);
            return {
                ...validated,
                url: remoteUrl,
                fetchedAt: Number(cache.fetchedAt) || 0,
            };
        } catch (error) {
            console.warn('[AutoTrigger Loader] 캐시 검증 실패, 원격 파일을 다시 받습니다:', error);
            GM_setValue(CACHE_KEY, null);
            return null;
        }
    }

    function storeCachedRecord(record) {
        GM_setValue(CACHE_KEY, {
            url: record.url,
            source: record.source,
            version: record.version,
            fetchedAt: record.fetchedAt,
        });
    }

    function buildFetchUrl(remoteUrl) {
        const url = new URL(remoteUrl);
        url.searchParams.set('_blackjackt', String(Date.now()));
        return url.toString();
    }

    function fetchRemoteRecord(remoteUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: buildFetchUrl(remoteUrl),
                headers: {
                    Accept: 'text/plain',
                    'Cache-Control': 'no-cache',
                },
                timeout: REMOTE_TIMEOUT_MS,
                anonymous: true,
                onload(response) {
                    if (response.status < 200 || response.status >= 300) {
                        reject(new Error(`GitHub 응답 오류 HTTP ${response.status}`));
                        return;
                    }
                    try {
                        const validated = validateRemoteSource(response.responseText);
                        resolve({
                            ...validated,
                            url: remoteUrl,
                            fetchedAt: Date.now(),
                        });
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror() {
                    reject(new Error('GitHub 연결에 실패했습니다.'));
                },
                ontimeout() {
                    reject(new Error('GitHub 응답 시간이 초과됐습니다.'));
                },
                onabort() {
                    reject(new Error('GitHub 요청이 취소됐습니다.'));
                },
            });
        });
    }

    function setLoaderInfo(record, source) {
        const info = {
            mode: 'github',
            source,
            remoteUrl: record.url,
            version: record.version,
            fetchedAt: record.fetchedAt,
            updateReadyVersion: null,
        };
        globalThis.__BLACKJACKT_LOADER_INFO__ = info;
        return info;
    }

    function executeRecord(record, source) {
        if (document.documentElement?.hasAttribute?.(MAIN_ACTIVE_ATTRIBUTE)) {
            console.info('[AutoTrigger Loader] 메인 스크립트가 이미 실행 중이므로 중복 실행을 막았습니다.');
            return false;
        }
        setLoaderInfo(record, source);
        const runner = new Function(
            'GM_getValue',
            'GM_setValue',
            `${record.source}\n//# sourceURL=${record.url}`,
        );
        runner(GM_getValue, GM_setValue);
        if (!document.documentElement?.hasAttribute?.(MAIN_ACTIVE_ATTRIBUTE)) {
            throw new Error('원격 스크립트가 게임 문서에서 시작되지 않았습니다.');
        }
        console.info(`[AutoTrigger Loader] ${source} v${record.version} 실행 완료`);
        return true;
    }

    function showLoaderError(message) {
        console.error('[AutoTrigger Loader]', message);
        const parent = document.body || document.documentElement;
        if (!parent) return;
        let panel = document.getElementById('blackjackt-loader-error');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'blackjackt-loader-error';
            panel.style.cssText = [
                'position:fixed',
                'z-index:2147483647',
                'top:12px',
                'left:12px',
                'max-width:420px',
                'padding:10px 12px',
                'background:#821d25',
                'color:#fff',
                'border:1px solid #ff8c95',
                'font:12px/1.45 sans-serif',
            ].join(';');
            parent.appendChild(panel);
        }
        panel.textContent = `GitHub 로더 실패: ${message}`;
    }

    function registerLoaderMenus() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        GM_registerMenuCommand('GitHub 스크립트 주소 설정', () => {
            try {
                const remoteUrl = promptForRemoteUrl(getStoredRemoteUrl());
                if (remoteUrl) window.alert('GitHub 주소를 저장했습니다. 게임을 새로고침하십시오.');
            } catch (error) {
                window.alert(error.message);
            }
        });
        GM_registerMenuCommand('GitHub 최신본 받기', async () => {
            const remoteUrl = getStoredRemoteUrl();
            if (!remoteUrl) {
                window.alert('먼저 GitHub 스크립트 주소를 설정하십시오.');
                return;
            }
            try {
                const record = await fetchRemoteRecord(remoteUrl);
                storeCachedRecord(record);
                window.alert(`GitHub v${record.version}을 저장했습니다. 게임을 새로고침하면 적용됩니다.`);
            } catch (error) {
                window.alert(`GitHub 최신본 받기 실패: ${error.message}`);
            }
        });
        GM_registerMenuCommand('GitHub 캐시 삭제', () => {
            GM_setValue(CACHE_KEY, null);
            window.alert('GitHub 캐시를 삭제했습니다. 다음 새로고침에서 다시 받습니다.');
        });
    }

    async function refreshCacheInBackground(remoteUrl, previousRecord) {
        try {
            const latest = await fetchRemoteRecord(remoteUrl);
            storeCachedRecord(latest);
            const info = globalThis.__BLACKJACKT_LOADER_INFO__;
            if (info && latest.source !== previousRecord.source) {
                info.updateReadyVersion = latest.version;
                console.info(`[AutoTrigger Loader] GitHub v${latest.version} 준비 완료, 다음 새로고침에 적용됩니다.`);
            }
        } catch (error) {
            console.warn('[AutoTrigger Loader] 백그라운드 최신본 확인 실패, 현재 캐시를 유지합니다:', error);
        }
    }

    async function startLoader() {
        if (!await waitForGameDocument()) return;
        if (document.documentElement?.hasAttribute?.(LOADER_ACTIVE_ATTRIBUTE)) return;
        document.documentElement?.setAttribute?.(LOADER_ACTIVE_ATTRIBUTE, 'true');
        registerLoaderMenus();

        let remoteUrl = getStoredRemoteUrl();
        if (!remoteUrl) {
            try {
                remoteUrl = promptForRemoteUrl();
            } catch (error) {
                showLoaderError(error.message);
                return;
            }
            if (!remoteUrl) {
                showLoaderError('GitHub 주소가 설정되지 않았습니다. Tampermonkey 메뉴에서 주소를 설정하십시오.');
                return;
            }
        }

        const cached = getCachedRecord(remoteUrl);
        if (cached) {
            try {
                executeRecord(cached, 'cache');
                refreshCacheInBackground(remoteUrl, cached);
                return;
            } catch (error) {
                console.error('[AutoTrigger Loader] 캐시 실행 실패, 원격 파일로 복구합니다:', error);
                GM_setValue(CACHE_KEY, null);
            }
        }

        try {
            const remote = await fetchRemoteRecord(remoteUrl);
            storeCachedRecord(remote);
            executeRecord(remote, 'remote');
        } catch (error) {
            showLoaderError(error.message);
        }
    }

    if (globalThis.__BLACKJACKT_LOADER_TEST__) {
        globalThis.__BLACKJACKT_LOADER_TEST_API__ = {
            normalizeRemoteUrl,
            inferRemoteUrlFromInstallSource,
            getSourceVersion,
            validateRemoteSource,
            isBlackjackGameDocument,
        };
        return;
    }

    startLoader().catch(error => showLoaderError(error.message));
})();
