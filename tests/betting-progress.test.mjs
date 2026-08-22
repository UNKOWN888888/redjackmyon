import assert from 'node:assert/strict';
import { loadPartial } from './helpers/load-partial.mjs';

const sandbox = loadPartial('09-betting-clicks.js', {
  pushBetLog: () => {},
  SINGLE_CHIP_DOM_PART_LIMIT: 8,
  SELECTED_STACK_CHIP_TTL_MS: 2500,
  lastSelectedStackChipValue: 0,
  lastSelectedStackChipAt: 0,
  Date,
});
sandbox.formatMoney = n => String(n);

function state({
  seatNumber = 5,
  baseAmount = 0,
  baseChipCount = 0,
  expectedAmount = 1500,
  observedAmount = null,
  hasChip = true,
  chipCount = 0,
  hasGhost = false,
} = {}) {
  return {
    seatNumber,
    baseAmount,
    baseChipCount,
    expectedAmount,
    observedAmount,
    amount: Number.isFinite(observedAmount) ? observedAmount : null,
    hasChip,
    chipCount,
    hasGhost,
  };
}

const oneOfTwoByAmount = [state({ observedAmount: 750, chipCount: 1 })];
assert.equal(sandbox.getUniformObservedAmountClicks(oneOfTwoByAmount, 750, 2), 1);

const twoOfTwoByAmount = [state({ observedAmount: 1500, chipCount: 2 })];
assert.equal(sandbox.getUniformObservedAmountClicks(twoOfTwoByAmount, 750, 2), 2);
assert.equal(sandbox.areObservedStatesSafelyAtExpectedAmount(twoOfTwoByAmount, 750, 2), true);

const oneOfTwoByChipCount = [state({ observedAmount: null, chipCount: 1 })];
assert.equal(sandbox.getUniformObservedAmountClicks(oneOfTwoByChipCount, 750, 2), null);

const oneVisualChipTwoDomParts = [state({ observedAmount: null, chipCount: 2 })];
assert.equal(sandbox.getUniformObservedAmountClicks(oneVisualChipTwoDomParts, 750, 2), null);
assert.equal(sandbox.areObservedStatesSafelyAtExpectedAmount(oneVisualChipTwoDomParts, 750, 2), false);

const twoSeatsOneOfTwo = [
  state({ seatNumber: 5, observedAmount: 750, chipCount: 1 }),
  state({ seatNumber: 7, observedAmount: 750, chipCount: 1 }),
];
assert.equal(sandbox.getUniformObservedAmountClicks(twoSeatsOneOfTwo, 750, 2), 1);

const twoSeatsMismatch = [
  state({ seatNumber: 5, observedAmount: 750, chipCount: 1 }),
  state({ seatNumber: 7, observedAmount: 1500, chipCount: 2 }),
];
assert.equal(sandbox.getUniformObservedAmountClicks(twoSeatsMismatch, 750, 2), null);

const oneSeatFourClicks = [state({
  baseAmount: 0,
  baseChipCount: 0,
  expectedAmount: 3000,
  observedAmount: null,
  chipCount: 4,
})];
assert.equal(sandbox.areObservedStatesSafelyAtExpectedAmount(oneSeatFourClicks, 750, 4), false);

const oneVisualChipFiveDomParts = [state({
  baseAmount: 0,
  baseChipCount: 0,
  expectedAmount: 7500,
  observedAmount: null,
  chipCount: 5,
})];
assert.equal(sandbox.areObservedStatesSafelyAtExpectedAmount(oneVisualChipFiveDomParts, 7500, 1), false);
assert.equal(sandbox.areObservedStatesSafelyAtSingleChipTarget(oneVisualChipFiveDomParts, 7500, 7500), true);
assert.equal(sandbox.getUniformObservedAmountClicks(oneVisualChipFiveDomParts, 7500, 1), null);

const walletBase = { detected: true, ambiguous: false, amount: 0 };
assert.equal(sandbox.getWalletBroadcastAppliedClicks(
  walletBase,
  { detected: true, ambiguous: false, amount: 1500 },
  750,
  2,
  2,
), 1);
assert.equal(sandbox.getWalletBroadcastAppliedClicks(
  walletBase,
  { detected: true, ambiguous: false, amount: 3000 },
  750,
  2,
  2,
), 2);
assert.equal(sandbox.getWalletBroadcastAppliedClicks(
  walletBase,
  { detected: true, ambiguous: false, amount: 1500 },
  750,
  4,
  2,
), null);

