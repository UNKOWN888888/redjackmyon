import assert from 'node:assert/strict';
import { loadPartial } from './helpers/load-partial.mjs';

const sandbox = loadPartial('06-chips.js', {
  console,
  qsaDeep: () => [],
  isVisible: () => true,
  isDisabledLike: () => false,
  isInsideBetSeat: () => false,
  parseNumber: text => {
    const m = String(text || '').replace(/,/g, '').match(/\d+/);
    return m ? Number(m[0]) : null;
  },
  parseMoneySum: () => 0,
  parseStrictChipAmount: () => NaN,
  cachedMinChipValue: 1,
  _chipDetectCache: null,
  _chipDetectCacheAt: 0,
  CHIP_DETECT_CACHE_MS: 45,
});

function planFor(totalAmount, seatCount, chipValues) {
  const perSeat = Math.floor(totalAmount / seatCount);
  return sandbox.planChipsForAmount(perSeat, chipValues.map(value => ({ value })));
}

function planText(plan) {
  return plan.plan.map(spec => `${spec.value}x${spec.count}`).join('+');
}

const only1500 = planFor(3000, 2, [1500]);
assert.equal(only1500.actualTotal, 1500);
assert.equal(planText(only1500), '1500x1');

const only750TwoSeats = planFor(3000, 2, [750]);
assert.equal(only750TwoSeats.actualTotal, 1500);
assert.equal(planText(only750TwoSeats), '750x2');

const both = planFor(3000, 2, [1500, 750]);
assert.equal(both.actualTotal, 1500);
assert.equal(planText(both), '1500x1');

const only750OneSeat = planFor(3000, 1, [750]);
assert.equal(only750OneSeat.actualTotal, 3000);
assert.equal(planText(only750OneSeat), '750x4');

const noOverBet = planFor(3000, 2, [2000, 750]);
assert.equal(noOverBet.actualTotal, 1500);
assert.equal(planText(noOverBet), '750x2');

const seatPlanSandbox = loadPartial('08-seat-plan.js', {
  ...sandbox,
  AUTO_SEAT_COUNT: true,
  forcedAutoSeatCount: 3,
  TARGET_BET_AMOUNT: 30000,
  getMaxSeatCount: () => 4,
  toInt: (value, fallback, min, max) => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  },
});
const forcedThreeButExactTwo = seatPlanSandbox.getSeatPlan(3, [7500, 1500].map(value => ({ value })));
assert.equal(forcedThreeButExactTwo.used, 2);
assert.equal(forcedThreeButExactTwo.perSeatActual, 15000);
assert.equal(forcedThreeButExactTwo.totalActual, 30000);
assert.equal(planText({ plan: forcedThreeButExactTwo.chipPlan }), '7500x2');

const declaredButton = {
  textContent: '60,000',
  getAttribute: name => name === 'data-testid' ? 'chip-stack-value-7500' : '',
};
const declaredChip = {
  closest: selector => selector === 'button[data-testid^="chip-stack-value-"]' ? declaredButton : null,
};
assert.equal(sandbox.getChipStackButtonValue(declaredChip), 7500);

const progressSandbox = loadPartial('02-diagnostics.js', {});
const multiChipPlan = [
  { value: 15000, count: 1 },
  { value: 7500, count: 1 },
];
assert.deepEqual(
  JSON.parse(JSON.stringify(progressSandbox.getRemainingChipPlanFromAppliedPerSeat(multiChipPlan, 15000))),
  [{ value: 7500, count: 1 }],
);
assert.deepEqual(
  JSON.parse(JSON.stringify(progressSandbox.getRemainingChipPlanFromAppliedPerSeat(multiChipPlan, 22500))),
  [],
);
assert.equal(progressSandbox.getRemainingChipPlanFromAppliedPerSeat(multiChipPlan, 7500), null);

{
  let walletAmount = 60000;
  const resumeSandbox = loadPartial('02-diagnostics.js', {
    Date,
    verifiedBetProgress: null,
    VERIFIED_BET_PROGRESS_TTL_MS: 120000,
    TARGET_BET_AMOUNT: 90000,
    SEAT_COUNT: 4,
    AUTO_SEAT_COUNT: true,
    getWalletTotalBetReading: () => ({ detected: true, ambiguous: false, amount: walletAmount }),
    getBroadcastSeatTargetState: numbers => ({ exact: numbers.join(',') === '1,2,3,4' }),
    getSeatByNumber: seatNumber => ({ seatNumber }),
    getSeatBetState: () => ({ hasChip: true }),
    hasGhostChip: () => false,
  });
  const plan = {
    used: 4,
    perSeatActual: 22500,
    totalActual: 90000,
    chipPlan: multiChipPlan,
  };
  resumeSandbox.updateVerifiedBetProgress(plan, [1, 2, 3, 4], 15000, { source: 'test' });
  const resume = resumeSandbox.getResumableVerifiedBetProgress(plan, [1, 2, 3, 4]);
  assert.equal(resume?.walletAmount, 60000);
  assert.equal(resume?.nextChip, 7500);
  assert.deepEqual(JSON.parse(JSON.stringify(resume?.remainingChipPlan)), [{ value: 7500, count: 1 }]);
  walletAmount = 90000;
  assert.equal(resumeSandbox.getResumableVerifiedBetProgress(plan, [1, 2, 3, 4]), null, 'resume must stop when the live wallet no longer matches the verified checkpoint');
}

{
  const selectedRing = { visible: true };
  const hiddenRing = { visible: false };
  const makeButton = (value, ring) => ({
    textContent: String(value),
    closest(selector) {
      return selector === 'button[data-testid^="chip-stack-value-"]' ? this : null;
    },
    getAttribute(name) {
      return name === 'data-testid' ? `chip-stack-value-${value}` : null;
    },
    querySelector(selector) {
      return selector === `[data-testid="chip-stack-value-${value}-ring"]` ? ring : null;
    },
  });
  const buttons = [makeButton(15000, selectedRing), makeButton(7500, hiddenRing)];
  const selectionSandbox = loadPartial('06-chips.js', {
    qsaDeep: selector => selector === 'button[data-testid^="chip-stack-value-"]' ? buttons : [],
    isVisible: element => element?.visible !== false,
    isDisabledLike: () => false,
    parseNumber: Number,
    parseMoneySum: Number,
    parseStrictChipAmount: Number,
    cachedMinChipValue: 1,
    _chipDetectCache: null,
    _chipDetectCacheAt: 0,
    CHIP_DETECT_CACHE_MS: 45,
  });
  assert.equal(selectionSandbox.getSelectedStackChipAmount(), 15000);
  selectedRing.visible = false;
  hiddenRing.visible = true;
  assert.equal(selectionSandbox.getSelectedStackChipAmount(), 7500);
}

console.log('chip plan regression tests passed');
