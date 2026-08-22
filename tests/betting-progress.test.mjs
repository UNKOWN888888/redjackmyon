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
assert.equal(sandbox.getUniformObservedChipClicks(oneOfTwoByAmount, 750, 2, false), 1);
assert.equal(sandbox.getUniformObservedChipClicks(oneOfTwoByAmount, 750, 2, true), 1);

const twoOfTwoByAmount = [state({ observedAmount: 1500, chipCount: 2 })];
assert.equal(sandbox.getUniformObservedChipClicks(twoOfTwoByAmount, 750, 2, false), 2);
assert.equal(sandbox.areObservedStatesSafelyAtExpectedByChipCount(twoOfTwoByAmount, 750, 2), true);

const oneOfTwoByChipCount = [state({ observedAmount: null, chipCount: 1 })];
assert.equal(sandbox.getUniformObservedChipClicks(oneOfTwoByChipCount, 750, 2, false), 1);
assert.equal(sandbox.getUniformObservedChipClicks(oneOfTwoByChipCount, 750, 2, true), null);

const twoSeatsOneOfTwo = [
  state({ seatNumber: 5, observedAmount: 750, chipCount: 1 }),
  state({ seatNumber: 7, observedAmount: 750, chipCount: 1 }),
];
assert.equal(sandbox.getUniformObservedChipClicks(twoSeatsOneOfTwo, 750, 2, false), 1);

const twoSeatsMismatch = [
  state({ seatNumber: 5, observedAmount: 750, chipCount: 1 }),
  state({ seatNumber: 7, observedAmount: 1500, chipCount: 2 }),
];
assert.equal(sandbox.getUniformObservedChipClicks(twoSeatsMismatch, 750, 2, false), null);

const oneSeatFourClicks = [state({
  baseAmount: 0,
  baseChipCount: 0,
  expectedAmount: 3000,
  observedAmount: null,
  chipCount: 4,
})];
assert.equal(sandbox.areObservedStatesSafelyAtExpectedByChipCount(oneSeatFourClicks, 750, 4), true);

const oneVisualChipFiveDomParts = [state({
  baseAmount: 0,
  baseChipCount: 0,
  expectedAmount: 7500,
  observedAmount: null,
  chipCount: 5,
})];
assert.equal(sandbox.areObservedStatesSafelyAtExpectedByChipCount(oneVisualChipFiveDomParts, 7500, 1), false);
assert.equal(sandbox.areObservedStatesSafelyAtSingleChipTarget(oneVisualChipFiveDomParts, 7500, 7500), true);
assert.equal(sandbox.getUniformObservedChipClicks(oneVisualChipFiveDomParts, 7500, 1, false), null);

const hardCap = [state({ observedAmount: 1500, expectedAmount: 1500, hasGhost: false })];
assert.equal(sandbox.areObservedStatesAtHardCap(hardCap, 1500), true);

const ghostBlocked = [state({ observedAmount: 1500, expectedAmount: 1500, hasGhost: true })];
assert.equal(sandbox.areObservedStatesSafelyAtExpectedByChipCount(ghostBlocked, 750, 2), false);
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
