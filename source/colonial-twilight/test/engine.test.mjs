import assert from 'node:assert/strict';
import test from 'node:test';
import { answerPrompt, listCards, openGame } from '../target/scala-2.13/colonial-twilight-fln-web-opt/main.js';

test('all three scenarios start and accept physical deck cards', () => {
  const cards = listCards();
  assert.equal(cards.length, 65);
  assert.equal(cards.find(({ number }) => number === 3).name, 'Leadership Snatch');
  assert.ok(cards.every(({ number }) => number < 61 || number > 66));
  for (const [scenario, propagandaCards] of [['Short', 3], ['Medium', 4], ['Full', 5]]) {
    const opened = openGame(scenario, false, 1812, []);
    assert.equal(opened.state.turn, 1);
    assert.equal(opened.state.numberOfPropCards, propagandaCards);
    const view = answerPrompt('card 3');
    assert.equal(view.state.currentCard, '#3 Leadership Snatch');
    assert.ok(view.prompt.options.some(({ value }) => value === 'fln'));
  }
});

test('a reload resumes a paused bot turn and keeps exactly one copy of each move', () => {
  const inputs = ['card 3', 'fln'];
  openGame('Short', false, 1812, []);
  answerPrompt(inputs[0]);
  const paused = answerPrompt(inputs[1]);
  assert.equal(paused.prompt.kind, 'continue');

  const restored = openGame('Short', false, 1812, inputs);
  assert.deepEqual(restored.state, paused.state);
  assert.deepEqual(restored.prompt, paused.prompt);
  const restoredLog = [...restored.priorHistory, ...restored.output.map(({ text }) => text)];
  assert.equal(restoredLog.filter((line) => line.includes('FLN executes Rally operation')).length, 1);

  let view = restored;
  for (let step = 0; step < 20 && view.prompt.kind === 'continue'; step++) {
    inputs.push('');
    view = answerPrompt('');
  }
  assert.ok(view.prompt.options.some(({ value }) => value === 'gov'));
  const menu = answerPrompt('gov');
  const pass = menu.prompt.options.find(({ label }) => label === 'Pass');
  const completed = answerPrompt(pass.value);
  assert.equal(completed.state.turn, 2);
  assert.equal(completed.state.govResources, 22);
  assert.equal(completed.state.flnResources, 10);
  const resumed = openGame('Short', false, 1812, [...inputs, 'gov', pass.value]);
  assert.deepEqual(resumed.state, completed.state);
  assert.deepEqual(resumed.prompt, completed.prompt);

  const rollback = answerPrompt('rollback 1');
  assert.ok(rollback.prompt.options.some(({ value }) => value === 'y'));
  const rolledBack = answerPrompt('y');
  assert.equal(rolledBack.state.turn, 1);
  assert.equal(rolledBack.state.govResources, 20);
  assert.equal(rolledBack.state.flnResources, 15);
});

test('oversized numeric adjustments leave the same prompt and can be corrected', () => {
  openGame('Short', false, 1812, []);
  answerPrompt('adjust');
  const before = answerPrompt('gov resources');
  assert.equal(before.prompt.kind, 'integer');
  assert.equal(before.prompt.minimum, 0);
  assert.equal(before.prompt.maximum, 50);

  for (const value of ['2147483648', '51', '1.5']) {
    const after = answerPrompt(value);
    assert.deepEqual(after.state, before.state);
    assert.deepEqual(after.prompt, before.prompt);
    assert.ok(after.output.some(({ text }) => text === 'Enter a whole number from 0 to 50.'));
  }
  assert.equal(answerPrompt('30').state.govResources, 30);
});

test('a saved transcript must end where the engine stops reading answers', () => {
  assert.equal(openGame('Short', false, 1812, ['quit', 'y']).ended, true);
  assert.throws(
    () => openGame('Short', false, 1812, ['quit', 'y', 'card 3']),
    /Saved responses continue past the end of the game/,
  );
});
