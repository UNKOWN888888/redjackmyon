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
const uiSource = fs.readFileSync(path.join(rootDir, 'src', 'partials', '18-ui.js'), 'utf8');

assert.match(userscriptMeta, /@match\s+https:\/\/widget\.xma8riyvac\.com\/\*/);
assert.match(userscriptMeta, /@match\s+https:\/\/api\.honorlink\.org\/\*/);
assert.match(userscriptMeta, /@match\s+https:\/\/client\.fcxlljmmbqtczjya\.net\/\*/);
const metadataVersion = userscriptMeta.match(/@version\s+([^\s]+)/)?.[1];
const runtimeVersion = bootSource.match(/const SCRIPT_VERSION = '([^']+)'/)?.[1];
assert.equal(runtimeVersion, metadataVersion, 'the visible runtime version must match userscript metadata');
assert.match(uiSource, /class="at-version">v\$\{escapeHtml\(SCRIPT_VERSION\)\}/);

function runBoot({ gameDocument = true, iframe = true, alreadyActive = false, buildName = '811940-blackjackx-staging', seatGrid = false } = {}) {
  const attributes = new Set(alreadyActive ? ['data-autotrigger-script-active'] : []);
  const gameRoot = gameDocument
    ? {
        getAttribute(name) {
          if (name === 'data-game-version') return '3.2.51';
          if (name === 'data-build-number') return buildName;
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
      if (selector === '[data-testid="game-grid-wrapper"],[data-testid^="seat_"]') return seatGrid ? {} : null;
      return null;
    },
  };
  const self = {};
  const window = { self, top: iframe ? {} : self };
  const context = { document, window };
  vm.createContext(context);
  vm.runInContext(
    `(function() {\n${bootSource}\n` +
      `globalThis.__bootResult = { mode: SCRIPT_FRAME_MODE, version: SCRIPT_GAME_VERSION, scriptVersion: SCRIPT_VERSION };\n` +
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
    { mode: 'iframe', version: '3.2.51', scriptVersion: metadataVersion },
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
  const { context, attributes } = runBoot({
    gameDocument: true,
    iframe: false,
    buildName: '900000-baccarat-staging',
    seatGrid: true,
  });
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
  let bettingWindowOpen = true;
  const memory = loadPartial('02-diagnostics.js', {
    Date,
    lastTargetSeatNumbers: [5, 7],
    lastTargetSeatRememberedAt: Date.now(),
    TARGET_SEAT_MEMORY_GUARD_MS: 300000,
    isBetSetupRunning: false,
    betSettingsDirty: true,
    autoBetArmed: false,
    lastRoundCountSeenAt: 0,
    lastSeatPlan: { totalActual: 3000 },
    lastAppliedBetSettingsKey: '',
    _trustedRememberedSeatNumbersCache: null,
    _trustedRememberedSeatNumbersCacheAt: 0,
    _trustedRememberedSeatNumbersCacheKey: '',
    TRUSTED_SEAT_MEMORY_CACHE_MS: 45,
    forcedAutoSeatCount: null,
    seatLimitOverride: null,
    AUTO_SEAT_COUNT: true,
    SEAT_COUNT: 2,
    TARGET_BET_AMOUNT: 3000,
    getMaxSeatCount: () => 2,
    uniqueSortedSeatNumbers: numbers => [...new Set(numbers)].sort((a, b) => a - b),
    isBettingWindowOpen: () => bettingWindowOpen,
    GM_getValue: () => [],
    GM_setValue: () => {},
  });
  memory.getLiveRememberedSeatEvidence = () => [5];

  assert.equal(memory.getTrustedRememberedSeatNumbers().join(','), '5', 'betting window must keep only individually verified remembered seats');
  memory.rememberTargetSeatNumbers([5], { reason: 'partial_live_refresh' });
  assert.equal(memory.lastTargetSeatNumbers.join(','), '5,7', 'a partial live refresh must not erase the second active seat reservation');
  bettingWindowOpen = false;
  assert.equal(memory.getTrustedRememberedSeatNumbers().join(','), '5,7', 'a recent active-round memory may bridge transient hidden seat markers');
}

{
  const seats = loadPartial('07-seats.js', {
    lastTargetSeatNumbers: [5, 7],
  });
  seats.uniqueSortedSeatNumbers = numbers => [...new Set(numbers)].sort((a, b) => a - b);
  seats.isForceSitPromptSeatActive = () => false;
  seats.getPlannedSeatLimit = () => 2;
  seats.isTargetSeatMemoryRecentlyActive = () => true;
  seats.getLiveRememberedSeatEvidence = () => [5];
  seats.getTrustedRememberedSeatNumbers = () => [5];
  seats.getYellowSeatRayNumbers = () => [];
  seats.getControlledOrPendingSeatNumbers = () => [5];

  assert.equal(seats.getSeatReservationNumbers().join(','), '5,7');
  assert.equal(seats.getNewEmptySeatBlockState(3).blocked, true, 'a transiently hidden remembered seat must block sitting a third seat');
  assert.equal(seats.getNewEmptySeatBlockState(7).blocked, false, 'the missing remembered seat itself may be reacquired');
}

{
  const seats = loadPartial('07-seats.js', {});
  const closeSeatNumbers = new Set([5, 7]);
  seats.uniqueSortedSeatNumbers = numbers => [...new Set(numbers)].sort((a, b) => a - b);
  seats.getSeatByNumber = seatNumber => ({ seatNumber });
  seats.getSeatNumber = seat => seat.seatNumber;
  seats.getVisibleMainBetSeats = () => [3, 5, 7].map(seatNumber => ({ seatNumber }));
  seats.lastTargetSeatNumbers = [];
  seats.getSeatReservationNumbers = () => [];
  seats.isVisible = () => true;
  seats.hasSeatCloseButton = seat => closeSeatNumbers.has(seat.seatNumber);

  assert.equal(seats.getCloseVerifiedSeatNumbers([3, 5, 7, 3]).join(','), '5,7');
  assert.equal(seats.getBroadcastSeatTargetState([5, 7]).exact, true);
  closeSeatNumbers.add(3);
  assert.equal(seats.getBroadcastSeatTargetState([5, 7]).exact, false, 'an extra live seat must block broadcast betting');
  closeSeatNumbers.delete(3);
  closeSeatNumbers.delete(7);
  seats.lastTargetSeatNumbers = [5, 7];
  seats.getSeatReservationNumbers = () => [5, 7];
  const hiddenReservedState = seats.getBroadcastSeatTargetState([5]);
  assert.equal(hiddenReservedState.exact, false, 'a hidden recent seat reservation must block a one-seat broadcast plan');
  assert.equal(hiddenReservedState.unresolvedReserved.join(','), '7');
  closeSeatNumbers.add(7);

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
  seats.isVerifiedBetProgressComplete = () => true;
  assert.equal(seats.isBetSummaryWalletConfirmed({
    ...unknownAmounts,
    amounts: [
      { seatNumber: 5, amount: 750, hasChip: true, hasGhost: false },
      { seatNumber: 7, amount: 750, hasChip: true, hasGhost: false },
    ],
  }, plan), true, 'an exact wallet total may override stale seat text only after the script verified every betting step');
  seats.isVerifiedBetProgressComplete = () => false;
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
  seats.isBettingWindowOpen = () => true;
  seats.getTargetSeatBetSummary = () => ({
    seats: [5, 7],
    amounts: [
      { seatNumber: 5, amount: 1500, hasChip: true, hasGhost: false },
      { seatNumber: 7, amount: 1500, hasChip: true, hasGhost: false },
    ],
    total: 3000,
    detectedCount: 2,
    ambiguousCount: 0,
  });
  assert.equal(seats.areBetSeatsReadyForRoundAction(plan), false, 'displayed seat totals must not override an under-target wallet total');

  seats.getTargetSeatBetSummary = () => unknownAmounts;
  const recovery = seats.getUnknownBetWalletRecovery(unknownAmounts, plan);
  assert.equal(recovery.recoverable, true);
  assert.equal(recovery.reason, 'bet_amount_unknown_under_target');
  assert.equal(recovery.variance.reading.amount, 1500);

  seats.getWalletTotalBetVariance = () => ({
    status: 'increased',
    expected: 3000,
    reading: { detected: true, ambiguous: false, amount: 4500 },
  });
  const overRecovery = seats.getUnknownBetWalletRecovery(unknownAmounts, plan);
  assert.equal(overRecovery.recoverable, true);
  assert.equal(overRecovery.reason, 'bet_total_over_target');
}

{
  const seats = loadPartial('07-seats.js', {
    AUTO_SEAT_COUNT: true,
    TARGET_BET_AMOUNT: 3000,
  });
  seats.uniqueSortedSeatNumbers = numbers => [...new Set(numbers)].sort((a, b) => a - b);
  seats.isScriptStopped = () => false;
  seats.isAutomationLocked = () => false;
  seats.getMaxSeatCount = () => 4;
  seats.getControlledSeatNumbers = () => [5, 7];
  seats.getTrustedRememberedSeatNumbers = () => [];
  seats.isBettingWindowOpen = () => true;
  seats.detectAvailableChips = () => [{ value: 750 }];
  seats.getSetupSeatCandidates = () => [{}, {}, {}];
  seats.getSeatPlan = () => ({ used: 2, totalActual: 3000, perSeatActual: 1500, chipPlan: [{ value: 750, count: 2 }] });

  assert.equal(seats.getAutoSeatExpansionOpportunity(), null, 'a third seat must not replace an exact two-seat plan with a lower total');
}

console.log('runtime compatibility tests passed');
