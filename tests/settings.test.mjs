import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, VOLUMES, normalize, withChange, applySettings, getSettings, volumeMult } from '../src/settings.js';

test('everything is on by default, at normal volume', () => {
  assert.deepEqual(normalize(undefined), DEFAULTS); assert.deepEqual(normalize(null), DEFAULTS); assert.deepEqual(normalize('nope'), DEFAULTS); assert.deepEqual(normalize({}), DEFAULTS);
  assert.equal(DEFAULTS.volume, 'normal');
});
test('valid stored values are kept', () => {
  assert.deepEqual(normalize({ sound: false, volume: 'low', taskPing: false, annChime: false, eodReminder: false }), { sound: false, volume: 'low', taskPing: false, annChime: false, eodReminder: false });
});
test('wrong types and unknown values fall back, so a bad value can never break the app', () => {
  assert.deepEqual(normalize({ sound: 'no', volume: 'loud', taskPing: 0, annChime: null, eodReminder: [], extra: 1 }), DEFAULTS);
  assert.equal('extra' in normalize({ extra: 1 }), false);
  assert.equal(normalize({ volume: '__proto__' }).volume, 'normal'); assert.equal(normalize({ volume: 'constructor' }).volume, 'normal');
});
test('a change merges into what is there and ignores junk', () => {
  const a = withChange({ sound: false }, { volume: 'high' }); assert.equal(a.sound, false); assert.equal(a.volume, 'high'); assert.equal(a.taskPing, true);
  assert.equal(withChange(DEFAULTS, { volume: 'bogus' }).volume, 'normal');
});
test('applied settings are what the sound code reads', () => {
  applySettings({ sound: false, volume: 'high' }); assert.equal(getSettings().sound, false); assert.equal(volumeMult(), VOLUMES.high);
  applySettings(undefined); assert.equal(getSettings().sound, true); assert.equal(volumeMult(), 1);
});
test('volume steps are ordered', () => { assert.ok(VOLUMES.low < VOLUMES.normal && VOLUMES.normal < VOLUMES.high); });
