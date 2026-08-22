import assert from 'node:assert/strict';
import { loadPartial } from './helpers/load-partial.mjs';

const noop = () => {};

function makeDomEventClasses() {
  return {
    PointerEvent: class PointerEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } },
    MouseEvent: class MouseEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } },
    TouchEvent: class TouchEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } },
    Touch: class Touch { constructor(init = {}) { Object.assign(this, init); } },
  };
}

function matchesSimple(el, selector) {
  const parts = String(selector).split(',').map(s => s.trim());
  return parts.some(part => {
    if (part === 'button') return el.tagName === 'BUTTON';
    if (part === '[role="button"]') return el.attrs?.role === 'button';
    if (part === '[data-testid="autoplay-button"]') return el.attrs?.['data-testid'] === 'autoplay-button';
    if (part === '[data-testid="autoplay-control-button"]') return el.attrs?.['data-testid'] === 'autoplay-control-button';
    if (part === '[data-testid="modal-close-button"]') return el.attrs?.['data-testid'] === 'modal-close-button';
    if (part === '[data-testid="deal_now"]') return el.attrs?.['data-testid'] === 'deal_now';
    if (part === '[data-id="no"]') return el.attrs?.['data-id'] === 'no';
    if (part === '[data-testid="chip"]') return el.attrs?.['data-testid'] === 'chip';
    if (part === '[data-testid^="chip-stack-value-"]') return String(el.attrs?.['data-testid'] || '').startsWith('chip-stack-value-');
    if (part === '[data-testid^="mainbetSeat_"]') return String(el.attrs?.['data-testid'] || '').startsWith('mainbetSeat_');
    return false;
  });
}

function makeElement(name, { tag = 'DIV', attrs = {}, rect = { left: 10, top: 10, width: 20, height: 20 } } = {}) {
  const el = {
    name,
    tagName: tag,
    attrs,
    hidden: false,
    ownerDocument: null,
    parentElement: null,
    children: [],
    textContent: '',
    getBoundingClientRect: () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height }),
    getAttribute: key => attrs[key] ?? null,
    hasAttribute: key => Object.prototype.hasOwnProperty.call(attrs, key),
    matches: selector => matchesSimple(el, selector),
    closest: selector => {
      if (selector.includes('button') && el.tagName === 'BUTTON') return el;
      if (selector.includes('[role="button"]') && el.attrs.role === 'button') return el;
      if (selector.includes('[data-testid="bottom-sheet-modal"]') && el.attrs['data-testid'] === 'bottom-sheet-modal') return el;
      for (let cur = el.parentElement; cur; cur = cur.parentElement) {
        if (selector.includes('button') && cur.tagName === 'BUTTON') return cur;
        if (selector.includes('[data-testid="bottom-sheet-modal"]') && cur.attrs?.['data-testid'] === 'bottom-sheet-modal') return cur;
      }
      return null;
    },
    contains: other => other === el || el.children.includes(other),
    querySelector: () => null,
    querySelectorAll: () => [],
    dispatchEvent: event => { el.dispatched?.push(event.type); return true; },
    click: () => { el.nativeClicked = (el.nativeClicked || 0) + 1; },
    dispatched: [],
  };
  return el;
}

function attachDoc(...els) {
  const win = { ...makeDomEventClasses(), innerWidth: 1000, innerHeight: 800 };
  let topElement = els[0];
  const doc = {
    defaultView: win,
    body: makeElement('body', { tag: 'BODY', rect: { left: 0, top: 0, width: 1000, height: 800 } }),
    documentElement: makeElement('html'),
    elementFromPoint: () => topElement,
  };
  doc.body.ownerDocument = doc;
  doc.documentElement.ownerDocument = doc;
  for (const el of els) el.ownerDocument = doc;
  return { doc, setTopElement: el => { topElement = el; } };
}

