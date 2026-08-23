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
let selectedStackAmount = 0;
let stackSelectionClicks = 0;
const stackSandbox = loadPartial('09-betting-clicks.js', {
  console,
  Date,
  SELECTED_STACK_CHIP_TTL_MS: 2500,
  lastSelectedStackChipValue: 0,
  lastSelectedStackChipAt: 0,
  CLICK_DELAY_MS: 0,
  CHIP_SELECTION_VERIFY_MS: 0,
  CHIP_SELECTION_SETTLE_MS: 0,
  VERIFY_POLL_MS: 1,
  isScriptStopped: () => false,
  closeBetBlockingBottomSheetIfOpen: async () => false,
  findChipByValue: value => value === 7500 ? stackButton : null,
  pushBetLog: (level, message, data) => stackLogs.push({ level, message, data }),
  formatMoney: n => String(n),
  getElementLabel: el => el.getAttribute?.('data-testid') || 'button',
  detectAvailableChips: () => [{ value: 7500, element: stackButton }],
  robustClick: () => { stackSelectionClicks++; return true; },
  sleep: async () => {},
  waitForCondition: async fn => fn(),
  getSelectedChipAmount: () => selectedStackAmount,
  isStackChipButtonSelected: () => false,
});
assert.equal(await stackSandbox.selectChipByValue(7500), true);
assert.equal(stackSandbox.isSelectedChipSafeForSeatClick(7500, 7500), true);
assert.equal(stackLogs.some(log => log.message === 'select_chip_ok_stack'), true);
assert.equal(stackSelectionClicks, 1);
selectedStackAmount = 7500;
assert.equal(await stackSandbox.selectChipByValue(7500), true);
assert.equal(stackSelectionClicks, 1, 'an already-selected stack chip must not be clicked again before a seat retry');
assert.equal(stackLogs.some(log => log.message === 'select_chip_reused'), true);

{
  let selectedAmount = 0;
  let walletAmount = 0;
  let chipSelectionClicks = 0;
  let seatBetClicks = 0;
  const retryLogs = [];
  const retryStackButton = {
    textContent: '15000',
    closest: selector => selector === 'button[data-testid^="chip-stack-value-"]' ? retryStackButton : null,
    matches: selector => selector === 'button[data-testid^="chip-stack-value-"]',
    getAttribute: name => name === 'data-testid' ? 'chip-stack-value-15000' : null,
  };
  const seats = new Map([1, 2, 3, 4].map(seatNumber => [seatNumber, { seatNumber }]));
  const retrySandbox = loadPartial('09-betting-clicks.js', {
    BET_CLICK_RETRY_LIMIT: 2,
    BET_NO_EFFECT_RETRY_LIMIT: 2,
    BET_CLICK_VERIFY_MS: 0,
    BET_NO_EFFECT_RECHECK_MS: 0,
    VERIFY_POLL_MS: 1,
    SEAT_CLICK_DELAY_MS: 0,
    SELECTED_STACK_CHIP_TTL_MS: 2500,
    CHIP_SELECTION_VERIFY_MS: 0,
    CHIP_SELECTION_SETTLE_MS: 0,
    CLICK_DELAY_MS: 0,
    lastSelectedStackChipValue: 0,
    lastSelectedStackChipAt: 0,
    Date,
    uniqueSortedSeatNumbers: numbers => [...new Set(numbers)].sort((a, b) => a - b),
    getSeatByNumber: number => seats.get(number) || null,
    getSeatBetState: () => ({ amountDetected: false, amount: null, hasChip: false, chipCount: 0 }),
    getSeatDisplayedBetAmount: () => null,
    getWalletTotalBetReading: () => ({ detected: true, ambiguous: false, amount: walletAmount }),
    getBroadcastSeatTargetState: numbers => ({ targets: numbers, live: numbers, missing: [], extra: [], unresolvedReserved: [], exact: true }),
    isVisible: () => true,
    isDisabledLike: () => false,
    isScriptStopped: () => false,
    closeBetBlockingBottomSheetIfOpen: async () => false,
    findChipByValue: value => value === 15000 ? retryStackButton : null,
    detectAvailableChips: () => [{ value: 15000, element: retryStackButton }],
    getSelectedChipAmount: () => selectedAmount,
    isStackChipButtonSelected: () => false,
    isTrayChipSelected: () => false,
    robustClick: () => {
      chipSelectionClicks++;
      selectedAmount = 15000;
      return true;
    },
    getSeatBetClickElement: seat => seat,
    getSeatBetClickCandidates: seat => [seat],
    getElementLabel: el => el === retryStackButton ? 'chip-stack-value-15000' : `mainbetSeat_${el.seatNumber}`,
    getBetClickProbeLabel: () => 'seat-probe',
    markBetClickDebug: () => {},
    markBetClickGuard: () => {},
    pushBetLog: (level, message, data) => retryLogs.push({ level, message, data }),
    formatMoney: String,
    robustBetClick: () => {
      seatBetClicks++;
      if (seatBetClicks === 2) walletAmount = 60000;
      return true;
    },
    sleep: async () => {},
    waitForCondition: async fn => fn(),
    hasGhostChip: () => false,
  });

  assert.equal(await retrySandbox.selectChipByValue(15000), true);
  assert.equal(await retrySandbox.clickMainBetChipBroadcastVerified(
    [1, 2, 3, 4],
    15000,
    1,
    22500,
    { expectedBasePerSeatAmount: 0, expectedWalletBaseAmount: 0 },
  ), true);
  assert.equal(seatBetClicks, 2, 'the unchanged first seat click must retry once');
  assert.equal(chipSelectionClicks, 1, 'the selected 15,000 chip must not be clicked again during the seat retry');
  assert.equal(walletAmount, 60000, 'one verified broadcast click must add exactly 15,000 to each of four seats');
  assert.equal(retryLogs.some(log => log.message === 'select_chip_reused'), true);
}

