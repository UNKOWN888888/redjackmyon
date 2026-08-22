import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const loaderPath = path.join(root, 'loader', 'blackjackT-loader.user.js');
const distPath = path.join(root, 'dist', 'blackjackT.user.js');
const loaderSource = fs.readFileSync(loaderPath, 'utf8');
const context = {
  console,
  URL,
  __BLACKJACKT_LOADER_TEST__: true,
};

vm.createContext(context);
vm.runInContext(loaderSource, context, { filename: 'blackjackT-loader.user.js' });

const api = context.__BLACKJACKT_LOADER_TEST_API__;
assert.ok(api, 'loader test API should be exposed');

assert.equal(
  api.normalizeRemoteUrl('https://github.com/example/blackjackt'),
  'https://raw.githubusercontent.com/example/blackjackt/main/dist/blackjackT.user.js',
);
assert.equal(
  api.normalizeRemoteUrl('https://github.com/example/blackjackt.git'),
  'https://raw.githubusercontent.com/example/blackjackt/main/dist/blackjackT.user.js',
);
assert.equal(
  api.normalizeRemoteUrl('https://github.com/example/blackjackt/blob/release/dist/custom.user.js?x=1#L10'),
  'https://raw.githubusercontent.com/example/blackjackt/release/dist/custom.user.js',
);
assert.equal(
  api.normalizeRemoteUrl('https://raw.githubusercontent.com/example/blackjackt/main/dist/blackjackT.user.js?cache=old'),
  'https://raw.githubusercontent.com/example/blackjackt/main/dist/blackjackT.user.js',
);

assert.throws(
  () => api.normalizeRemoteUrl('http://github.com/example/blackjackt'),
  /HTTPS/,
);
assert.throws(
  () => api.normalizeRemoteUrl('https://example.com/blackjackT.user.js'),
  /github\.com/,
);
assert.throws(
  () => api.normalizeRemoteUrl('https://github.com/example/blackjackt/tree/main'),
  /저장소 주소/,
);

assert.equal(
  api.inferRemoteUrlFromInstallSource({
    script: {
      downloadURL: 'https://raw.githubusercontent.com/example/blackjackt/main/loader/blackjackT-loader.user.js',
    },
  }),
  'https://raw.githubusercontent.com/example/blackjackt/main/dist/blackjackT.user.js',
);
assert.equal(
  api.inferRemoteUrlFromInstallSource({
    scriptUpdateURL: 'https://github.com/example/blackjackt/blob/release/loader/blackjackT-loader.user.js',
  }),
  'https://raw.githubusercontent.com/example/blackjackt/release/dist/blackjackT.user.js',
);
assert.equal(
  api.inferRemoteUrlFromInstallSource({ script: { downloadURL: 'file:///C:/Downloads/loader.user.js' } }),
  '',
);

const distSource = fs.readFileSync(distPath, 'utf8');
const validated = api.validateRemoteSource(distSource);
assert.equal(validated.source, distSource);
assert.match(validated.version, /^\d+(?:\.\d+)+$/);
assert.throws(
  () => api.validateRemoteSource('<html>not a userscript</html>'.repeat(1000)),
  /검증에 실패/,
);

assert.match(loaderSource, /@connect\s+raw\.githubusercontent\.com/);
assert.match(loaderSource, /@grant\s+GM_xmlhttpRequest/);
assert.match(loaderSource, /@grant\s+GM_info/);
assert.match(
  loaderSource,
  /https:\/\/raw\.githubusercontent\.com\/UNKOWN888888\/redjackmyon\/main\/dist\/blackjackT\.user\.js/,
);

function makeValidRemoteSource(version = '9.9.9') {
  return `// ==UserScript==
// @name Autoplay Auto Trigger
// @version ${version}
// ==/UserScript==
(function() {
  const SCRIPT_ACTIVE_ATTRIBUTE = 'data-autotrigger-script-active';
  function getSeatPlan() {}
  function setupBetAmount() {}
  const walletMarker = 'wallet-total-bet-value';
  document.documentElement.setAttribute(SCRIPT_ACTIVE_ATTRIBUTE, 'true');
})();
// ${'validated-source-padding '.repeat(600)}`;
}

async function runLoaderRuntime({ cached = false } = {}) {
  const remoteUrl = 'https://raw.githubusercontent.com/example/blackjackt/main/dist/blackjackT.user.js';
  const remoteSource = makeValidRemoteSource();
  const attributes = new Set();
  const storage = new Map([
    ['blackjackTLoaderRemoteUrl', remoteUrl],
  ]);
  if (cached) {
    storage.set('blackjackTLoaderCacheV1', {
      url: remoteUrl,
      source: remoteSource,
      version: '9.9.9',
      fetchedAt: 123,
    });
  }
  let requestCount = 0;
  const rootElement = {
    getAttribute(name) {
      if (name === 'data-build-number') return '811940-blackjackx-staging';
      if (name === 'data-game-version') return '3.2.51';
      return null;
    },
  };
  const documentElement = {
    hasAttribute(name) {
      return attributes.has(name);
    },
    setAttribute(name) {
      attributes.add(name);
    },
  };
  const document = {
    body: null,
    documentElement,
    querySelector(selector) {
      if (selector === '#root[data-game-version],#root[data-build-number]') return rootElement;
      if (selector === '#root') return rootElement;
      return null;
    },
    getElementById() {
      return null;
    },
    createElement() {
      throw new Error('error panel should not be created in a successful load');
    },
  };
  const context = {
    console,
    URL,
    document,
    window: {
      prompt() {
        throw new Error('configured runtime should not prompt');
      },
      alert() {},
    },
    setTimeout,
    clearTimeout,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    GM_info: {},
    GM_getValue(key, fallback) {
      return storage.has(key) ? storage.get(key) : fallback;
    },
    GM_setValue(key, value) {
      storage.set(key, value);
    },
    GM_registerMenuCommand() {},
    GM_xmlhttpRequest(details) {
      requestCount++;
      setTimeout(() => details.onload({ status: 200, responseText: remoteSource }), 0);
      return { abort() {} };
    },
  };

  vm.createContext(context);
  vm.runInContext(loaderSource, context, { filename: 'blackjackT-loader.runtime.user.js' });
  await new Promise(resolve => setTimeout(resolve, 25));
  return { attributes, storage, requestCount, loaderInfo: context.__BLACKJACKT_LOADER_INFO__ };
}

{
  const runtime = await runLoaderRuntime({ cached: false });
  assert.equal(runtime.attributes.has('data-autotrigger-script-active'), true);
  assert.equal(runtime.loaderInfo.source, 'remote');
  assert.equal(runtime.storage.get('blackjackTLoaderCacheV1').version, '9.9.9');
  assert.equal(runtime.requestCount, 1);
}

{
  const runtime = await runLoaderRuntime({ cached: true });
  assert.equal(runtime.attributes.has('data-autotrigger-script-active'), true);
  assert.equal(runtime.loaderInfo.source, 'cache');
  assert.equal(runtime.requestCount, 1, 'cache should execute immediately while one background refresh runs');
}

console.log('github loader tests passed');
