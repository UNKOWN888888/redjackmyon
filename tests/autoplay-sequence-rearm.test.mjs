import assert from 'node:assert/strict';
import { loadPartial } from './helpers/load-partial.mjs';

const noop = () => {};
const asyncTrue = async () => true;

function baseSequenceSandbox(overrides = {}) {
  const autoplayBtn = { kind: 'autoplay' };
  const startBtn = { kind: 'start' };
  let roundDetected = false;
  let startClickCount = 0;
  let autoplayClickCount = 0;

  const sandbox = loadPartial('15-main-sequence.js', {
    console,
    Date,
    setInterval: () => 0,
    syncSettingsFromUI: noop,
    isScriptStopped: () => false,
    isRunning: false,
    isAutomationLocked: () => false,
    lastFailReason: null,
    isBetClickGuardActive: () => false,
    lastBetClickGuardReason: '',
    observeAutoplayRoundNumber: () => (roundDetected ? 100 : null),
    getControlledSeatNumbers: () => [],
    rememberTargetSeatNumbers: noop,
    getPlannedSeatLimit: () => 7,
    getRememberedBetSeatNumbers: () => [],
    getExpectedBetPlan: () => ({ totalActual: 3000 }),
    areBetSeatsReadyForRoundAction: () => true,
    getTargetSeatBetSummary: () => ({ ambiguousCount: 0 }),
    isBetSummaryWalletConfirmed: () => false,
    getUnknownBetWalletRecovery: () => ({ recoverable: false, variance: null }),
    isBettingWindowOpen: () => false,
    markBetSettingsApplied: noop,
    isBetSettingsApplied: () => true,
    isTargetBetTotalMismatch: () => false,
    isAutoplayButtonReady: () => true,
    betSettingsDirty: false,
    stopAutoplayIfRunning: asyncTrue,
    setupBetAmount: asyncTrue,
    sleep: async () => {},
    waitForCondition: async fn => !!fn(),
    getAutoplayButton: () => autoplayBtn,
    verifyAutoplayStartSafety: () => true,
    pushBetLog: noop,
    formatMoney: String,
    getElementLabel: el => el?.kind || 'el',
    robustClick: el => {
      if (el === autoplayBtn) autoplayClickCount++;
      if (el === startBtn) {
        startClickCount++;
        roundDetected = true;
      }
    },
    AUTOPLAY_START_ROUNDS: 100,
    getClickableByMarker: () => startBtn,
    AUTOPLAY_MENU_WAIT_MS: 100,
    AUTOBET_COUNT_VERIFY_MS: 100,
    markBetStateNeedsRecovery: noop,
    qsaDeep: () => [],
    isVisible: () => true,
    lastTriggerAt: 0,
    clearSupportPopupReloadRecovery: noop,
    FAST_SEAT_CHECK_INTERVAL_MS: 999999,
    handleImmediateSeatOpportunities: noop,
    INSURANCE_WATCH_INTERVAL_MS: 999999,
    checkAndClickInsuranceNo: noop,
    AUTOPLAY_BUTTON_READY_WAIT_MS: 100,
    autoplayStartCount: 0,
    ...overrides,
  });

  return {
    sandbox,
    get startClickCount() { return startClickCount; },
    get autoplayClickCount() { return autoplayClickCount; },
    setRoundDetected(value) { roundDetected = value; },
    autoplayBtn,
    startBtn,
  };
}

async function testRunSequenceRecomputesPlanAfterSetup() {
  let currentPlan = { totalActual: 6000, used: 2 };
  let setupCalled = false;
  let safetyPlan = null;

  const env = baseSequenceSandbox({
    getExpectedBetPlan: () => currentPlan,
    areBetSeatsReadyForRoundAction: () => setupCalled,
    isBettingWindowOpen: () => true,
    isBetSettingsApplied: () => false,
    isTargetBetTotalMismatch: () => true,
    betSettingsDirty: true,
    setupBetAmount: async () => {
      setupCalled = true;
      currentPlan = { totalActual: 3000, used: 1 };
      return true;
    },
    verifyAutoplayStartSafety: plan => {
      safetyPlan = plan;
      return true;
    },
  });

  await env.sandbox.runSequence();

  assert.equal(setupCalled, true);
  assert.equal(safetyPlan?.totalActual, 3000, 'runSequence must verify autoplay with the plan recomputed after setupBetAmount()');
  assert.equal(env.startClickCount, 1);
}