function testRobustClickDispatchesButtonActionToSingleTarget() {
  const topButton = makeElement('topButton', { tag: 'BUTTON' });
  const targetButton = makeElement('targetButton', { tag: 'BUTTON' });
  const { setTopElement } = attachDoc(topButton, targetButton);
  setTopElement(topButton);

  const sandbox = loadPartial('04-clicks.js', {
    console,
    window: topButton.ownerDocument.defaultView,
    PointerEvent: topButton.ownerDocument.defaultView.PointerEvent,
    MouseEvent: topButton.ownerDocument.defaultView.MouseEvent,
    TouchEvent: topButton.ownerDocument.defaultView.TouchEvent,
    SEAT_CLOSE_ICON_SELECTOR: '[data-testid="seat-close"]',
    isVisible: () => true,
    invalidateDynamicCaches: noop,
    lastBetClickDebug: '',
    lastBetClickDebugAt: 0,
    Date,
  });

  assert.equal(sandbox.robustClick(targetButton), true);
  const clickedTargets = [topButton, targetButton].filter(el => el.dispatched.includes('click') || el.nativeClicked);
  assert.deepEqual(clickedTargets.map(el => el.name), ['targetButton']);
  assert.equal(targetButton.nativeClicked, 1, 'a button action must invoke native click exactly once');
  assert.equal(targetButton.dispatched.filter(type => type === 'click').length, 0, 'native click must not be preceded by a second synthetic click');
  assert.equal(targetButton.dispatched.length, 0, 'native button actions must not also emit pointer or mouse actions');
}

function testBetClickRejectsOverlayOutsideSeatBoundary() {
  const seat = makeElement('seat');
  const overlay = makeElement('decisionOverlay');
  attachDoc(seat, overlay);
  seat.contains = other => other === seat;
  overlay.closest = selector => selector.includes('[data-testid="bj-decision-panel"]') ? overlay : null;

  const sandbox = loadPartial('04-clicks.js', {
    console,
    window: seat.ownerDocument.defaultView,
    PointerEvent: seat.ownerDocument.defaultView.PointerEvent,
    MouseEvent: seat.ownerDocument.defaultView.MouseEvent,
    TouchEvent: seat.ownerDocument.defaultView.TouchEvent,
    SEAT_CLOSE_ICON_SELECTOR: '[data-testid="seat-close"]',
    isVisible: () => true,
    invalidateDynamicCaches: noop,
    lastBetClickDebug: '',
    lastBetClickDebugAt: 0,
    Date,
  });

  assert.equal(sandbox.isSafeBetDispatchTarget(overlay, seat), false);
}

function testInsuranceNoDispatchesOneAction() {
  const noButton = makeElement('insuranceNo', { attrs: { 'data-id': 'no' } });
  attachDoc(noButton);
  noButton.textContent = '아니오';
  noButton.closest = selector => selector.includes('[data-id="no"]') ? noButton : null;
  let clickCount = 0;
  const sandbox = loadPartial('12-deal-insurance.js', {
    window: noButton.ownerDocument.defaultView,
    isVisible: () => true,
    isDisabledLike: () => false,
    robustClick: target => {
      assert.equal(target, noButton);
      clickCount++;
      return true;
    },
  });

  assert.equal(sandbox.clickInsuranceNoElement(noButton), true);
  assert.equal(clickCount, 1, 'insurance no must be dispatched once even when it has nested children');
}

