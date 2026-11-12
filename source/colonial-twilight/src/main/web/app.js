const byId = (id) => document.getElementById(id);
const storageKey = 'colonial-twilight-fln-v1';
const recoveryKey = 'colonial-twilight-fln-recovery';

const controls = byId('controls');
const tableButtons = byId('table-buttons');
const log = byId('log');
const spaceSelect = byId('space-select');
const saveFile = byId('save-file');

let engine;
let currentSession;
let cards = new Map();
let currentView;
let previousOutput = [];
let logLines = [];
let savedValue = null;
let damagedSave = null;
let recoveryCopy = null;
let canSave = true;
let busy = false;
let failed = false;

function setBusy(value) {
  busy = value;
  byId('action').setAttribute('aria-busy', String(value));
  controls.inert = value || failed;
  tableButtons.inert = value || failed;
  byId('start-game').disabled = value || failed;
  byId('new-game').disabled = value || failed;
  byId('import-save').disabled = value || failed;
}

function updateSaveControls() {
  byId('export-save').hidden = !currentSession;
  byId('download-recovery').hidden = damagedSave === null && recoveryCopy === null;
}

function showSaveMessage(text, invalid = false) {
  const message = byId('save-message');
  message.textContent = text;
  message.classList.toggle('invalid', invalid);
  message.hidden = false;
  byId('save-tools').open = true;
}

function showError(message, detail, reload = false) {
  byId('error-message').textContent = message;
  byId('error').hidden = false;
  byId('retry').hidden = !reload;
  byId('loading').hidden = true;
  if (detail) console.error(detail);
}

function pauseForReload(message, detail) {
  failed = true;
  setBusy(false);
  showError(message, detail, true);
}

function showRecovery(detail) {
  damagedSave = savedValue;
  byId('setup').hidden = false;
  byId('start-game').textContent = 'Start fresh';
  byId('save-tools').open = true;
  updateSaveControls();
  showError('This browser’s saved game could not be opened. Download a recovery copy or start fresh.', detail);
  byId('start-game').focus();
}

function save(session) {
  if (!canSave) return true;
  try {
    if (localStorage.getItem(storageKey) !== savedValue) {
      pauseForReload('Another tab changed this saved game. Reload to continue from the browser’s saved copy.');
      return false;
    }
    const value = writeSave(session);
    if (value !== savedValue) {
      if (damagedSave !== null) {
        localStorage.setItem(recoveryKey, damagedSave);
        recoveryCopy = damagedSave;
      }
      localStorage.setItem(storageKey, value);
      savedValue = value;
      damagedSave = null;
    }
  } catch {
    canSave = false;
  }
  return true;
}

function run(action, onError) {
  setBusy(true);
  setTimeout(() => {
    if (failed) return;
    try {
      action();
    } catch (error) {
      setBusy(false);
      onError(error);
    } finally {
      byId('loading').hidden = true;
    }
  }, 0);
}

function applyView(session, view, nextEngine, deck) {
  if (!save(session)) return false;
  if (deck) {
    cards = new Map(deck.map((card) => [card.number, card]));
    logLines = view.priorHistory.map((text) => ({ text, style: 'plain' }));
    previousOutput = [];
  }
  engine = nextEngine;
  currentSession = session;
  currentView = view;
  byId('error').hidden = true;
  byId('setup').hidden = true;
  byId('start-game').textContent = 'Start game';
  byId('play').hidden = false;
  byId('new-game').hidden = false;
  byId('save-status').textContent = canSave ? 'Saved in this browser' : 'Browser storage unavailable';
  setBusy(false);
  updateSaveControls();
  render();
  byId('prompt-title').focus({ preventScroll: true });
  return true;
}

function open(session, mode) {
  byId('save-message').hidden = true;
  byId('loading').hidden = false;
  run(() => {
    // A failed import must leave the running game and its replay state intact.
    const candidate = createEngine();
    const { scenario, finalSupport, seed, inputs } = session;
    const view = candidate.openGame(scenario, finalSupport, seed, inputs);
    const deck = candidate.listCards();
    if (mode === 'import' && currentSession && !window.confirm('Replace the current game with this save?')) {
      setBusy(false);
      return;
    }
    if (applyView(session, view, candidate, deck) && mode === 'import') showSaveMessage('Save loaded.');
  }, (error) => {
    if (mode === 'restore') showRecovery(error);
    else if (mode === 'import') showSaveMessage('This save could not be replayed. Choose another file.', true);
    else showError('The game could not start. Try opening the scenario again.', error);
  });
}