{
  const mainBetSvg = {
    closest: () => null,
  };
  const ghostChip = {
    closest: selector => selector === 'svg' ? mainBetSvg : null,
  };
  const directSeat = {
    getAttribute: name => name === 'data-testid' ? 'mainbetSeat_5' : null,
    closest: () => null,
    querySelector: selector => selector.includes('ghost-chip') ? ghostChip : (selector === 'svg' ? mainBetSvg : null),
  };
  const directSpot = {
    querySelector: () => null,
    closest: () => null,
  };
  const rootSeat = {
    querySelector: () => null,
    closest: () => null,
  };
  const doc = {
    querySelector: selector => {
      if (selector === '[data-testid="mainbetSeat_5"]') return directSeat;
      if (selector === '[data-testid="mainbet_5"]') return directSpot;
      if (selector === '[data-testid="seat_5"]') return rootSeat;
      return null;
    },
  };
  const sourceSeat = { ownerDocument: doc, querySelector: () => null };
  const candidateSandbox = loadPartial('07-seats.js', {
    SINGLE_CHIP_DOM_PART_LIMIT: 8,
    SEAT_CLOSE_ICON_SELECTOR: '[data-testid="close-icon"]',
  });
  candidateSandbox.getSeatNumber = () => 5;
  candidateSandbox.findMainBetSpot = () => directSpot;
  candidateSandbox.getSeatWrapper = () => rootSeat;
  candidateSandbox.getSeatBetAmountInfo = () => null;
  candidateSandbox.isVisible = () => true;
  candidateSandbox.isDisabledLike = () => false;

  const candidates = candidateSandbox.getSeatBetClickCandidates(sourceSeat);
  assert.equal(candidates[0], directSeat, 'the stable mainbetSeat element must be the primary click candidate');
  assert.equal(candidates[1], ghostChip, 'the visible ghost chip must be the first fallback candidate');
  assert.equal(candidates[2], mainBetSvg, 'the main-bet SVG must remain an exact visual fallback');
  assert.equal(candidates[3], directSpot, 'the enclosing mainbet spot must remain a later fallback');
}