async function testRunSequenceBlocksAutoplayWhenSetupDoesNotProduceReadyBet() {
  const env = baseSequenceSandbox({
    areBetSeatsReadyForRoundAction: () => false,
    isBettingWindowOpen: () => true,
    isBetSettingsApplied: () => false,
    isTargetBetTotalMismatch: () => true,
    betSettingsDirty: true,
    setupBetAmount: async () => true,
  });

  await env.sandbox.runSequence();

  assert.equal(env.autoplayClickCount, 0);
  assert.equal(env.startClickCount, 0);
  assert.equal(env.sandbox.lastFailReason, 'bet_not_ready_after_setup');
}

async function testRunSequenceRechecksSafetyImmediatelyBeforeStartClick() {
  let safetyCalls = 0;
  let dialogClosed = false;

  const env = baseSequenceSandbox({
    verifyAutoplayStartSafety: () => {
      safetyCalls++;
      return safetyCalls === 1;
    },
    closeAutoplayDialogIfOpen: () => {
      dialogClosed = true;
      return true;
    },
  });

  await env.sandbox.runSequence();

  assert.equal(safetyCalls, 2, 'runSequence must run safety check again after the autoplay menu opens');
  assert.equal(env.startClickCount, 0, 'start button must not be clicked if the second safety check fails');
  assert.equal(dialogClosed, true, 'autoplay menu should be closed when the second safety check fails');
}

async function testUnknownAmountUnderTargetTriggersBetRecovery() {
  let setupCalled = false;
  let recoveryReason = null;
  const env = baseSequenceSandbox({
    getExpectedBetPlan: () => ({ totalActual: 3000, perSeatActual: 1500, used: 2 }),
    getControlledSeatNumbers: () => [5, 7],
    getRememberedBetSeatNumbers: () => [5, 7],
    getTargetSeatBetSummary: () => ({ ambiguousCount: 2 }),
    isBetSummaryWalletConfirmed: () => false,
    getUnknownBetWalletRecovery: () => ({
      recoverable: true,
      reason: 'bet_amount_unknown_under_target',
      variance: {
        status: 'under',
        expected: 3000,
        reading: { amount: 1500 },
      },
    }),
    areBetSeatsReadyForRoundAction: () => false,
    isBettingWindowOpen: () => true,
    isBetSettingsApplied: () => false,
    markBetStateNeedsRecovery: reason => {
      recoveryReason = reason;
      return true;
    },
    setupBetAmount: async () => {
      setupCalled = true;
      return true;
    },
  });

  await env.sandbox.runSequence();

  assert.equal(recoveryReason, 'bet_amount_unknown_under_target');
  assert.equal(setupCalled, true, 'wallet-confirmed underbet must be reset instead of waiting forever');
}