const seatInferenceSandbox = loadPartial('07-seats.js', {
  SINGLE_CHIP_DOM_PART_LIMIT: 8,
});
const unknownSingleVisualChip = {
  amountDetected: false,
  hasChip: true,
  hasGhost: false,
  chipCount: 2,
};
assert.equal(seatInferenceSandbox.canInferSeatAmountFromPlan(unknownSingleVisualChip, {
  totalActual: 3000,
  perSeatActual: 1500,
  chipPlan: [{ value: 750, count: 2 }],
}), false);
assert.equal(seatInferenceSandbox.canInferSeatAmountFromPlan(unknownSingleVisualChip, {
  totalActual: 3000,
  perSeatActual: 1500,
  chipPlan: [{ value: 1500, count: 1 }],
}), true);
seatInferenceSandbox.uniqueSortedSeatNumbers = numbers => [...new Set(numbers)].sort((a, b) => a - b);
seatInferenceSandbox.getMaxSeatCount = () => 1;
seatInferenceSandbox.toInt = value => Number(value);
seatInferenceSandbox.getSeatByNumber = seatNumber => ({ seatNumber });
seatInferenceSandbox.getSeatBetState = () => unknownSingleVisualChip;
seatInferenceSandbox.hasGhostChip = () => false;
const inferredSummary = seatInferenceSandbox.getTargetSeatBetSummary([5], {
  used: 1,
  totalActual: 1500,
  perSeatActual: 1500,
  chipPlan: [{ value: 1500, count: 1 }],
});
assert.equal(inferredSummary.amounts[0].amount, null, 'plan inference must not become a detected monetary amount');
assert.equal(inferredSummary.amounts[0].inferredAmount, 1500);
assert.equal(inferredSummary.ambiguousCount, 1);

{
  let sentClicks = 0;
  let walletAmount = 0;
  const seats = new Map([[5, { seatNumber: 5 }], [7, { seatNumber: 7 }]]);
  const batchSandbox = loadPartial('09-betting-clicks.js', {
    BET_CLICK_RETRY_LIMIT: 0,
    BET_NO_EFFECT_RETRY_LIMIT: 0,
    BROADCAST_CLICK_PROGRESS_WAIT_MS: 5,
    BET_NO_EFFECT_RECHECK_MS: 0,
    VERIFY_POLL_MS: 1,
    SEAT_CLICK_DELAY_MS: 0,
    SELECTED_STACK_CHIP_TTL_MS: 2500,
    lastSelectedStackChipValue: 0,
    lastSelectedStackChipAt: 0,
    Date,
    uniqueSortedSeatNumbers: numbers => [...new Set(numbers)].sort((a, b) => a - b),
    getSeatByNumber: number => seats.get(number) || null,
    // 첫 칩 하나가 DOM에서 1,500원으로 중복 파싱돼도 지갑 증가량은 실제 1회만 나타낸다.
    getSeatBetState: () => sentClicks > 0
      ? { amountDetected: true, amount: 1500, hasChip: true, chipCount: sentClicks * 2 }
      : { amountDetected: false, amount: null, hasChip: false, chipCount: 0 },
    getWalletTotalBetReading: () => ({ detected: true, ambiguous: false, amount: walletAmount }),
    isVisible: () => true,
    isDisabledLike: () => false,
    isScriptStopped: () => false,
    closeBetBlockingBottomSheetIfOpen: async () => false,
    getSeatBetClickElement: seat => seat,
    getSeatBetClickCandidates: seat => [seat],
    getElementLabel: () => 'seat',
    getBetClickProbeLabel: () => 'seat',
    markBetClickDebug: () => {},
    markBetClickGuard: () => {},
    pushBetLog: () => {},
    formatMoney: String,
    getSelectedChipAmount: () => 750,
    robustBetClick: () => {
      sentClicks++;
      walletAmount += 1500;
      return true;
    },
    sleep: async () => {},
    waitForCondition: async fn => fn(),
    hasGhostChip: () => false,
    getSeatDisplayedBetAmount: () => null,
  });

  assert.equal(await batchSandbox.clickMainBetChipBroadcastBatchVerified([5, 7], 750, 2, 1500), true);
  assert.equal(sentClicks, 2, '750 x2 plan must dispatch two verified broadcast clicks');
  assert.equal(walletAmount, 3000);

  batchSandbox.getBroadcastSeatTargetState = numbers => ({
    targets: numbers,
    live: [3, ...numbers],
    missing: [],
    extra: [3],
    exact: false,
  });
  const clicksBeforeMismatch = sentClicks;
  assert.equal(await batchSandbox.clickMainBetChipBroadcastBatchVerified([5, 7], 750, 2, 1500), false);
  assert.equal(sentClicks, clicksBeforeMismatch, 'an extra live seat must block before dispatching another chip click');
}

