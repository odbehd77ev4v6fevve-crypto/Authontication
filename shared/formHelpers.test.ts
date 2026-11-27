import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractEntityId,
  extractEntityIds,
  toDatetimeLocalInput,
  toOptionalNumberInput,
} from './formHelpers.ts';

test('extractEntityId handles null, undefined, primitives, populated docs, and ObjectId-like objects', () => {
  assert.equal(extractEntityId(null), '');
  assert.equal(extractEntityId(undefined), '');
  assert.equal(extractEntityId(''), '');
  assert.equal(extractEntityId('507f1f77bcf86cd799439011'), '507f1f77bcf86cd799439011');
  assert.equal(extractEntityId(42), '42');
  assert.equal(extractEntityId(Number.NaN), '');

  assert.equal(
    extractEntityId({ _id: '507f1f77bcf86cd799439012', name: 'Apple' }),
    '507f1f77bcf86cd799439012'
  );
  assert.equal(
    extractEntityId({ id: '507f1f77bcf86cd799439013', title: 'Item' }),
    '507f1f77bcf86cd799439013'
  );
  assert.equal(
    extractEntityId({ _id: { toString: () => '507f1f77bcf86cd799439014' } }),
    '507f1f77bcf86cd799439014'
  );
  assert.equal(
    extractEntityId({ toString: () => '507f1f77bcf86cd799439015' }),
    '507f1f77bcf86cd799439015'
  );
  assert.equal(extractEntityId({}), '');
});

test('extractEntityIds filters empty entries and normalizes mixed arrays cleanly', () => {
  assert.deepEqual(extractEntityIds(null), []);
  assert.deepEqual(extractEntityIds(undefined), []);
  assert.deepEqual(
    extractEntityIds([
      '65f1a2b3c4d5e6f7a8b9c001',
      { _id: '65f1a2b3c4d5e6f7a8b9c002', name: 'Samsung' },
      { id: '65f1a2b3c4d5e6f7a8b9c003' },
      null,
      {},
      '',
    ]),
    ['65f1a2b3c4d5e6f7a8b9c001', '65f1a2b3c4d5e6f7a8b9c002', '65f1a2b3c4d5e6f7a8b9c003']
  );
});

test('toOptionalNumberInput preserves 0 and valid numeric values while clearing empty/null/undefined', () => {
  assert.equal(toOptionalNumberInput(0), '0');
  assert.equal(toOptionalNumberInput('0'), '0');
  assert.equal(toOptionalNumberInput(1499.5), '1499.5');
  assert.equal(toOptionalNumberInput(null), '');
  assert.equal(toOptionalNumberInput(undefined), '');
  assert.equal(toOptionalNumberInput(''), '');
  assert.equal(toOptionalNumberInput('not-a-number'), '');
});

test('toDatetimeLocalInput formats local YYYY-MM-DDTHH:mm and ignores invalid dates', () => {
  assert.equal(toDatetimeLocalInput(null), '');
  assert.equal(toDatetimeLocalInput(undefined), '');
  assert.equal(toDatetimeLocalInput('invalid-date'), '');

  const sample = new Date(2026, 4, 15, 14, 30, 0, 0);
  assert.equal(toDatetimeLocalInput(sample), '2026-05-15T14:30');

  const parsed = toDatetimeLocalInput(sample.toISOString());
  assert.equal(parsed, '2026-05-15T14:30');
});
