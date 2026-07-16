/**
 * Float Precision Test — Simulates Django REST Framework DecimalField validation
 *
 * DRF does: decimal.Decimal(str(value))  — where str() uses shortest round-trip repr
 * JS equivalent: Number.toString()       — same shortest representation
 *
 * So 50.3 → "50.3" → Decimal("50.3") = 3 digits ✓
 * But 50.300000000000004 → "50.300000000000004" → Decimal("50.300000000000004") = 18 digits ✗
 *
 * Run: node frontend/tests/float-precision-test.js
 */

// ─── Django DRF DecimalField Validator (accurate simulation) ─────────────────
function drfDecimalValidate(value, { maxDigits = 12, decimalPlaces = 2 } = {}) {
    // DRF does: Decimal(str(python_float))
    // Python str() and JS toString() both produce shortest round-trip representation
    const str = String(value);
    const clean = str.replace('-', '');
    const parts = clean.split('.');
    const intPart = parts[0] === '0' ? '' : parts[0];
    const decPart = parts[1] || '';
    const intDigits = intPart.length;
    const decDigits = decPart.length;
    const totalDigits = intDigits + decDigits;

    const digitsOk = totalDigits <= maxDigits;
    const decOk = decDigits <= decimalPlaces;

    return {
        ok: digitsOk && decOk,
        value,
        repr: str,
        totalDigits,
        decDigits,
        reason: !digitsOk
            ? `${totalDigits} total digits (max ${maxDigits})`
            : !decOk
                ? `${decDigits} decimal places (max ${decimalPlaces})`
                : null
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const R2 = (x) => Math.round(x * 100) / 100;   // our fix
const raw = (x) => x;                            // old behavior (no rounding)

let passed = 0, failed = 0, total = 0;
const oldBroken = [];
const newBroken = [];

function test(label, oldValue, newValue, { maxDigits = 12, decimalPlaces = 2 } = {}) {
    total++;
    const oldResult = drfDecimalValidate(oldValue, { maxDigits, decimalPlaces });
    const newResult = drfDecimalValidate(newValue, { maxDigits, decimalPlaces });

    const oldIcon = oldResult.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const newIcon = newResult.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';

    console.log(`  ${oldIcon} OLD: ${oldResult.repr.padEnd(25)} ${newIcon} NEW: ${newResult.repr.padEnd(15)}  ${label}`);

    if (!oldResult.ok) {
        oldBroken.push({ label, ...oldResult });
    }
    if (!newResult.ok) {
        newBroken.push({ label, ...newResult });
        failed++;
    } else {
        passed++;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 1: BOM — Batch Size corruption
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 1: BOM — Batch Size Decimal Stripping ━━━\x1b[0m');
console.log('  User types "100.123" in batch size field\n');
{
    const input = "100.123";
    const oldParsed = parseInt(input.replace(/[^0-9]/g, ''), 10);           // 100123 (BUG)
    const newParsed = parseInt(input.split('.')[0].replace(/[^0-9]/g, ''), 10); // 100 (FIX)

    console.log(`  Parsed: OLD=${oldParsed}  NEW=${newParsed}\n`);

    const rate = 20.12;
    test(`batch(${input}) × rate(${rate}) → amount`, raw(oldParsed * rate), R2(newParsed * rate));
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 2: BOM — qty × rate float artifacts
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 2: BOM — qty × rate Floating Point Artifacts ━━━\x1b[0m');
{
    const cases = [
        [2.5, 20.12],
        [0.1, 0.2],
        [33.33, 15.67],
        [999.999, 999.99],
        [7, 14.29],
        [1.1, 2.2],
        [3, 9.99],
        [150.5, 23.45],
        [0.333, 100.01],
    ];

    for (const [q, r] of cases) {
        test(`${q} × ${r}`, raw(q * r), R2(q * r));
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 3: MaterialRequisitionModal — total accumulation
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 3: MaterialRequisitionModal — Total Accumulation ━━━\x1b[0m');
{
    const items = [
        { qty: 150.5, rate: 23.45 },
        { qty: 200.75, rate: 45.67 },
        { qty: 99.123, rate: 12.89 },
        { qty: 500, rate: 7.77 },
        { qty: 0.333, rate: 100.01 },
    ];

    // OLD: no rounding
    const oldTotal = items.reduce((s, i) => s + (i.qty * i.rate), 0);
    // NEW: round each line, then round total
    const newTotal = R2(items.reduce((s, i) => s + R2(i.qty * i.rate), 0));

    test('total_amount (5 line items)', oldTotal, newTotal);

    // Also test individual line amounts
    for (const { qty, rate } of items) {
        test(`  line: ${qty} × ${rate}`, raw(qty * rate), R2(qty * rate));
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 4: SalesInvoiceModal — Tax Inclusive
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 4: SalesInvoiceModal — Tax Inclusive (CGST+SGST) ━━━\x1b[0m');
{
    const cases = [
        { qty: 5, price: 118, cgst: 9, sgst: 9, label: '18% GST' },
        { qty: 3, price: 256.50, cgst: 6, sgst: 6, label: '12% GST' },
        { qty: 7, price: 99.99, cgst: 2.5, sgst: 2.5, label: '5% GST' },
        { qty: 11, price: 1499.99, cgst: 14, sgst: 14, label: '28% GST' },
        { qty: 1, price: 47.50, cgst: 9, sgst: 9, label: '18% GST small' },
    ];

    for (const { qty, price, cgst, sgst, label } of cases) {
        const taxRate = cgst + sgst;
        console.log(`\n  --- ${label}: ${qty} × ₹${price} ---`);

        // OLD
        const oTotal = qty * price;
        const oTaxable = oTotal / (1 + taxRate / 100);
        const oTax = oTotal - oTaxable;
        const oCgst = oTax * (cgst / taxRate);
        const oSgst = oTax * (sgst / taxRate);

        // NEW
        const nTotal = R2(qty * price);
        const nTaxable = R2(nTotal / (1 + taxRate / 100));
        const nTax = R2(nTotal - nTaxable);
        const nCgst = R2(nTax * (cgst / taxRate));
        const nSgst = R2(nTax - nCgst);

        test(`taxable_value`, oTaxable, nTaxable);
        test(`cgst_amount`, oCgst, nCgst);
        test(`sgst_amount`, oSgst, nSgst);
        test(`total`, oTotal, nTotal);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 5: SalesInvoiceModal — Tax Exclusive
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 5: SalesInvoiceModal — Tax Exclusive ━━━\x1b[0m');
{
    const cases = [
        { qty: 5, price: 100, cgst: 9, sgst: 9, label: '18% GST' },
        { qty: 3, price: 256.50, cgst: 6, sgst: 6, label: '12% GST' },
        { qty: 7, price: 99.99, cgst: 2.5, sgst: 2.5, label: '5% GST' },
    ];

    for (const { qty, price, cgst, sgst, label } of cases) {
        console.log(`\n  --- ${label}: ${qty} × ₹${price} ---`);

        // OLD
        const oTaxable = qty * price;
        const oCgst = oTaxable * (cgst / 100);
        const oSgst = oTaxable * (sgst / 100);
        const oTotal = oTaxable + oCgst + oSgst;

        // NEW
        const nTaxable = R2(qty * price);
        const nCgst = R2(nTaxable * (cgst / 100));
        const nSgst = R2(nTaxable * (sgst / 100));
        const nTotal = R2(nTaxable + nCgst + nSgst);

        test(`taxable_value`, oTaxable, nTaxable);
        test(`cgst_amount`, oCgst, nCgst);
        test(`sgst_amount`, oSgst, nSgst);
        test(`total`, oTotal, nTotal);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 6: Distributor InvoiceModal — with Cess
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 6: Distributor InvoiceModal — Tax + Cess ━━━\x1b[0m');
{
    const cases = [
        { qty: 10, rate: 345.67, cgst: 9, sgst: 9, cess: 1, label: '19% on ₹345.67' },
        { qty: 25, rate: 12.99, cgst: 2.5, sgst: 2.5, cess: 0, label: '5% on ₹12.99' },
        { qty: 3, rate: 9999.99, cgst: 14, sgst: 14, cess: 3, label: '31% on ₹9999.99' },
    ];

    for (const { qty, rate, cgst, sgst, cess, label } of cases) {
        console.log(`\n  --- ${label}: ${qty} × ₹${rate} ---`);

        // OLD (tax exclusive)
        const oTaxable = qty * rate;
        const oCgst = oTaxable * (cgst / 100);
        const oSgst = oTaxable * (sgst / 100);
        const oCess = oTaxable * (cess / 100);
        const oTotal = oTaxable + oCgst + oSgst + oCess;

        // NEW
        const nTaxable = R2(qty * rate);
        const nCgst = R2(nTaxable * (cgst / 100));
        const nSgst = R2(nTaxable * (sgst / 100));
        const nCess = R2(nTaxable * (cess / 100));
        const nTotal = R2(nTaxable + nCgst + nSgst + nCess);

        test(`taxable_value`, oTaxable, nTaxable);
        test(`cgst_amount`, oCgst, nCgst);
        test(`sgst_amount`, oSgst, nSgst);
        test(`cess_amount`, oCess, nCess);
        test(`total_price`, oTotal, nTotal);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 7: SalesInvoiceModal — Discount
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 7: SalesInvoiceModal — Discount Calculation ━━━\x1b[0m');
{
    const cases = [
        { subtotal: 15000.50, tax: 2700.09, pct: 10, label: '10% off ₹17700.59' },
        { subtotal: 999.99, tax: 180, pct: 15, label: '15% off ₹1179.99' },
        { subtotal: 33333.33, tax: 6000, pct: 5, label: '5% off ₹39333.33' },
        { subtotal: 1234.56, tax: 222.22, pct: 7.5, label: '7.5% off ₹1456.78' },
    ];

    for (const { subtotal, tax, pct, label } of cases) {
        const oTotalBefore = subtotal + tax;
        const oDiscount = oTotalBefore * (pct / 100);

        const nTotalBefore = R2(subtotal + tax);
        const nDiscount = R2(nTotalBefore * (pct / 100));

        test(`discount (${label})`, oDiscount, nDiscount);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 8: my-orders — Cart total
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 8: my-orders — Cart Total ━━━\x1b[0m');
{
    const cart = [
        { price: 49.99, qty: 3 },
        { price: 199.50, qty: 2 },
        { price: 14.29, qty: 7 },
        { price: 9.99, qty: 10 },
    ];

    const oldTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const newTotal = R2(cart.reduce((s, i) => s + R2(i.price * i.qty), 0));

    test(`cart total (${cart.length} products)`, oldTotal, newTotal);
}

// ═════════════════════════════════════════════════════════════════════════════
//  TEST 9: Edge cases — extreme values
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m━━━ TEST 9: Edge Cases ━━━\x1b[0m');
{
    test('classic: 0.1 + 0.2', 0.1 + 0.2, R2(0.1 + 0.2));
    test('large qty × rate', 99999 * 99.99, R2(99999 * 99.99));
    test('tiny × tiny', 0.01 * 0.03, R2(0.01 * 0.03));
    test('repeating: 10 / 3', 10 / 3, R2(10 / 3));
    test('₹1 × 1M qty', 1 * 1000000, R2(1 * 1000000));
    test('near max: 9999999999.99', 9999999999.99, R2(9999999999.99));  // 12 digits exactly
    test('overflow: 99999999999.99', 99999999999.995, R2(99999999999.995));  // 13+ digits
}

// ═════════════════════════════════════════════════════════════════════════════
//  FINAL REPORT
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m══════════════════════════════════════════════════════════════\x1b[0m');
console.log(`\x1b[1m  Total tests: ${total}\x1b[0m`);
console.log(`  \x1b[32mNEW (fixed) passed:  ${passed}\x1b[0m`);
console.log(`  \x1b[31mNEW (fixed) failed:  ${failed}\x1b[0m`);
console.log(`  \x1b[33mOLD (broken) values: ${oldBroken.length}\x1b[0m`);

if (oldBroken.length > 0) {
    console.log('\n\x1b[33m  OLD values that WOULD break Django (before our fix):\x1b[0m');
    for (const b of oldBroken) {
        console.log(`    \x1b[31m✗\x1b[0m ${b.label}`);
        console.log(`      → "${b.repr}" — ${b.reason}`);
    }
}

if (newBroken.length > 0) {
    console.log('\n\x1b[31m  NEW values that STILL break Django (fix insufficient!):\x1b[0m');
    for (const b of newBroken) {
        console.log(`    \x1b[31m✗\x1b[0m ${b.label}`);
        console.log(`      → "${b.repr}" — ${b.reason}`);
    }
} else {
    console.log('\n  \x1b[32m★ All NEW (fixed) values pass Django validation!\x1b[0m');
}

console.log('\x1b[1m══════════════════════════════════════════════════════════════\x1b[0m\n');

process.exit(failed > 0 ? 1 : 0);
