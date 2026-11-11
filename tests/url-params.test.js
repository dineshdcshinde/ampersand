/**
 * @file Tests for src/lib/url-params.js: parsing and rebuilding URLs.
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, decode, encode, isChanged, newParam, parseUrl, toObject } from '../src/lib/url-params.js';

/** Parse, change nothing, rebuild. */
const roundTrip = (url) => buildUrl(parseUrl(url));

test('parseUrl splits base, params and hash', () => {
  const { base, hash, params } = parseUrl('https://a.com/p?x=1&y=two#top');
  assert.equal(base, 'https://a.com/p');
  assert.equal(hash, 'top');
  assert.deepEqual(params.map((p) => [p.key, p.value]), [['x', '1'], ['y', 'two']]);
});

test('a URL without params or hash', () => {
  const { base, hash, params } = parseUrl('https://a.com/');
  assert.equal(base, 'https://a.com/');
  assert.equal(hash, '');
  assert.equal(params.length, 0);
});

test('values are decoded for display (+ and %20 become spaces)', () => {
  const { params } = parseUrl('https://a.com/?q=hello+world&r=a%20b&u=https%3A%2F%2Fx.com');
  assert.deepEqual(params.map((p) => p.value), ['hello world', 'a b', 'https://x.com']);
});

test('an untouched URL is rebuilt exactly, encoding included', () => {
  const urls = [
    'https://a.com/p?q=hello+world&r=a%20b#frag',
    'https://a.com/?flag&empty=&x=1',
    'https://a.com/?routeId=cnV0Rm9ybQ==&id=42',
    'https://a.com/?a=1&a=2',
    'https://a.com/?bad=%E0%A4%A',
  ];
  for (const url of urls) assert.equal(roundTrip(url), url);
});

test('base64 "=" padding stays inside the value', () => {
  const [p] = parseUrl('https://a.com/?t=YWJj==').params;
  assert.equal(p.key, 't');
  assert.equal(p.value, 'YWJj==');
});

test('an edited value is re-encoded, untouched ones are not', () => {
  const parsed = parseUrl('https://a.com/?q=hello+world&id=1');
  parsed.params[1].value = 'a b&c';
  assert.equal(buildUrl(parsed), 'https://a.com/?q=hello+world&id=a%20b%26c');
});

test('unchecked params are left out of the URL', () => {
  const parsed = parseUrl('https://a.com/?a=1&b=2&c=3');
  parsed.params[1].enabled = false;
  assert.equal(buildUrl(parsed), 'https://a.com/?a=1&c=3');
});

test('removing every param also removes the "?"', () => {
  const parsed = parseUrl('https://a.com/p?a=1#h');
  parsed.params = [];
  assert.equal(buildUrl(parsed), 'https://a.com/p#h');
});

test('new params are added with "="', () => {
  const parsed = parseUrl('https://a.com/');
  parsed.params.push(newParam('ref', ''));
  assert.equal(buildUrl(parsed), 'https://a.com/?ref=');
});

test('isChanged spots edits, and new params always count as changed', () => {
  const [p] = parseUrl('https://a.com/?a=1').params;
  assert.equal(isChanged(p), false);
  p.value = '2';
  assert.equal(isChanged(p), true);
  assert.equal(isChanged(newParam('x', 'y')), true);
});

test('encode keeps / : @ , readable', () => {
  assert.equal(encode('https://x.com/a,b@c d'), 'https://x.com/a,b@c%20d');
  assert.equal(decode(encode('a&b=c')), 'a&b=c');
});

test('decode never throws on malformed input', () => {
  assert.equal(decode('%E0%A4%A'), '%E0%A4%A');
});

test('toObject turns repeated keys into arrays', () => {
  const { params } = parseUrl('https://a.com/?a=1&b=2&a=3');
  assert.deepEqual(toObject(params), { a: ['1', '3'], b: '2' });
});