function answer(value) {
  if (busy || failed || !currentSession) return;
  const session = { ...currentSession, inputs: [...currentSession.inputs, value] };
  run(() => applyView(session, engine.answerPrompt(value), engine), (error) => {
    pauseForReload('The engine could not process that step. Reload to return to the last saved step.', error);
  });
}

function downloadSave(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

byId('import-save').addEventListener('click', () => saveFile.click());
saveFile.addEventListener('change', async () => {
  const [file] = saveFile.files;
  saveFile.value = '';
  if (!file || busy || failed) return;
  byId('save-message').hidden = true;
  setBusy(true);
  let session;
  try {
    session = readSave(await file.text());
  } catch (error) {
    setBusy(false);
    showSaveMessage(error.message, true);
    return;
  }
  if (!failed) open(session, 'import');
});
byId('export-save').addEventListener('click', () => {
  if (currentSession) downloadSave(writeSave(currentSession), 'Colonial_Twilight_Save.json');
});
byId('download-recovery').addEventListener('click', () => {
  const copy = damagedSave ?? recoveryCopy;
  if (copy !== null) downloadSave(copy, 'Colonial_Twilight_Recovery.json');
});

window.addEventListener('storage', (event) => {
  if (event.key === recoveryKey || event.key === null) {
    recoveryCopy = event.newValue;
    updateSaveControls();
  }
  if ((event.key === storageKey || event.key === null) && (currentSession || busy || savedValue !== null)
    && event.newValue !== savedValue) {
    pauseForReload('Another tab changed this saved game. Reload to continue from the browser’s saved copy.');
  }
});

byId('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy || failed) return;
  if (currentSession && !window.confirm('Replace the saved game in this browser?')) return;
  const values = new FormData(event.currentTarget);
  open({
    scenario: values.get('scenario'),
    finalSupport: values.has('final-support'),
    seed: crypto.getRandomValues(new Int32Array(1))[0],
    inputs: [],
  }, 'new');
});
byId('new-game').addEventListener('click', () => {
  if (busy || failed) return;
  byId('play').hidden = !byId('play').hidden;
  byId('setup').hidden = !byId('setup').hidden;
  byId('new-game').textContent = byId('setup').hidden ? 'New game' : 'Back to game';
  if (byId('setup').hidden) byId('prompt-title').focus();
  else byId('start-game').focus();
});
byId('retry').addEventListener('click', () => location.reload());

function button(label, onClick, tone = 'secondary') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'button ' + tone;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function showPrompt(title, detail = '') {
  byId('prompt-title').textContent = title;
  const message = byId('prompt-detail');
  message.textContent = detail;
  message.hidden = !detail;
}

function renderCardEntry(commandMode) {
  showPrompt('Enter the card you drew', 'Use the number printed on your physical card.');
  const form = document.createElement('form');
  form.className = 'inline-form';
  const label = document.createElement('label');
  label.className = 'field-label';
  label.htmlFor = 'card-number';
  label.textContent = 'Card number';
  const row = document.createElement('div');
  row.className = 'field-row';
  const input = document.createElement('input');
  input.id = 'card-number';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.maxLength = 2;
  input.setAttribute('aria-describedby', 'card-name');
  const submit = button('Load card', () => {}, 'primary');
  submit.type = 'submit';
  submit.disabled = true;
  const hint = document.createElement('p');
  hint.id = 'card-name';
  hint.className = 'field-help';
  hint.setAttribute('aria-live', 'polite');
  const cardForInput = () => {
    const value = input.value.trim();
    return /^\d{1,2}$/.test(value) ? cards.get(Number(value)) : undefined;
  };
  function updateCardName() {
    const card = cardForInput();
    const invalid = !!input.value.trim() && !card;
    submit.disabled = !card;
    hint.classList.toggle('invalid', invalid);
    input.setAttribute('aria-invalid', String(invalid));
    hint.textContent = card ? card.name : invalid
      ? 'Enter an event (1–60) or Propaganda card (67–71).'
      : 'Use Pivotal events through the turn’s Pivotal event button.';
  }
  input.addEventListener('input', updateCardName);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const card = cardForInput();
    if (card) answer(commandMode ? 'card ' + card.number : String(card.number));
  });
  row.append(input, submit);
  form.append(label, row, hint);
  controls.append(form);
  updateCardName();
}