{
  let walletAmount = 3000;
  let sentClicks = 0;
  const seats = new Map([[5, { seatNumber: 5 }], [7, { seatNumber: 7 }]]);
  const continuationSandbox = loadPartial('09-betting-clicks.js', {
    BET_CLICK_RETRY_LIMIT: 0,
    BET_NO_EFFECT_RETRY_LIMIT: 0,
    BET_CLICK_VERIFY_MS: 0,
    BET_NO_EFFECT_RECHECK_MS: 0,
    VERIFY_POLL_MS: 1,
    SEAT_CLICK_DELAY_MS: 0,
    uniqueSortedSeatNumbers: numbers => [...new Set(numbers)].sort((a, b) => a - b),
    getSeatByNumber: number => seats.get(number) || null,
    getSeatBetState: () => ({ amountDetected: false, amount: null, hasChip: true, chipCount: 2 }),
    getSeatDisplayedBetAmount: () => null,
    getWalletTotalBetReading: () => ({ detected: true, ambiguous: false, amount: walletAmount }),
    getBroadcastSeatTargetState: numbers => ({ targets: numbers, live: numbers, missing: [], extra: [], exact: true }),
    isVisible: () => true,
    isDisabledLike: () => false,
    isScriptStopped: () => false,
    closeBetBlockingBottomSheetIfOpen: async () => false,
    getSeatBetClickElement: seat => seat,
    getSeatBetClickCandidates: seat => [seat],
    getElementLabel: () => 'seat',
    getBetClickProbeLabel: () => 'seat',
    markBetClickDebug: () => {},
    markBetClickGuard: () => {},
    pushBetLog: () => {},
    formatMoney: String,
    getSelectedChipAmount: () => 750,
    getRememberedSelectedStackChipAmount: () => 0,
    robustBetClick: () => {
      sentClicks++;
      walletAmount += 1500;
      return true;
    },
    sleep: async () => {},
    waitForCondition: async fn => fn(),
    hasGhostChip: () => false,
    Date,
  });

  assert.equal(await continuationSandbox.clickMainBetChipBroadcastVerified(
    [5, 7],
    750,
    1,
    2250,
    { expectedBasePerSeatAmount: 1500, expectedWalletBaseAmount: 3000 },
  ), true, 'verified wallet baseline must allow the next denomination when seat text is temporarily unreadable');
  assert.equal(sentClicks, 1);
  assert.equal(walletAmount, 4500);
}

const hardCap = [state({ observedAmount: 1500, expectedAmount: 1500, hasGhost: false })];
assert.equal(sandbox.areObservedStatesAtHardCap(hardCap, 1500), true);

const ghostBlocked = [state({ observedAmount: 1500, expectedAmount: 1500, hasGhost: true })];
assert.equal(sandbox.areObservedStatesSafelyAtExpectedAmount(ghostBlocked, 750, 2), false);
assert.equal(sandbox.areObservedStatesAtHardCap(ghostBlocked, 1500), false);

sandbox.getSelectedChipAmount = () => 60000;
assert.equal(sandbox.isSelectedChipSafeForSeatClick(7500, 7500), false);
assert.equal(sandbox.isSelectedChipSafeForSeatClick(60000, 7500), false);
sandbox.getSelectedChipAmount = () => 7500;
assert.equal(sandbox.isSelectedChipSafeForSeatClick(7500, 7500), true);
sandbox.getSelectedChipAmount = () => 0;
assert.equal(sandbox.isSelectedChipSafeForSeatClick(7500, 7500), false);

function makeStackButton(value) {
  return {
    textContent: String(value),
    closest: selector => selector === 'button[data-testid^="chip-stack-value-"]' ? stackButton : null,
    matches: selector => selector === 'button[data-testid^="chip-stack-value-"]',
    getAttribute: name => name === 'data-testid' ? `chip-stack-value-${value}` : null,
  };
}

const stackButton = makeStackButton(7500);
const stackLogs = [];
const stackSandbox = loadPartial('09-betting-clicks.js', {
  console,
  Date,
  SELECTED_STACK_CHIP_TTL_MS: 2500,
  lastSelectedStackChipValue: 0,
  lastSelectedStackChipAt: 0,
  CLICK_DELAY_MS: 0,
  isScriptStopped: () => false,
  closeBetBlockingBottomSheetIfOpen: async () => false,
  findChipByValue: value => value === 7500 ? stackButton : null,
  pushBetLog: (level, message, data) => stackLogs.push({ level, message, data }),
  formatMoney: n => String(n),
  getElementLabel: el => el.getAttribute?.('data-testid') || 'button',
  detectAvailableChips: () => [{ value: 7500, element: stackButton }],
  robustClick: () => true,
  sleep: async () => {},
  getSelectedChipAmount: () => 0,
});
assert.equal(await stackSandbox.selectChipByValue(7500), true);
assert.equal(stackSandbox.isSelectedChipSafeForSeatClick(7500, 7500), true);
assert.equal(stackLogs.some(log => log.message === 'select_chip_ok_stack'), true);

console.log('betting progress regression tests passed');
