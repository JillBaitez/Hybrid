/**
 * DAY 1 - UTILS MINIMAL TESTS
 * Unit tests for essential utilities
 */

import { cloneDeep, deepEqual, get, set, truncate, escapeRegExp } from './utils';

// Test cloneDeep
describe('cloneDeep', () => {
  test('clones primitive values', () => {
    expect(cloneDeep(42)).toBe(42);
    expect(cloneDeep('hello')).toBe('hello');
    expect(cloneDeep(true)).toBe(true);
    expect(cloneDeep(null)).toBe(null);
    expect(cloneDeep(undefined)).toBe(undefined);
  });

  test('clones arrays', () => {
    const arr = [1, 2, { a: 3 }];
    const cloned = cloneDeep(arr);
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  test('clones objects', () => {
    const obj = { a: 1, b: { c: 2 } };
    const cloned = cloneDeep(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
  });

  test('clones dates', () => {
    const date = new Date('2024-01-01');
    const cloned = cloneDeep(date);
    expect(cloned).toEqual(date);
    expect(cloned).not.toBe(date);
  });
});

// Test deepEqual
describe('deepEqual', () => {
  test('compares primitive values', () => {
    expect(deepEqual(42, 42)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(42, 43)).toBe(false);
    expect(deepEqual('hello', 'world')).toBe(false);
  });

  test('compares arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, { a: 2 }], [1, { a: 2 }])).toBe(true);
  });

  test('compares objects', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });
});

// Test get
describe('get', () => {
  const obj = { 
    a: { 
      b: { 
        c: 'value' 
      } 
    },
    arr: [{ x: 1 }, { y: 2 }]
  };

  test('gets nested values with string path', () => {
    expect(get(obj, 'a.b.c')).toBe('value');
    expect(get(obj, 'a.b')).toEqual({ c: 'value' });
  });

  test('gets nested values with array path', () => {
    expect(get(obj, ['a', 'b', 'c'])).toBe('value');
  });

  test('returns default value for missing paths', () => {
    expect(get(obj, 'a.b.d', 'default')).toBe('default');
    expect(get(obj, 'x.y.z', 42)).toBe(42);
  });

  test('handles null/undefined objects', () => {
    expect(get(null, 'a.b', 'default')).toBe('default');
    expect(get(undefined, 'a.b', 'default')).toBe('default');
  });
});

// Test set
describe('set', () => {
  test('sets nested values with string path', () => {
    const obj = {};
    set(obj, 'a.b.c', 'value');
    expect(obj).toEqual({ a: { b: { c: 'value' } } });
  });

  test('sets nested values with array path', () => {
    const obj = {};
    set(obj, ['a', 'b', 'c'], 'value');
    expect(obj).toEqual({ a: { b: { c: 'value' } } });
  });

  test('overwrites existing values', () => {
    const obj = { a: { b: 'old' } };
    set(obj, 'a.b', 'new');
    expect(obj.a.b).toBe('new');
  });

  test('creates intermediate objects', () => {
    const obj = { a: 1 };
    set(obj, 'a.b.c', 'value');
    expect(obj).toEqual({ a: { b: { c: 'value' } } });
  });
});

// Test truncate
describe('truncate', () => {
  test('truncates long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
    expect(truncate('hello world', 8, '...')).toBe('hello...');
  });

  test('does not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  test('uses custom suffix', () => {
    expect(truncate('hello world', 8, '***')).toBe('hello***');
  });

  test('handles edge cases', () => {
    expect(truncate('', 5)).toBe('');
    expect(truncate('hello', 5)).toBe('hello');
    expect(truncate('hello', 3, '...')).toBe('...');
  });
});

// Test escapeRegExp
describe('escapeRegExp', () => {
  test('escapes regex special characters', () => {
    expect(escapeRegExp('hello.world')).toBe('hello\\.world');
    expect(escapeRegExp('test*pattern')).toBe('test\\*pattern');
    expect(escapeRegExp('a+b?c^d$e')).toBe('a\\+b\\?c\\^d\\$e');
    expect(escapeRegExp('(group)|choice')).toBe('\\(group\\)\\|choice');
    expect(escapeRegExp('[class]')).toBe('\\[class\\]');
    expect(escapeRegExp('{1,2}')).toBe('\\{1,2\\}');
    expect(escapeRegExp('back\\slash')).toBe('back\\\\slash');
  });

  test('does not escape normal characters', () => {
    expect(escapeRegExp('hello')).toBe('hello');
    expect(escapeRegExp('123')).toBe('123');
    expect(escapeRegExp('hello_world')).toBe('hello_world');
  });

  test('handles empty string', () => {
    expect(escapeRegExp('')).toBe('');
  });
});