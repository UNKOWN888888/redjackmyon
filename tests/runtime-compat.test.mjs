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
assert.match(userscriptMeta, /@match\s+https:\/\/client\.fcxlljmmbqtczjya\.net\/\*/);

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

{
  const seats = loadPartial('07-seats.js', {});
  seats.uniqueSortedSeatNumbers = numbers => [...new Set(numbers)].sort((a, b) => a - b);
  seats.getSeatByNumber = seatNumber => ({ seatNumber });
  seats.isVisible = () => true;
  seats.hasSeatCloseButton = seat => seat.seatNumber === 5 || seat.seatNumber === 7;

  assert.equal(seats.getCloseVerifiedSeatNumbers([3, 5, 7, 3]).join(','), '5,7');

  const plan = {
    used: 2,
    totalActual: 3000,
    perSeatActual: 1500,
  };
  const unknownAmounts = {
    seats: [5, 7],
    amounts: [
      { seatNumber: 5, amount: null, hasChip: true, hasGhost: false },
      { seatNumber: 7, amount: null, hasChip: true, hasGhost: false },
    ],
    total: 0,
    detectedCount: 0,
    ambiguousCount: 2,
  };
  seats.getMaxSeatCount = () => 2;
  seats.toInt = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
  };
  seats.getCloseVerifiedSeatNumbers = () => [5, 7];
  seats.getWalletTotalBetVariance = () => ({
    status: 'exact',
    expected: 3000,
    reading: { detected: true, ambiguous: false, amount: 3000 },
  });
  assert.equal(seats.isBetSummaryWalletConfirmed(unknownAmounts, plan), true);
  assert.equal(seats.isBetSummaryWalletConfirmed({
    ...unknownAmounts,
    amounts: [
      { seatNumber: 5, amount: 750, hasChip: true, hasGhost: false },
      { seatNumber: 7, amount: null, hasChip: true, hasGhost: false },
    ],
  }, plan), false, 'a detected per-seat mismatch must override an exact aggregate wallet total');
  assert.equal(seats.isBetSummaryWalletConfirmed({
    ...unknownAmounts,
    amounts: [
      { seatNumber: 5, amount: null, hasChip: true, hasGhost: true },
      { seatNumber: 7, amount: null, hasChip: true, hasGhost: false },
    ],
  }, plan), false, 'ghost chips must not satisfy wallet-confirmed betting');

  seats.getRememberedBetSeatNumbers = () => [5, 7];
  seats.getTargetSeatBetSummary = () => unknownAmounts;
  assert.equal(seats.areBetSeatsReadyForRoundAction(plan), true);

  seats.getWalletTotalBetVariance = () => ({
    status: 'under',
    expected: 3000,
    reading: { detected: true, ambiguous: false, amount: 1500 },
  });
  const recovery = seats.getUnknownBetWalletRecovery(unknownAmounts, plan);
  assert.equal(recovery.recoverable, true);
  assert.equal(recovery.variance.reading.amount, 1500);
}

console.log('runtime compatibility tests passed');
