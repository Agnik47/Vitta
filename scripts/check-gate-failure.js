// dashboard/lib/gate-failure.ts: the text shown when a spawned `gate` command failed. The gate's reason is
// on stderr, but stdout may already hold success-looking lines ("ALLOW …") — those must not hide it.
//
//   node scripts/check-gate-failure.js        (Node 22.18+/24: loads the .ts file directly)
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const { describeGateFailure } = await import(pathToFileURL(path.resolve(__dirname, '../dashboard/lib/gate-failure.ts')).href);
  let passed = 0;
  const check = (name, fn) => {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  };

  check('the case that failed live: an ALLOW line on stdout no longer hides the reason on stderr', () => {
    const out = '› blinkit set-cart-quantity 7 --quantity 1\nALLOW  blinkit/set-cart-quantity · ₹0';
    const err = '✗ Execution failed: webcmd exited 2 — productId must be a Blinkit product id, for example 19512 (ARGUMENT)\n';
    assert.equal(describeGateFailure(out, err, 'fallback'), 'Execution failed: webcmd exited 2 — productId must be a Blinkit product id, for example 19512 (ARGUMENT)');
  });
  check('a policy refusal (DENY is on stdout, stderr empty) comes through unchanged', () => {
    const out = '✗ DENY  blinkit/place-order\n  OVER_PER_TXN_CAP\n  ₹540 exceeds ₹500';
    assert.equal(describeGateFailure(out, '', 'fallback'), out);
  });
  check('a DENY line plus a stderr reason keeps both, verdict first', () => {
    assert.equal(describeGateFailure('✗ DENY  x/y\n  EXPIRED', '✗ then this also failed', 'f'), 'DENY  x/y\nthen this also failed');
  });
  check('several stderr lines are kept; the ✗ marker and blank lines are dropped', () => {
    assert.equal(describeGateFailure('', '✗ first\n\n  ✗ second\r\n', 'f'), 'first\nsecond');
  });
  check('nothing at all → the fallback; stdout-only failures → stdout', () => {
    assert.equal(describeGateFailure('', '', 'gate fund failed'), 'gate fund failed');
    assert.equal(describeGateFailure('some output', '', 'f'), 'some output');
  });

  console.log(`\n${passed} checks passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