{
  const dispatches = [];
  let hitTarget = null;
  const directSpot = { contains: candidate => [directSpot, directSeat, svgPath].includes(candidate) };
  const directSeat = {
    ownerDocument: null,
    getAttribute: name => name === 'data-testid' ? 'mainbetSeat_5' : null,
    closest: selector => {
      if (selector === '[data-testid^="mainbet_"]') return directSpot;
      if (selector.includes('[data-testid^="mainbetSeat_"]')) return directSeat;
      return null;
    },
  };
  const svgPath = {
    ownerDocument: null,
    getAttribute: name => name === 'data-testid' ? 'ghost-chip' : null,
    closest: selector => {
      if (selector === '[data-testid^="mainbet_"]') return directSpot;
      if (selector.includes('[data-testid^="mainbetSeat_"]')) return directSeat;
      return null;
    },
  };
  const outsideOverlay = {
    getAttribute: () => null,
    closest: () => null,
  };
  const doc = { elementFromPoint: () => hitTarget };
  directSeat.ownerDocument = doc;
  svgPath.ownerDocument = doc;
  hitTarget = svgPath;

  const clickSandbox = loadPartial('04-clicks.js', {
    SEAT_CLOSE_ICON_SELECTOR: '[data-testid="close-icon"]',
    lastBetClickDebug: '',
    lastBetClickDebugAt: 0,
    Date,
  });
  clickSandbox.isVisible = () => true;
  clickSandbox.getSafeBetClickPoints = () => [{ x: 27, y: 27 }];
  clickSandbox.fireFullClick = (target, x, y, options) => {
    dispatches.push({ target, x, y, options });
    return true;
  };
  clickSandbox.invalidateDynamicCaches = () => {};

  assert.equal(clickSandbox.robustBetClick(directSeat, { attempt: 0 }), true);
  assert.equal(dispatches[0].target, svgPath, 'the event must preserve the actual safe visual hit target');
  assert.equal(dispatches[0].options.profile, 'mouse');
  assert.equal(dispatches[0].options.nativeClick, false);

  hitTarget = outsideOverlay;
  assert.equal(clickSandbox.robustBetClick(svgPath, { attempt: 1 }), true);
  assert.equal(dispatches[1].target, svgPath, 'an unrelated overlay hit must fall back to the exact ghost-chip candidate');
  assert.equal(dispatches[1].options.profile, 'mouse');
  assert.equal(dispatches[1].options.nativeClick, false);

  hitTarget = svgPath;
  assert.equal(clickSandbox.robustBetClick(svgPath, { attempt: 2 }), true);
  assert.equal(dispatches[2].target, svgPath);
  assert.equal(dispatches[2].options.profile, 'touch');
  assert.match(clickSandbox.getBetClickProbeLabel(svgPath), /hit=ghost-chip\(inside\),candidate=ghost-chip,boundary=.*dispatch=ghost-chip/);
}

{
  let walletAmount = 60000;
  let sentClicks = 0;
  const seats = new Map([1, 2, 3, 4].map(seatNumber => [seatNumber, { seatNumber }]));
  const staleSeatAmountSandbox = loadPartial('09-betting-clicks.js', {
    BET_CLICK_RETRY_LIMIT: 0,
    BET_NO_EFFECT_RETRY_LIMIT: 0,
    BET_CLICK_VERIFY_MS: 0,
    BET_NO_EFFECT_RECHECK_MS: 0,
    VERIFY_POLL_MS: 1,
    SEAT_CLICK_DELAY_MS: 0,
    uniqueSortedSeatNumbers: numbers => [...new Set(numbers)].sort((a, b) => a - b),
    getSeatByNumber: number => seats.get(number) || null,
    // 실제 좌석당 15,000원인데 DOM 파서가 지갑 합계 60,000원을 각 좌석 값처럼 반환하는 상황.
    getSeatBetState: () => ({ amountDetected: true, amount: 60000, hasChip: true, chipCount: 1 }),
    getSeatDisplayedBetAmount: () => 60000,
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
    getSelectedChipAmount: () => 7500,
    getRememberedSelectedStackChipAmount: () => 0,
    robustBetClick: () => {
      sentClicks++;
      walletAmount += 30000;
      return true;
    },
    sleep: async () => {},
    waitForCondition: async fn => fn(),
    hasGhostChip: () => false,
    Date,
  });

  const options = {
    expectedBasePerSeatAmount: 15000,
    expectedWalletBaseAmount: 60000,
  };
  assert.equal(await staleSeatAmountSandbox.clickMainBetChipBroadcastVerified(
    [1, 2, 3, 4], 7500, 1, 22500, options,
  ), false, 'a stale detected seat amount must remain blocked without an internally verified continuation flag');
  assert.equal(sentClicks, 0);

  assert.equal(await staleSeatAmountSandbox.clickMainBetChipBroadcastVerified(
    [1, 2, 3, 4], 7500, 1, 22500, { ...options, allowWalletDerivedSeatBaseline: true },
  ), true, 'exact 60,000 wallet progress must allow the final 7,500 broadcast step for four verified seats');
  assert.equal(sentClicks, 1);
  assert.equal(walletAmount, 90000);
}

console.log('betting progress regression tests passed');
