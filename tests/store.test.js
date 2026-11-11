/**
 * @file Tests for src/popup/store.js: the popup's actions, without a browser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/popup/store.js';

const URL_WITH_TRACKING = 'https://shop.example.com/p?id=42&utm_source=mail&utm_medium=email&color=red&gclid=abc#reviews';

/** A fresh store, loaded with `url`, that records every change it emits. */
function setup(url = URL_WITH_TRACKING) {
  const store = createStore();
  const changes = [];
  store.subscribe((kind) => changes.push(kind));
  store.load(url);
  return { store, changes };
}

const keys = (store) => store.state.params.map((p) => p.key);

test('a freshly loaded URL is not dirty', () => {
  const { store } = setup();
  assert.equal(store.currentUrl(), URL_WITH_TRACKING);
  assert.equal(store.isDirty(), false);
});

test('editing a value updates the URL and emits "edit"', () => {
  const { store, changes } = setup('https://a.com/?id=1');
  store.editParam(store.state.params[0].id, { value: '2' });
  assert.equal(store.currentUrl(), 'https://a.com/?id=2');
  assert.equal(store.isDirty(), true);
  assert.equal(changes.at(-1), 'edit');
});

test('unchecking leaves the param in the list but out of the URL', () => {
  const { store } = setup('https://a.com/?a=1&b=2');
  store.editParam(store.state.params[0].id, { enabled: false });
  assert.deepEqual(keys(store), ['a', 'b']);
  assert.equal(store.currentUrl(), 'https://a.com/?b=2');
});

test('remove, then undo, restores the param in its place', () => {
  const { store } = setup('https://a.com/?a=1&b=2&c=3');
  const { removed, undo } = store.removeParam(store.state.params[1].id);
  assert.equal(removed.key, 'b');
  assert.deepEqual(keys(store), ['a', 'c']);
  undo();
  assert.deepEqual(keys(store), ['a', 'b', 'c']);
});

test('removeTracking drops only tracking params, and can be undone', () => {
  const { store } = setup();
  assert.deepEqual(store.trackingKeys(), ['utm_source', 'utm_medium', 'gclid']);
  const { count, undo } = store.removeTracking();
  assert.equal(count, 3);
  assert.equal(store.currentUrl(), 'https://shop.example.com/p?id=42&color=red#reviews');
  undo();
  assert.equal(store.currentUrl(), URL_WITH_TRACKING);
});

test('addParam appends and emits "list"', () => {
  const { store, changes } = setup('https://a.com/?a=1');
  const p = store.addParam('ref', 'x');
  assert.equal(store.state.params.at(-1), p);
  assert.equal(store.currentUrl(), 'https://a.com/?a=1&ref=x');
  assert.equal(changes.at(-1), 'list');
});

test('addUtmParams only adds the missing ones', () => {
  const { store } = setup('https://a.com/?utm_source=x');
  store.addUtmParams();
  assert.deepEqual(keys(store), ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
  assert.equal(store.addUtmParams(), null);
});

test('sortByKey sorts naturally', () => {
  const { store } = setup('https://a.com/?p10=a&b=1&p2=c');
  store.sortByKey();
  assert.deepEqual(keys(store), ['b', 'p2', 'p10']);
});

test('the filter matches keys and values, case-insensitively', () => {
  const { store } = setup();
  store.setFilter('UTM');
  assert.deepEqual(store.visibleParams().map((p) => p.key), ['utm_source', 'utm_medium']);
  store.setFilter('red');
  assert.deepEqual(store.visibleParams().map((p) => p.key), ['color']);
});

test('text mode: edits are live, and leaving applies them', () => {
  const { store } = setup('https://a.com/?a=1&b=2');
  store.toggleTextMode();
  assert.equal(store.state.text, 'a=1\nb=2');
  store.setText('b=2\na=9');
  assert.equal(store.currentUrl(), 'https://a.com/?b=2&a=9');
  store.toggleTextMode();
  assert.deepEqual(keys(store), ['b', 'a']);
  assert.equal(store.state.textMode, false);
});

test('base and hash are editable', () => {
  const { store } = setup('https://a.com/x?a=1#top');
  store.setBase('https://b.com/y');
  store.setHash('#bottom');
  assert.equal(store.currentUrl(), 'https://b.com/y?a=1#bottom');
});

test('load restores remembered unchecked params in place', () => {
  const store = createStore();
  store.load('https://a.com/?b=2&c=3', [{ position: 0, rawKey: 'a', rawValue: '1', hasEquals: true }]);
  assert.deepEqual(keys(store), ['a', 'b', 'c']);
  assert.equal(store.state.params[0].enabled, false);
  assert.equal(store.isDirty(), false);
});
