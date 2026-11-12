import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInThisContext } from 'node:vm';

const source = readFileSync(new URL('../src/main/web/saves.js', import.meta.url), 'utf8');
const { readSave, writeSave } = runInThisContext(`(() => { ${source}\nreturn { readSave, writeSave }; })()`);
const legacy = { scenario: 'Short', finalSupport: false, seed: -1812, inputs: ['card 3', 'fln', ''] };

test('a legacy browser save can round trip through the versioned format', () => {
  const imported = readSave(JSON.stringify(legacy));
  assert.deepEqual(imported, legacy);
  const exported = writeSave(imported);
  const envelope = JSON.parse(exported);
  assert.equal(envelope.format, 'colonial-twilight-fln');
  assert.equal(envelope.version, 1);
  assert.equal(envelope.engineVersion, 'coltwi-v2.16-web-1');
  assert.deepEqual(readSave(exported), legacy);
});

test('damaged and incompatible save files are rejected before replay', () => {
  const envelope = JSON.parse(writeSave(legacy));
  assert.throws(() => readSave('broken JSON'), /valid JSON/);
  assert.throws(() => readSave(JSON.stringify({ ...envelope, format: 'another-game' })), /Colonial Twilight/);
  assert.throws(() => readSave(JSON.stringify({ ...envelope, version: 2 })), /format version/);
  assert.throws(() => readSave(JSON.stringify({ ...envelope, engineVersion: 'future' })), /FLN engine/);
  assert.throws(() => readSave(JSON.stringify({ ...legacy, seed: 2147483648 })), /invalid game data/);
  assert.throws(() => readSave(JSON.stringify({ ...legacy, inputs: [3] })), /invalid game data/);
});
