// Checks dashboard/lib/browser-queue.ts: per-site ordering, cross-site overlap, waiting out a busy
// site, and when (and only when) the session is reset.
//
//   node scripts/check-browser-queue.js        (Node 22.18+/24: loads the .ts file directly)
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const q = await import(require('node:url').pathToFileURL(path.resolve(__dirname, '../dashboard/lib/browser-queue.ts')).href);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ok = (v = 'ok') => ({ ok: true, v });
  const busy = { ok: false, msg: 'blinkit search navigation failed: Session is busy: blinkit/cart (pid 1) is already driving it.' };
  const hung = { ok: false, msg: 'blinkit/set-cart-quantity timed out after 60s' };
  const failure = (r) => (r.ok ? null : r.msg);
  let passed = 0;
  const check = async (name, fn) => {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  };
  const noReset = () => assert.fail('the session must not be reset here');
  const fast = { busyWaitMs: 300, busyPollMs: 20 };

  await check('tasks for the SAME site run one at a time, in order', async () => {
    const log = [];
    const task = (id, ms) => async () => {
      log.push(`start ${id}`);
      await sleep(ms);
      log.push(`end ${id}`);
      return ok();
    };
    await Promise.all([
      q.runBrowserTask(task('a', 60), { site: 'blinkit', failure, retryable: true, reset: noReset }),
      q.runBrowserTask(task('b', 10), { site: 'blinkit', failure, retryable: true, reset: noReset }),
    ]);
    assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b']);
  });

  await check('tasks for DIFFERENT sites overlap (a Blinkit search does not wait for a Zepto one)', async () => {
    const running = new Set();
    let overlapped = false;
    const task = (site) => async () => {
      running.add(site);
      if (running.size > 1) overlapped = true;
      await sleep(60);
      running.delete(site);
      return ok();
    };
    await Promise.all([
      q.runBrowserTask(task('blinkit'), { site: 'blinkit', failure, retryable: true, reset: noReset }),
      q.runBrowserTask(task('zepto'), { site: 'zepto', failure, retryable: true, reset: noReset }),
    ]);
    assert.equal(overlapped, true);
  });

  await check('a busy site is WAITED OUT and retried — no reset, even for a purchase-like task', async () => {
    let calls = 0;
    const r = await q.runBrowserTask(async () => (++calls < 3 ? busy : ok('done')), { site: 'blinkit', failure, retryable: false, reset: noReset, ...fast });
    assert.equal(r.ok, true);
    assert.equal(calls, 3);
  });

  await check('a HUNG repeat-safe task triggers exactly one reset and one retry', async () => {
    let calls = 0;
    let resets = 0;
    const r = await q.runBrowserTask(async () => (++calls === 1 ? hung : ok()), { site: 'blinkit', failure, retryable: true, reset: async () => void resets++, ...fast });
    assert.equal(r.ok, true);
    assert.deepEqual([calls, resets], [2, 1]);
  });

  await check('a HUNG non-repeat-safe task (a purchase) is NEVER reset or retried', async () => {
    let calls = 0;
    const r = await q.runBrowserTask(async () => (++calls, hung), { site: 'blinkit', failure, retryable: false, reset: noReset, ...fast });
    assert.equal(r.ok, false);
    assert.equal(calls, 1);
  });

  await check('a site that stays busy past the wait is presumed wedged: one reset, one retry (repeat-safe only)', async () => {
    let calls = 0;
    let resets = 0;
    const r = await q.runBrowserTask(async () => (++calls, resets ? ok() : busy), { site: 'blinkit', failure, retryable: true, reset: async () => void resets++, ...fast });
    assert.equal(r.ok, true);
    assert.equal(resets, 1);
    // …while a non-repeat-safe task just reports the busy failure, without resetting anyone's work
    const stuck = await q.runBrowserTask(async () => busy, { site: 'blinkit', failure, retryable: false, reset: noReset, ...fast });
    assert.equal(stuck.ok, false);
  });

  await check('an ordinary failure (e.g. not logged in) is returned as it is: no wait, no reset', async () => {
    let calls = 0;
    const r = await q.runBrowserTask(async () => (++calls, { ok: false, msg: 'AUTH_REQUIRED: log in' }), { site: 'blinkit', failure, retryable: true, reset: noReset, ...fast });
    assert.equal(r.ok, false);
    assert.equal(calls, 1);
  });

  await check('one task failing does not stall the queue behind it', async () => {
    const boom = q.runBrowserTask(async () => { throw new Error('x'); }, { site: 'blinkit', failure, retryable: true, reset: noReset });
    await assert.rejects(boom);
    const next = await q.runBrowserTask(async () => ok(), { site: 'blinkit', failure, retryable: true, reset: noReset });
    assert.equal(next.ok, true);
  });

  await check('classification: busy is not "hung", and vice versa', () => {
    assert.equal(q.isSiteBusy(busy.msg), true);
    assert.equal(q.looksHung(busy.msg), false, 'a busy refusal mentions navigation failed but nothing hung');
    assert.equal(q.looksHung(hung.msg), true);
  });

  console.log(`\n${passed} checks passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
