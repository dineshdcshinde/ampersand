/**
 * @file Tests for src/lib/unchecked-memory.js.
 * The bug this guards against: an unchecked param coming back in a different place.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, parseUrl } from '../src/lib/url-params.js';
import { rememberUnchecked, restoreUnchecked } from '../src/lib/unchecked-memory.js';

/**
 * Simulate the full cycle: untick some params → Update URL → page reloads → popup reopens.
 *
 * @param {string} url
 * @param {number[]} uncheck Indexes to untick.
 */
function untickAndReload(url, uncheck) {
  const before = parseUrl(url);
  uncheck.forEach((i) => (before.params[i].enabled = false));
  const saved = rememberUnchecked(before.params);
  const newUrl = buildUrl(before);

  const after = parseUrl(newUrl);
  const restored = restoreUnchecked(after.params, saved);
  return { newUrl, restored, after };
}

test('an unchecked first param comes back first', () => {
  const url = 'https://a.com/f?companyId=Y29t&userId=dXNy&routeId=cnV0==';
  const { newUrl, restored } = untickAndReload(url, [0]);
  assert.equal(newUrl, 'https://a.com/f?userId=dXNy&routeId=cnV0==');
  assert.deepEqual(restored.map((p) => p.key), ['companyId', 'userId', 'routeId']);
  assert.equal(restored[0].enabled, false);
});

test('several unchecked params keep their exact slots', () => {
  const { restored } = untickAndReload('https://a.com/?a=1&b=2&c=3&d=4&e=5', [1, 3]);
  assert.deepEqual(restored.map((p) => `${p.key}:${p.enabled}`), ['a:true', 'b:false', 'c:true', 'd:false', 'e:true']);
});

test('ticking them again restores the original URL', () => {
  const url = 'https://a.com/?a=1&b=2&c=3&d=4&e=5';
  const { restored, after } = untickAndReload(url, [0, 2, 4]);
  restored.forEach((p) => (p.enabled = true));
  assert.equal(buildUrl({ ...after, params: restored }), url);
});

test('original encoding survives the round trip', () => {
  const url = 'https://a.com/?q=hello+world&x=1';
  const { restored, after } = untickAndReload(url, [0]);
  restored[0].enabled = true;
  assert.equal(buildUrl({ ...after, params: restored }), url);
});

test('a param that is back in the URL is not duplicated', () => {
  const saved = [{ position: 0, rawKey: 'a', rawValue: '1', hasEquals: true }];
  const { params } = parseUrl('https://a.com/?a=1&b=2');
  assert.equal(restoreUnchecked(params, saved).length, 2);
});

test('a position past the end is clamped', () => {
  const saved = [{ position: 9, rawKey: 'z', rawValue: '9', hasEquals: true }];
  const { params } = parseUrl('https://a.com/?a=1');
  assert.deepEqual(restoreUnchecked(params, saved).map((p) => p.key), ['a', 'z']);
});
