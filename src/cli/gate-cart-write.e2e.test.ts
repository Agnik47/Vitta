// A cart write through the real gate must not ask webcmd for a trace.
//
// Measured live (2026-09-20): `blinkit set-cart-quantity` took 7s without `--trace on` and hung past
// 90s with it, wedging webcmd's single browser session for every later call — "add to cart" looked
// broken. A trace is receipt evidence, and only a purchase commit produces a receipt.
// Needs the compiled gate — `npm test` builds first.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_MANDATE, createSandbox, sandboxSupported, type Sandbox } from '../agents/sandbox/harness';

const skip = sandboxSupported() ? false : 'sandbox needs a POSIX shell shim for webcmd';

describe('gate run: webcmd trace flag', { skip }, () => {
  let sb: Sandbox;
  beforeEach(async () => {
    sb = await createSandbox(DEMO_MANDATE);
  });
  afterEach(async () => {
    await sb.cleanup();
  });

  const traceFlag = (argv: string[]): string | undefined => argv[argv.indexOf('--trace') + 1];

  test('a cart write (set-cart-quantity) is run with --trace off', async () => {
    const r = await sb.gate(['run', '--', 'webcmd', 'blinkit', 'set-cart-quantity', 'bk-milk-1l', '--quantity', '1']);
    assert.ok(r.ok, r.stdout + r.stderr);
    const write = sb.webcmdCalls().find((argv) => argv[1] === 'set-cart-quantity');
    assert.ok(write, 'the write reached the (fake) merchant');
    assert.equal(traceFlag(write), 'off');
  });

  test('a cart write is still governed: it lands in the cart exactly as asked (absolute, so repeating it is safe)', async () => {
    for (let i = 0; i < 2; i++) {
      const r = await sb.gate(['run', '--', 'webcmd', 'blinkit', 'set-cart-quantity', 'bk-milk-1l', '--quantity', '2']);
      assert.ok(r.ok, r.stdout + r.stderr);
    }
    assert.equal(sb.webcmdCalls().filter((argv) => argv[1] === 'set-cart-quantity').length, 2);
  });
});
