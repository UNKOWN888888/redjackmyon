import assert from 'node:assert/strict';
import { loadPartial } from './helpers/load-partial.mjs';

let now = 1000;
let roundNumber = null;
let stopButton = null;
const logs = [];

class FakeDate extends Date {
  static now() {
    return now;
  }
}

const diagnostics = loadPartial('02-diagnostics.js', {
  Date: FakeDate,
  setTimeout: () => 0,
  clearTimeout: () => {},
  GM_setValue: () => {},
  BET_DEBUG_LOG_STORAGE_KEY: 'test-log',
  BET_DEBUG_LOG_LIMIT: 100,
  BET_DEBUG_LOG_PERSIST_DELAY_MS: 1,
  SCRIPT_SESSION_ID: 'test-session',
  SCRIPT_VERSION: 'test',
  betDebugLog: logs,
  betLogSequence: 0,
  betDebugLogPersistTimer: null,
  betRuntimeStage: 'idle',
  betRuntimeStageAt: now,
  betRuntimeStageData: {},
  autoplayStartPendingAt: 0,
  autoplayStartPendingUntil: 0,
  autoplayStartPendingContext: '',
  autoplayStartTransitionGuardUntil: 0,
  AUTOPLAY_START_PENDING_GRACE_MS: 3200,
  AUTOPLAY_POST_START_STABILIZE_MS: 900,
  AUTOBET_COUNT_VERIFY_MS: 1400,
  autoBetArmed: false,
  lastRoundCountSeenAt: 0,
  THRESHOLD: 100,
  markAutoplayModalAction: () => {},
  getRoundNumber: () => roundNumber,
  getAutoplayStopButton: () => stopButton,
  waitForCondition: async fn => !!fn(),
});

diagnostics.beginAutoplayStartConfirmation('sequence', { rounds: 100 });
assert.equal(diagnostics.isAutoplayStartConfirmationPending(), true);
assert.equal(diagnostics.autoBetArmed, true);

const delayed = await diagnostics.waitForAutoplayStartConfirmation('sequence');
assert.equal(delayed.confirmed, false);
assert.equal(diagnostics.isAutoplayStartConfirmationPending(), true);
assert.equal(logs.some(item => item.message === 'autoplay_start_confirmation_deferred'), true);

now += 750;
roundNumber = 100;
const roundConfirmed = diagnostics.observeAutoplayStartConfirmation('watcher');
assert.equal(roundConfirmed.confirmed, true);
assert.equal(roundConfirmed.signal, 'round_counter');
assert.equal(diagnostics.isAutoplayStartConfirmationPending(), false);
assert.equal(diagnostics.isAutoplayStartTransitionGuardActive(), true);
assert.equal(logs.some(item => item.message === 'autoplay_start_confirmed'), true);

now += 901;
assert.equal(diagnostics.isAutoplayStartTransitionGuardActive(), false);

roundNumber = null;
stopButton = { kind: 'stop' };
diagnostics.beginAutoplayStartConfirmation('rearm', { rounds: 100 });
const stopConfirmed = diagnostics.observeAutoplayStartConfirmation('rearm');
assert.equal(stopConfirmed.confirmed, true);
assert.equal(stopConfirmed.signal, 'stop_button');

now += 901;
diagnostics.isAutoplayStartTransitionGuardActive();
stopButton = null;
diagnostics.beginAutoplayStartConfirmation('threshold', { rounds: 100 });
now += 3201;
assert.equal(diagnostics.isAutoplayStartConfirmationPending(), false);
assert.equal(diagnostics.isAutoplayStartTransitionGuardActive(), true);
assert.equal(logs.some(item => item.message === 'autoplay_start_confirmation_expired'), true);
assert.equal(diagnostics.betRuntimeStage, 'autoplay_rearm_wait');

console.log('autoplay confirmation timing regression tests passed');
