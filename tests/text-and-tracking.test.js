/**
 * @file Tests for "Edit as text" (src/lib/text-format.js) and tracking detection (src/lib/tracking.js).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, parseUrl } from '../src/lib/url-params.js';
import { paramsFromText, paramsToText } from '../src/lib/text-format.js';
import { isTrackingKey } from '../src/lib/tracking.js';

test('params become one line each, unchecked lines start with #', () => {
  const { params } = parseUrl('https://a.com/?a=1&flag&q=hello+world');
  params[0].enabled = false;
  assert.equal(paramsToText(params), '# a=1\nflag\nq=hello world');
});

test('unchanged text keeps the original encoding', () => {
  const url = 'https://a.com/?q=hello+world&flag&b=2';
  const parsed = parseUrl(url);
  const params = paramsFromText(paramsToText(parsed.params), parsed.params);
  assert.equal(buildUrl({ ...parsed, params }), url);
});

test('edited, added, reordered and unchecked lines are all read back', () => {
  const parsed = parseUrl('https://a.com/?a=1&b=2');
  const params = paramsFromText('b=2\n# a=1\nnew=x y\n\n', parsed.params);
  assert.deepEqual(params.map((p) => [p.key, p.value, p.enabled]), [
    ['b', '2', true],
    ['a', '1', false],
    ['new', 'x y', true],
  ]);
  assert.equal(buildUrl({ ...parsed, params }), 'https://a.com/?b=2&new=x%20y');
});

test('common tracking params are recognised', () => {
  for (const key of ['utm_source', 'UTM_Campaign', 'gclid', 'fbclid', 'msclkid', '_hsenc', 'mc_cid', 'pk_kwd']) {
    assert.equal(isTrackingKey(key), true, key);
  }
});

test('normal params are not flagged as tracking', () => {
  for (const key of ['id', 'q', 'page', 'userId', 'utm', 'ref', '']) {
    assert.equal(isTrackingKey(key), false, key);
  }
});
