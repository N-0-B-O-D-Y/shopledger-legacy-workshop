'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function order(items, coupon) {
  return { id: 1, coupon: coupon || '', items: items };
}

function assertInvoiceMatchesPricing(items, coupon) {
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures(order(items, coupon));

  assert.deepEqual(
    {
      subtotal: printed.subtotal,
      discount: printed.discount,
      tax: printed.tax,
      cgst: printed.cgst,
      sgst: printed.sgst,
      total: printed.total
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total
    }
  );
  assert.deepEqual(
    printed.rows.map(function (row) {
      return { gstPercent: row.gstPercent, line: row.line, lineTax: row.lineTax };
    }),
    billed.lines.map(function (line) {
      return { gstPercent: line.gstPercent, line: line.gross, lineTax: line.tax };
    })
  );
}

test('invoice matches billed HSN GST, split, and total', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const printed = invoice.computeInvoiceFigures(order(items, ''));

  assertInvoiceMatchesPricing(items, '');
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.cgst, 2.5);
  assert.equal(printed.sgst, 2.5);
  assert.equal(printed.total, 105);
});

test('invoice matches capped SAVE10 discount and post-discount GST', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 5, price: 2000, qty: 1 }];
  const printed = invoice.computeInvoiceFigures(order(items, 'SAVE10'));

  assertInvoiceMatchesPricing(items, 'SAVE10');
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.total, 1942.5);
});

test('invoice matches pricing when a coupon minimum is not met', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 5, price: 100, qty: 1 }];
  const printed = invoice.computeInvoiceFigures(order(items, 'SAVE10'));

  assertInvoiceMatchesPricing(items, 'SAVE10');
  assert.equal(printed.discount, 0);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('invoice matches flat coupon apportionment across GST slabs', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', gstRate: 5, price: 300, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', gstRate: 18, price: 100, qty: 1 }
  ];
  const printed = invoice.computeInvoiceFigures(order(items, 'FLAT50'));

  assertInvoiceMatchesPricing(items, 'FLAT50');
  assert.equal(printed.discount, 50);
  assert.equal(printed.tax, 28.88);
  assert.equal(printed.total, 378.88);
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [13.13, 15.75]);
});

test('invoice interprets decimal gstRate the same way as pricing', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }];
  const printed = invoice.computeInvoiceFigures(order(items, ''));

  assertInvoiceMatchesPricing(items, '');
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
});