function baseRearmSandbox(overrides = {}) {
  let clickCount = 0;
  const autoplayBtn = { kind: 'autoplay' };
  const startBtn = { kind: 'start' };
  let roundDetected = false;

  const sandbox = loadPartial('14-autoplay-rearm.js', {
    console,
    Date,
    isScriptStopped: () => false,
    isRunning: false,
    isBetSetupRunning: false,
    isAutomationLocked: () => false,
    lastAutoplayRearmAt: 0,
    AUTOPLAY_REARM_COOLDOWN_MS: 100,
    isAutoplayRunning: () => roundDetected,
    isBetSettingsApplied: () => true,
    isAutoplayButtonReady: () => true,
    betSettingsDirty: false,
    isBettingWindowOpen: () => false,
    areBetSeatsReadyForRoundAction: () => true,
    verifyAutoplayStartSafety: () => true,
    getExpectedBetPlan: () => ({ totalActual: 3000 }),
    getAutoplayButton: () => autoplayBtn,
    pushBetLog: noop,
    getElementLabel: el => el?.kind || 'el',
    robustClick: el => {
      clickCount++;
      if (el === startBtn) roundDetected = true;
    },
    sleep: async () => {},
    waitForCondition: async fn => !!fn(),
    getClickableByMarker: () => startBtn,
    AUTOPLAY_START_ROUNDS: 100,
    AUTOPLAY_MENU_WAIT_MS: 100,
    observeAutoplayRoundNumber: () => (roundDetected ? 100 : null),
    AUTOBET_COUNT_VERIFY_MS: 100,
    qsaDeep: () => [],
    isVisible: () => true,
    lastTriggerAt: 0,
    lastFailReason: null,
    autoplayStartCount: 0,
    autoplayRearmCount: 0,
    ...overrides,
  });

  return {
    sandbox,
    get clickCount() { return clickCount; },
    get roundDetected() { return roundDetected; },
    startBtn,
    autoplayBtn,
  };
}

async function testRearmBlocksDirtyBetSettings() {
  const env = baseRearmSandbox({ betSettingsDirty: true });

  const result = await env.sandbox.reArmAutoplayOnly();

  assert.equal(result, false, 'dirty bet settings must block re-arm-only autoplay restart');
  assert.equal(env.clickCount, 0, 'dirty bet settings must block autoplay/start button clicks');
}

async function testRearmRechecksSafetyImmediatelyBeforeStartClick() {
  let safetyCalls = 0;
  let dialogClosed = false;
  const env = baseRearmSandbox({
    verifyAutoplayStartSafety: () => {
      safetyCalls++;
      return safetyCalls === 1;
    },
    closeAutoplayDialogIfOpen: () => {
      dialogClosed = true;
      return true;
    },
  });

  const result = await env.sandbox.reArmAutoplayOnly();

  assert.equal(result, false, 're-arm must stop if the second safety check fails');
  assert.equal(safetyCalls, 2, 're-arm must re-check safety after the autoplay menu opens');
  assert.equal(env.roundDetected, false, 're-arm start button must not be clicked after a failed second safety check');
  assert.equal(dialogClosed, true, 're-arm should close the autoplay menu when the second safety check fails');
}

function testRunningThresholdTopUpIgnoresRoundBetVariance() {
  let walletSafetyReads = 0;
  const modifyButton = { kind: 'modify' };
  const sandbox = loadPartial('14-autoplay-rearm.js', {
    Date,
    THRESHOLD: 100,
    AUTOPLAY_THRESHOLD_RESTART_COOLDOWN_MS: 900,
    lastAutoplayThresholdRestartAt: 0,
    isBetSettingsApplied: () => true,
    betSettingsDirty: false,
    isAutoplayRunning: () => true,
    getAutoplayModifyButton: () => modifyButton,
    isBettingWindowOpen: () => true,
    areBetSeatsReadyForRoundAction: () => false,
    getWalletTotalBetVariance: () => {
      walletSafetyReads++;
      return { status: 'increased' };
    },
    getExpectedBetPlan: () => ({ totalActual: 3000 }),
    getVisibleDecisionPanelInfo: () => ({ active: true }),
    isAutoplayButtonReady: () => false,
  });

  assert.equal(sandbox.shouldRestartAutoplayForThreshold(90, [5, 7]), true);
  assert.equal(walletSafetyReads, 0, 'running +10 top-up must not be blocked by current hand wallet variance');
}

await testRunSequenceRecomputesPlanAfterSetup();
await testRunSequenceBlocksAutoplayWhenSetupDoesNotProduceReadyBet();
await testRunSequenceRechecksSafetyImmediatelyBeforeStartClick();
await testUnknownAmountUnderTargetTriggersBetRecovery();
await testRearmBlocksDirtyBetSettings();
await testRearmRechecksSafetyImmediatelyBeforeStartClick();
testRunningThresholdTopUpIgnoresRoundBetVariance();

console.log('autoplay sequence/rearm regression tests passed');
