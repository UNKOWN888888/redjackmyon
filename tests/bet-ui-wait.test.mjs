import assert from 'node:assert/strict';
import { loadPartial } from './helpers/load-partial.mjs';

let now = 1000;
const stages = [];
const logs = [];
const walletDom = loadPartial('05-autoplay-dom.js', {
  Date: { now: () => now },
  betSetupUiWaitSince: 0,
  lastBetSetupUiWaitLogAt: 0,
  betSetupUiWaitStatus: '',
  BET_SETUP_UI_WAIT_LOG_REPEAT_MS: 3000,
  lastFailReason: 'bet_total_mismatch',
  lastDiagnosedPhase: 'BUTTON_DOWN',
  setBetRuntimeStage: (stage, data, level) => stages.push({ stage, data, level }),
  pushBetLog: (level, message, data) => logs.push({ level, message, data }),
  formatMoney: value => String(value),
});

const missingReading = {
  detected: false,
  ambiguous: false,
  amount: null,
  values: [],
  candidates: [],
};
assert.equal(walletDom.ensureBetSetupWalletReady('watcher', {
  phase: 'BUTTON_DOWN',
  seats: '1,5,6,7',
}, missingReading), false);
assert.equal(walletDom.lastFailReason, null, 'missing wallet UI is a wait state, not a recovery failure');
assert.equal(stages.at(-1)?.stage, 'bet_ui_wait');
assert.equal(logs.filter(item => item.message === 'bet_setup_ui_wait').length, 1);

now += 100;
walletDom.ensureBetSetupWalletReady('watcher', {
  phase: 'BUTTON_DOWN',
  seats: '1,5,6,7',
}, missingReading);
assert.equal(logs.filter(item => item.message === 'bet_setup_ui_wait').length, 1, 'wait logging must be throttled');

now += 3000;
walletDom.ensureBetSetupWalletReady('watcher', {
  phase: 'BUTTON_DOWN',
  seats: '1,5,6,7',
}, missingReading);
assert.equal(logs.filter(item => item.message === 'bet_setup_ui_wait').length, 2);

const readyReading = {
  detected: true,
  ambiguous: false,
  amount: 0,
  values: [0],
  candidates: [{ amount: 0 }],
};
assert.equal(walletDom.ensureBetSetupWalletReady('watcher', {}, readyReading), true);
assert.equal(walletDom.betSetupUiWaitSince, 0);
assert.equal(logs.some(item => item.message === 'bet_setup_ui_resumed'), true);

let watcherCallback = null;
let recoveryCalls = 0;
let sequenceCalls = 0;
let walletGateCalls = 0;
let rememberedSeats = [];
let watcherRoundNumber = null;
let watcherAutoplayRunning = false;
let thresholdRestartCalls = 0;
loadPartial('16-watchers.js', {
  Date,
  setInterval: fn => {
    watcherCallback = fn;
    return 1;
  },
  isSettingsInputPending: () => false,
  syncSettingsFromUI: () => {},
  isAutomationLocked: () => false,
  isSupportReloadPopupVisible: () => false,
  dismissSupportReloadPopupIfPresent: () => {},
  isBlockingPopupVisible: () => false,
  dismissBlockingPopupIfPresent: () => {},
  closeIdleAutoplayBottomSheetIfStale: () => false,
  diagnosePhase: () => 'BUTTON_DOWN',
  lastDiagnosedPhase: null,
  Phase: {
    STOPPED: 'STOPPED',
    NO_TABLE: 'NO_TABLE',
    NO_CHIPS: 'NO_CHIPS',
    BUTTON_DOWN: 'BUTTON_DOWN',
    READY: 'READY',
  },
  isRunning: false,
  isBetSetupRunning: false,
  isBetClickGuardActive: () => false,
  handleSupportPopupReloadRecovery: () => false,
  autoplayStartPendingAt: 0,
  isAutoplayStartTransitionGuardActive: () => false,
  handleImmediateSeatOpportunities: () => false,
  observeAutoplayRoundNumber: () => watcherRoundNumber,
  getControlledSeatNumbers: () => [1, 5, 6, 7],
  rememberTargetSeatNumbers: seats => {
    rememberedSeats = seats;
  },
  getPlannedSeatLimit: () => 4,
  getRememberedBetSeatNumbers: () => [1, 5, 6, 7],
  getWalletTotalBetReading: () => missingReading,
  getBetSetupWalletGate: () => ({
    ready: false,
    status: 'missing',
    reason: 'wallet_total_missing_before_setup',
    reading: missingReading,
  }),
  isAutoplayRunning: () => watcherAutoplayRunning,
  betSetupUiWaitSince: 0,
  ensureBetSetupWalletReady: () => {
    walletGateCalls++;
    return false;
  },
  markBetStateNeedsRecovery: () => {
    recoveryCalls++;
    return true;
  },
  runSequence: () => {
    sequenceCalls++;
  },
  getExpectedBetPlan: () => ({ used: 4, totalActual: 150000, perSeatActual: 37500 }),
  getTargetSeatBetSummary: () => ({
    seats: [1, 5, 6, 7],
    amounts: [],
    total: 0,
    ambiguousCount: 0,
  }),
  isBetSummaryWalletConfirmed: () => false,
  shouldRestartAutoplayForThreshold: () => true,
  restartAutoplayForThreshold: async () => {
    thresholdRestartCalls++;
    return true;
  },
  THRESHOLD: 100,
  CHECK_INTERVAL_MS: 80,
});

assert.equal(typeof watcherCallback, 'function');
watcherCallback();
assert.deepEqual(rememberedSeats, [1, 5, 6, 7]);
assert.equal(walletGateCalls, 1);
assert.equal(recoveryCalls, 0, 'wallet UI absence must not enter recovery');
assert.equal(sequenceCalls, 0, 'wallet UI absence must not start a bet sequence');

watcherRoundNumber = 80;
watcherAutoplayRunning = true;
watcherCallback();
await Promise.resolve();
assert.equal(walletGateCalls, 1, 'an active autoplay counter must not enter setup UI wait');
assert.equal(thresholdRestartCalls, 1, 'threshold maintenance must continue while an active round temporarily hides wallet UI');
assert.equal(recoveryCalls, 0);

let setupGateCalls = 0;
const setup = loadPartial('11-setup-bet.js', {
  Date,
  isSettingsInputPending: () => false,
  syncSettingsFromUI: () => {},
  isScriptStopped: () => false,
  isAutomationLocked: () => false,
  isBetClickGuardActive: () => false,
  isBetSetupRunning: false,
  lastBetSetupAt: 0,
  BET_SETUP_COOLDOWN_MS: 450,
  ensureBetSetupWalletReady: () => {
    setupGateCalls++;
    return false;
  },
  lastDiagnosedPhase: 'BUTTON_DOWN',
  getControlledSeatNumbers: () => [1, 5, 6, 7],
});
assert.equal(await setup.setupBetAmount(true), false);
assert.equal(setupGateCalls, 1);
assert.equal(setup.isBetSetupRunning, false);

console.log('bet UI wait regression tests passed');
