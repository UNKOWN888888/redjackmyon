import assert from 'node:assert/strict';
import { loadPartial } from './helpers/load-partial.mjs';

let walletAmount = 3000;
let decisionPanels = [];
const logs = [];

function element({ text = '', attrs = {}, children = [] } = {}) {
  return {
    textContent: text,
    disabled: false,
    getAttribute: name => attrs[name] ?? null,
    hasAttribute: name => Object.prototype.hasOwnProperty.call(attrs, name),
    querySelector: () => null,
    querySelectorAll: selector => {
      if (selector === '[data-id]') return children;
      return [];
    },
    closest: () => null,
  };
}

function decisionPanel(actions) {
  return element({
    attrs: { 'data-testid': 'bj-decision-panel' },
    children: actions.map(action => element({ text: action, attrs: { 'data-id': action } })),
  });
}

const sandbox = loadPartial('05-autoplay-dom.js', {
  console,
  Date,
  _roundNumberCacheAt: 0,
  _roundNumberCache: null,
  _sitPromptVisibleCache: null,
  _sitPromptVisibleCacheAt: 0,
  _autoplayButtonCacheAt: 0,
  _autoplayButtonCache: null,
  DOM_MICRO_CACHE_MS: 20,
  SIT_PROMPT_CACHE_MS: 30,
  STOP_AUTOPLAY_WAIT_MS: 700,
  AUTOPLAY_START_ROUNDS: 100,
  TARGET_BET_AMOUNT: 3000,
  qsaDeep: selector => {
    if (selector === '[data-testid="bj-decision-panel"]') return decisionPanels;
    if (selector.includes('wallet-total-bet-value')) return [element({ text: String(walletAmount) })];
    return [];
  },
  qsDeep: () => null,
  isVisible: () => true,
  parseMoneySum: text => Number(String(text).replace(/[^0-9.-]/g, '')),
  formatMoney: n => String(n),
  pushBetLog: (level, message, data) => logs.push({ level, message, data }),
  getElementLabel: el => el?.getAttribute?.('data-testid') || el?.getAttribute?.('data-id') || 'el',
  isBettingWindowOpen: () => false,
  getExpectedBetPlan: () => ({ totalActual: 3000 }),
  isBetClickGuardActive: () => false,
  isScriptStopped: () => false,
  isAutomationLocked: () => false,
  isBetSetupRunning: false,
  lastFailReason: null,
  autoBetArmed: true,
});

assert.equal(sandbox.getVisibleDecisionPanelInfo().active, false);

decisionPanels = [decisionPanel(['double', 'split'])];
assert.equal(sandbox.getVisibleDecisionPanelInfo().active, true);
assert.equal(JSON.stringify(sandbox.getVisibleDecisionPanelInfo().actions), JSON.stringify(['double', 'split']));
assert.equal(sandbox.verifyAutoplayStartSafety({ totalActual: 3000 }, 'sequence'), false);
assert.equal(sandbox.lastFailReason, 'decision_panel_active_before_autoplay');

decisionPanels = [];
walletAmount = 4500;
assert.equal(sandbox.getWalletTotalBetVariance({ totalActual: 3000 }).status, 'increased');
assert.equal(sandbox.verifyAutoplayStartSafety({ totalActual: 3000 }, 'sequence'), false);
assert.equal(sandbox.lastFailReason, 'wallet_total_increased_mid_round');

walletAmount = 3000;
sandbox.lastFailReason = null;
assert.equal(sandbox.getWalletTotalBetVariance({ totalActual: 3000 }).status, 'exact');
assert.equal(sandbox.verifyAutoplayStartSafety({ totalActual: 3000 }, 'sequence'), true);
assert.equal(sandbox.lastFailReason, null);

{
  let modifyClicks = 0;
  let safetyChecks = 0;
  const modifyButton = {
    kind: 'modify',
    disabled: false,
    hasAttribute: () => false,
    getAttribute: () => null,
    querySelector: () => null,
  };
  const modifyMarker = {
    closest: selector => selector.includes('autoplay-control-button') ? modifyButton : null,
  };
  const modifyAddon = {
    parentElement: modifyMarker,
    closest: selector => selector.includes('autoplay-modify-button')
      ? modifyMarker
      : (selector.includes('autoplay-control-button') || selector === 'button' ? modifyButton : null),
  };
  const topUpSandbox = loadPartial('05-autoplay-dom.js', {
    console,
    AUTOPLAY_START_ROUNDS: 100,
    AUTOPLAY_MODIFY_STEP: 10,
    AUTOPLAY_MODIFY_MENU_WAIT_MS: 50,
    toInt: value => Number(value),
    isScriptStopped: () => false,
    verifyAutoplayStartSafety: () => {
      safetyChecks++;
      return false;
    },
    getExpectedBetPlan: () => ({ totalActual: 3000 }),
    qsaDeep: selector => selector === '[data-testid="autoplay-modify-addon-10"]' ? [modifyAddon] : [],
    isVisible: () => true,
    pushBetLog: () => {},
    getElementLabel: () => 'autoplay-control-button',
    robustClick: target => {
      assert.equal(target, modifyButton);
      modifyClicks++;
      return true;
    },
    sleep: async () => {},
    observeAutoplayRoundNumber: () => 100,
    lastFailReason: null,
    lastAutoplayModalActionAt: 0,
  });

  assert.equal(await topUpSandbox.topUpAutoplayRoundsByModify(90), true);
  assert.equal(modifyClicks, 1, '90 rounds should require one exact +10 control click');
  assert.equal(safetyChecks, 0, 'running +10 top-up must not run new-bet wallet safety checks');
}

console.log('autoplay safety regression tests passed');