function loadAutoplayDomSandbox(overrides = {}) {
  let trayChips = [];
  let availableChips = [];
  let qsaMap = new Map();
  let dealButton = null;
  let clicked = 0;
  let roundNumber = 95;
  const logs = [];

  const sandbox = loadPartial('05-autoplay-dom.js', {
    console,
    Date,
    DOM_MICRO_CACHE_MS: 0,
    SIT_PROMPT_CACHE_MS: 0,
    STOP_AUTOPLAY_WAIT_MS: 50,
    AUTOPLAY_START_ROUNDS: 100,
    AUTOPLAY_MODIFY_STEP: 10,
    AUTOPLAY_MODIFY_MENU_WAIT_MS: 50,
    TARGET_BET_AMOUNT: 3000,
    _roundNumberCacheAt: 0,
    _roundNumberCache: null,
    _autoplayButtonCacheAt: 0,
    _autoplayButtonCache: null,
    lastAutoplayModalActionAt: 0,
    toInt: (value, fallback, min, max) => {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    },
    getTrayChips: () => trayChips,
    detectAvailableChips: () => availableChips,
    qsaDeep: selector => qsaMap.get(selector) || [],
    qsDeep: selector => (selector === '[data-testid="deal_now"]' ? dealButton : null),
    isVisible: el => !!el && !el.hidden,
    parseMoneySum: text => Number(String(text).replace(/[^0-9.-]/g, '')),
    formatMoney: n => String(n),
    pushBetLog: (level, message, data) => logs.push({ level, message, data }),
    getElementLabel: el => el?.name || el?.getAttribute?.('data-testid') || 'el',
    getExpectedBetPlan: () => ({ totalActual: 3000 }),
    isBetClickGuardActive: () => false,
    isScriptStopped: () => false,
    isAutomationLocked: () => false,
    isBetSetupRunning: false,
    lastBetClickGuardReason: '',
    lastFailReason: null,
    autoBetArmed: true,
    sleep: async () => {},
    observeAutoplayRoundNumber: () => roundNumber,
    robustClick: () => { clicked++; if (overrides.bumpRoundOnClick) roundNumber = overrides.bumpRoundOnClick; return true; },
    waitForCondition: async fn => !!fn(),
    ...overrides.sandbox,
  });

  return {
    sandbox,
    logs,
    setTrayChips: chips => { trayChips = chips; },
    setAvailableChips: chips => { availableChips = chips; },
    setQsa: (selector, values) => { qsaMap.set(selector, values); },
    setDealButton: btn => { dealButton = btn; },
    setRoundNumber: n => { roundNumber = n; },
    get clicked() { return clicked; },
  };
}

function testBettingWindowRecognizesSingleChipAndStackButtons() {
  const env = loadAutoplayDomSandbox();
  env.setTrayChips([makeElement('singleChip')]);
  assert.equal(env.sandbox.isBettingWindowOpen(), true, 'one visible tray chip should be enough to treat betting window as open');

  const env2 = loadAutoplayDomSandbox();
  env2.setQsa('button[data-testid^="chip-stack-value-"]', [makeElement('stackButton', { tag: 'BUTTON', attrs: { 'data-testid': 'chip-stack-value-7500' } })]);
  assert.equal(env2.sandbox.isBettingWindowOpen(), true, 'visible chip stack buttons should mark betting window open');
}

function testCloseAutoplayDialogDoesNotClickGlobalCloseWhenNoAutoplayModal() {
  const strayCloseButton = makeElement('strayClose', { tag: 'BUTTON' });
  const strayCloseIcon = makeElement('strayCloseIcon');
  strayCloseIcon.closest = selector => selector.includes('button') ? strayCloseButton : null;
  const env = loadAutoplayDomSandbox();
  env.setQsa('svg[data-testid="icon-Close"]', [strayCloseIcon]);

  assert.equal(env.sandbox.closeAutoplayDialogIfOpen(), false);
  assert.equal(env.clicked, 0, 'global non-autoplay close icon must not be clicked');
}

async function testTopUpModifyFailsWhenFinalRoundStillBelowTarget() {
  const marker = makeElement('modifyMarker');
  const addon = makeElement('modifyAddon10', { attrs: { 'data-testid': 'autoplay-modify-addon-10' } });
  const modifyButton = makeElement('modifyButton', { tag: 'BUTTON', attrs: { 'data-testid': 'autoplay-control-button' } });
  marker.closest = selector => selector.includes('button') ? modifyButton : null;
  addon.parentElement = marker;
  addon.closest = selector => selector.includes('autoplay-modify-button')
    ? marker
    : (selector.includes('button') ? modifyButton : null);
  const env = loadAutoplayDomSandbox();
  env.setQsa('[data-testid="autoplay-modify-addon-10"]', [addon]);
  env.setRoundNumber(95);

  assert.equal(await env.sandbox.topUpAutoplayRoundsByModify(95), false);
  assert.equal(env.clicked, 1, 'one modify click was attempted but must not count as success without target round verification');
}

async function testTopUpModifyIgnoresNewBetSafetyDuringRunningAutoplay() {
  const marker = makeElement('modifyMarker');
  const addon = makeElement('modifyAddon10', { attrs: { 'data-testid': 'autoplay-modify-addon-10' } });
  const modifyButton = makeElement('modifyButton', { tag: 'BUTTON', attrs: { 'data-testid': 'autoplay-control-button' } });
  marker.closest = selector => selector.includes('button') ? modifyButton : null;
  addon.parentElement = marker;
  addon.closest = selector => selector.includes('autoplay-modify-button')
    ? marker
    : (selector.includes('button') ? modifyButton : null);
  const env = loadAutoplayDomSandbox({ bumpRoundOnClick: 100 });
  env.setQsa('[data-testid="autoplay-modify-addon-10"]', [addon]);
  env.sandbox.verifyAutoplayStartSafety = () => false;

  assert.equal(await env.sandbox.topUpAutoplayRoundsByModify(95), true);
  assert.equal(env.clicked, 1, 'exact modify control should click even when current-hand wallet safety would reject a new bet');
}

