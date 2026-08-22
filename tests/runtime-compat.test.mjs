import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadPartial } from './helpers/load-partial.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const bootSource = fs.readFileSync(path.join(rootDir, 'src', 'partials', '00-boot.js'), 'utf8');
const userscriptMeta = fs.readFileSync(path.join(rootDir, 'src', 'userscript.meta.js'), 'utf8');

assert.match(userscriptMeta, /@match\s+https:\/\/widget\.xma8riyvac\.com\/\*/);
assert.match(userscriptMeta, /@match\s+https:\/\/api\.honorlink\.org\/\*/);

function runBoot({ gameDocument = true, iframe = true, alreadyActive = false } = {}) {
  const attributes = new Set(alreadyActive ? ['data-autotrigger-script-active'] : []);
  const gameRoot = gameDocument
    ? {
        getAttribute(name) {
          if (name === 'data-game-version') return '3.2.51';
          if (name === 'data-build-number') return '811940-blackjackx-staging';
          if (name === 'data-version') return '3.2.51 (26.6.13 registry)';
          return null;
        },
      }
    : null;
  const document = {
    documentElement: {
      hasAttribute(name) {
        return attributes.has(name);
      },
      setAttribute(name) {
        attributes.add(name);
      },
    },
    querySelector(selector) {
      if (selector === '#root[data-game-version],#root[data-build-number]') return gameRoot;
      if (selector === '#root') return gameRoot;
      if (selector === '[data-testid="game-grid-wrapper"],[data-testid^="seat_"]') return null;
      return null;
    },
  };
  const self = {};
  const window = { self, top: iframe ? {} : self };
  const context = { document, window };
  vm.createContext(context);
  vm.runInContext(
    `(function() {\n${bootSource}\n` +
      `globalThis.__bootResult = { mode: SCRIPT_FRAME_MODE, version: SCRIPT_GAME_VERSION };\n` +
      `})();`,
    context,
    { filename: '00-boot.js' },
  );
  return { context, attributes };
}

{
  const { context, attributes } = runBoot({ gameDocument: true, iframe: true });
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.__bootResult)),
    { mode: 'iframe', version: '3.2.51' },
  );
  assert.equal(attributes.has('data-autotrigger-script-active'), true);
}

{
  const { context } = runBoot({ gameDocument: true, iframe: false });
  assert.equal(context.__bootResult.mode, 'top');
}

{
  const { context, attributes } = runBoot({ gameDocument: false, iframe: false });
  assert.equal(context.__bootResult, undefined);
  assert.equal(attributes.has('data-autotrigger-script-active'), false);
}

{
  const { context } = runBoot({ gameDocument: true, iframe: true, alreadyActive: true });
  assert.equal(context.__bootResult, undefined);
}

{
  const seats = loadPartial('07-seats.js', {});
  const occupiedMarker = {};
  const container = {
    querySelector(selector) {
      return selector === '[data-testid="seat-taken-nickname"]' ? occupiedMarker : null;
    },
  };
  const seat = {
    getAttribute() {
      return '';
    },
  };
  seats.isOwnSeat = () => false;
  seats.getSeatContainer = () => container;
  seats.isVisible = () => false;

  // The marker is authoritative even during a transient hidden/rendering state.
  assert.equal(seats.isSeatTakenByOther(seat), true);

  container.querySelector = () => null;
  assert.equal(seats.isSeatTakenByOther(seat), false);

  seat.getAttribute = name => (name === 'class' ? 'FP_FV' : '');
  assert.equal(seats.isSeatTakenByOther(seat), true);
}

console.log('runtime compatibility tests passed');