function renderCommands(prompt) {
  const allowed = new Set(prompt.options.map((option) => option.value));
  if (allowed.has('card')) {
    renderCardEntry(true);
  } else if (allowed.has('fln')) {
    showPrompt('FLN to act', 'Run the bot, then make its changes on your board using the turn log.');
    controls.append(button('Run FLN bot', () => answer('fln'), 'primary'));
  } else if (allowed.has('gov')) {
    showPrompt('Government to act', 'Choose your action for the current card.');
    controls.append(button('Choose Government action', () => answer('gov'), 'primary'));
  } else {
    showPrompt('Choose a command');
  }
  if (allowed.has('pivot')) controls.append(button('Pivotal event', () => answer('pivot')));

  const extras = [
    ['adjust', 'Adjust game state'],
    ['rollback', 'Roll back a turn'],
    ['history', 'Show previous actions'],
  ];
  for (const [command, label] of extras) {
    if (allowed.has(command)) tableButtons.append(button(label, () => answer(command)));
  }
  byId('table-tools').hidden = tableButtons.children.length === 0;
}

function lastHeading() {
  for (const line of [...previousOutput].reverse()) {
    const text = line.text.trim();
    if (text && !/^[-=]+$/.test(text) && !/^\d+\)/.test(text)) return text;
  }
  return '';
}

function cleanPrompt(text) {
  return text.replace(/\s*\((?:y\/n|\? for options)\)\s*$/i, '').replace(/[:?]\s*$/, '').trim();
}

function renderChoices(prompt) {
  const cleaned = cleanPrompt(prompt.text);
  const isMenu = /selection$/i.test(cleaned);
  const heading = isMenu ? cleanPrompt(lastHeading()) : '';
  showPrompt(heading && heading.length < 90 ? heading : isMenu ? 'Choose an option' : cleaned);
  const choices = prompt.options.filter(({ value }) => value !== 'abort action');
  if (choices.length > 10) {
    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = 'prompt-choice';
    label.textContent = 'Available choices';
    const select = document.createElement('select');
    select.id = 'prompt-choice';
    select.add(new Option('Select an option', ''));
    for (const { label, value } of choices) select.add(new Option(label, value));
    const submit = button('Confirm choice', () => answer(select.value), 'primary');
    submit.disabled = true;
    select.addEventListener('change', () => { submit.disabled = !select.value; });
    controls.append(label, select, submit);
  } else {
    const group = document.createElement('div');
    group.className = 'choices';
    for (const { label, value } of choices) group.append(button(label, () => answer(value)));
    controls.append(group);
  }
  if (prompt.allowEmpty) {
    const defaultValue = /Default = (\d+)/.exec(prompt.text)?.[1];
    controls.append(button(defaultValue ? 'Use default (' + defaultValue + ')' : 'Cancel', () => answer('')));
  }
  if (prompt.options.some(({ value }) => value === 'abort action')) {
    controls.append(button('Abort action', () => answer('abort action')));
  }
}

function renderText(prompt) {
  showPrompt(cleanPrompt(prompt.text));
  const integer = prompt.kind === 'integer';
  const form = document.createElement('form');
  form.className = 'inline-form';
  const label = document.createElement('label');
  label.className = 'field-label';
  label.htmlFor = 'response';
  label.textContent = integer ? 'New value' : 'Response';
  const input = document.createElement('input');
  input.id = 'response';
  input.type = 'text';
  input.autocomplete = 'off';
  const submit = button('Confirm', () => {}, 'primary');
  submit.type = 'submit';
  form.append(label, input, submit);
  let validate = () => true;
  if (integer) {
    const hint = document.createElement('p');
    hint.id = 'response-range';
    hint.className = 'field-help invalid';
    hint.setAttribute('aria-live', 'polite');
    input.inputMode = 'numeric';
    input.setAttribute('aria-describedby', hint.id);
    validate = () => {
      const value = input.value.trim();
      const number = Number(value);
      const valid = /^\d+$/.test(value) && number >= prompt.minimum && number <= prompt.maximum;
      const invalid = Boolean(value) && !valid;
      submit.disabled = !valid;
      input.setAttribute('aria-invalid', String(invalid));
      hint.textContent = invalid ? `Enter a whole number from ${prompt.minimum} to ${prompt.maximum}.` : '';
      hint.hidden = !invalid;
      return valid;
    };
    input.addEventListener('input', validate);
    form.append(hint);
    validate();
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (integer) {
      if (validate()) answer(String(Number(value)));
    } else if (value || prompt.allowEmpty) {
      answer(value);
    }
  });
  controls.append(form);
  if (prompt.allowEmpty) controls.append(button('Cancel', () => answer('')));
}