function testRoundNumberReadsAutoplayStopSlider() {
  const counter = makeElement('roundCounter', { attrs: { 'data-testid': 'number-slider-list-item' } });
  counter.textContent = '98';
  const env = loadAutoplayDomSandbox();
  env.setQsa('[data-testid="autoplay-stop-button"] [data-testid="number-slider-list-item"]', [counter]);

  assert.equal(env.sandbox.getRoundNumber(), 98, 'remaining rounds must be read from the running autoplay stop panel');
}

function testModifyButtonSelectsOnlyPlusTenControl() {
  const plus2Button = makeElement('plus2Button', { tag: 'BUTTON', attrs: { 'data-testid': 'autoplay-control-button' } });
  const plus10Button = makeElement('plus10Button', { tag: 'BUTTON', attrs: { 'data-testid': 'autoplay-control-button' } });
  const plus10Marker = makeElement('plus10Marker', { attrs: { 'data-testid': 'autoplay-modify-button' } });
  const plus10Addon = makeElement('plus10Addon', { attrs: { 'data-testid': 'autoplay-modify-addon-10' } });
  plus10Addon.parentElement = plus10Marker;
  plus10Addon.closest = selector => selector.includes('autoplay-modify-button')
    ? plus10Marker
    : (selector.includes('button') ? plus10Button : null);
  const env = loadAutoplayDomSandbox();
  env.setQsa('[data-testid="autoplay-modify-button"]', [makeElement('plus2Marker')]);
  env.setQsa('[data-testid="autoplay-modify-addon-10"]', [plus10Addon]);
  env.setQsa('button[data-testid="autoplay-control-button"]', [plus2Button, plus10Button]);

  assert.equal(env.sandbox.getAutoplayModifyButton(), plus10Button, 'the first generic modify control (+2) must never be used as the +10 action');
}

function testBlockingPopupSkipsBodyFallbackAfterPrimaryClickDismissesPopup() {
  const popup = makeElement('popup', { rect: { left: 100, top: 100, width: 200, height: 100 } });
  popup.textContent = '비활성 중단 아무 곳이나 클릭';
  const { doc } = attachDoc(popup);
  const clicked = [];
  const sandbox = loadPartial('13-popups.js', {
    console,
    Date,
    qsaDeep: selector => selector === '[data-testid="blocking-popup-content"]' ? [popup] : [],
    isVisible: el => !!el && !el.hidden,
    lastBlockingPopupClickAt: 0,
    BLOCKING_POPUP_CLICK_COOLDOWN_MS: 0,
    fireFullClick: el => {
      clicked.push(el.name || el.tagName);
      if (el === popup) popup.hidden = true;
      return true;
    },
    document: doc,
    window: doc.defaultView,
    blockingPopupDismissCount: 0,
  });

  assert.equal(sandbox.dismissBlockingPopupIfPresent(), true);
  assert.deepEqual(clicked, ['popup'], 'body fallback should be skipped after the primary popup click dismisses it');
}

testRobustClickDispatchesButtonActionToSingleTarget();
testBetClickRejectsOverlayOutsideSeatBoundary();
testInsuranceNoDispatchesOneAction();
testBettingWindowRecognizesSingleChipAndStackButtons();
testCloseAutoplayDialogDoesNotClickGlobalCloseWhenNoAutoplayModal();
await testTopUpModifyFailsWhenFinalRoundStillBelowTarget();
await testTopUpModifyIgnoresNewBetSafetyDuringRunningAutoplay();
testRoundNumberReadsAutoplayStopSlider();
testModifyButtonSelectsOnlyPlusTenControl();
testBlockingPopupSkipsBodyFallbackAfterPrimaryClickDismissesPopup();

console.log('next priority hardening regression tests passed');