function renderAction({ prompt, state, ended }) {
  controls.replaceChildren();
  tableButtons.replaceChildren();
  byId('table-tools').hidden = true;
  if (state.winner) {
    showPrompt(state.winner, 'The final result and scoring are in the turn log.');
  } else if (ended || !prompt) {
    showPrompt('Game closed');
  } else if (prompt.kind === 'command') {
    renderCommands(prompt);
  } else if (prompt.kind === 'choices') {
    renderChoices(prompt);
  } else if (prompt.kind === 'continue') {
    showPrompt('Apply the changes on your board', 'Check the turn log before continuing.');
    controls.append(button('Continue', () => answer(''), 'primary'));
  } else if (prompt.kind === 'card') {
    renderCardEntry(false);
    controls.append(button('Cancel', () => answer('')));
  } else {
    renderText(prompt);
  }
}

function renderLog(output) {
  if (output.length) previousOutput = output;
  const newLines = output.filter(({ text }) => text.trim() && !/^\d+\)/.test(text.trim()));
  logLines.push(...newLines);
  logLines = logLines.slice(-250);
  byId('log-hint').hidden = logLines.length > 0;
  const fragment = document.createDocumentFragment();
  for (const { text, style } of logLines) {
    if (!text.trim()) continue;
    const divider = /^[-=]+$/.test(text.trim());
    const line = document.createElement(divider ? 'div' : 'p');
    line.className = 'line ' + (divider ? 'divider' : style);
    if (divider) line.setAttribute('aria-hidden', 'true');
    else line.textContent = text.trim();
    fragment.append(line);
  }
  log.replaceChildren(fragment);
  log.scrollTop = log.scrollHeight;
}

function renderBoard(state) {
  byId('track-commitment').textContent = state.commitment;
  byId('track-france').textContent = state.franceTrack;
  byId('track-border').textContent = state.borderZone;
  byId('eligibility').textContent = 'First eligible · ' + state.firstEligible + '  /  Second eligible · ' + state.secondEligible;
  const previous = spaceSelect.value;
  spaceSelect.replaceChildren(...state.spaces.map((space) => new Option(space.name, space.name)));
  const defaultSpace = state.spaces.find((space) => space.name.startsWith('Algiers'))?.name;
  if (previous || defaultSpace) spaceSelect.value = previous || defaultSpace;
  renderSpace();
}

function renderSpace() {
  const space = currentView?.state.spaces.find(({ name }) => name === spaceSelect.value);
  if (!space) return;
  const lines = [
    space.control + ' · ' + space.support + ' · Population ' + space.population,
    space.pieces.join(' · ') || 'No pieces in this space',
  ];
  if (space.markers.length) lines.push(space.markers.join(' · '));
  byId('space-state').replaceChildren(...lines.map((text) => {
    const line = document.createElement('p');
    line.textContent = text;
    return line;
  }));
}
spaceSelect.addEventListener('change', renderSpace);

function selectTab(tab, moveFocus = false) {
  for (const name of ['log', 'board']) {
    const selected = name === tab;
    const button = byId(name + '-tab');
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    byId(name + '-pane').hidden = !selected;
    if (selected && moveFocus) button.focus();
  }
  if (tab === 'log') log.scrollTop = log.scrollHeight;
}
for (const name of ['log', 'board']) {
  const tab = byId(name + '-tab');
  tab.addEventListener('click', () => selectTab(name));
  tab.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const target = event.key === 'Home' ? 'log' : event.key === 'End' ? 'board'
        : name === 'log' ? 'board' : 'log';
      selectTab(target, true);
    }
  });
}

function render() {
  const { state, output } = currentView;
  byId('new-game').textContent = 'New game';
  byId('scenario-name').textContent = state.scenario;
  byId('turn-title').textContent = 'Turn ' + state.turn;
  byId('current-event').textContent = state.currentCard
    || (state.previousCard ? 'Last card · ' + state.previousCard : 'Waiting for the first card');
  byId('gov-resources').textContent = state.govResources;
  byId('fln-resources').textContent = state.flnResources;
  byId('gov-points').textContent = state.govPoints;
  byId('fln-points').textContent = state.flnPoints;
  byId('propaganda').textContent = state.propCardsPlayed + ' / ' + state.numberOfPropCards;
  renderLog(output);
  renderAction(currentView);
  renderBoard(state);
}

try {
  savedValue = localStorage.getItem(storageKey);
  recoveryCopy = localStorage.getItem(recoveryKey);
} catch {
  canSave = false;
}
updateSaveControls();
if (savedValue !== null) {
  try {
    const session = readSave(savedValue);
    byId('setup').hidden = true;
    open(session, 'restore');
  } catch (error) {
    showRecovery(error);
  }
}
