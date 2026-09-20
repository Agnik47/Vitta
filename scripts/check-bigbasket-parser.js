// Checks dashboard/lib/product-sources/bigbasket-markdown.ts against a real BigBasket page capture
// (scripts/fixtures/bigbasket-atta.md, an excerpt of what Anakin returned for `q=atta`, 2026-09-20)
// and against the guards: a listing without a real price or name is dropped, never defaulted.
//
//   node scripts/check-bigbasket-parser.js        (Node 22.18+/24: loads the .ts file directly)
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

(async () => {
  const { parseBigBasketMarkdown } = await import(require('node:url').pathToFileURL(path.resolve(__dirname, '../dashboard/lib/product-sources/bigbasket-markdown.ts')).href);
  const real = parseBigBasketMarkdown(readFileSync(path.resolve(__dirname, 'fixtures/bigbasket-atta.md'), 'utf-8'));
  let passed = 0;
  const check = (name, fn) => {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  };

  check('reads every card in the real capture', () => assert.equal(real.length, 4));
  check('name comes from the image alt and carries the pack size', () => assert.equal(real[0].name, 'Aashirvaad Atta/Godihittu - Whole Wheat 5 kg'));
  check('price and MRP are read from the "₹price₹mrp" line', () => {
    assert.equal(real[0].priceInr, 273.59);
    assert.equal(real[0].mrpInr, 306);
  });
  check('the tracking query string is stripped from the URL', () => assert.equal(real[0].url, 'https://www.bigbasket.com/pd/126903/aashirvaad-atta-whole-wheat-5-kg-pouch/'));
  check('a card without an image uses heading + pack size as its name', () => {
    const bharat = real.find((l) => l.url.includes('/pd/40339027/'));
    assert.ok(bharat);
    assert.equal(bharat.name, 'Bharat Atta Whole Wheat Flour 10 kg');
    assert.equal(bharat.priceInr, 30); // exactly what the page shows; the gate prices the real cart at purchase time
    assert.equal(bharat.mrpInr, undefined);
    assert.equal(bharat.imageUrl, undefined);
  });
  check('every real listing is marked available', () => assert.ok(real.every((l) => l.available)));

  const card = (title, price, extra = '') =>
    `### [Brand\\ **${title}**](https://www.bigbasket.com/pd/1/x/?nc=cl)   4.1 9 Ratings   1 kg\n\n${price}\n\n${extra}\n\n`;
  check('SYNTHETIC: a card with no price is dropped, not defaulted to 0', () => assert.deepEqual(parseBigBasketMarkdown(card('No Price Atta', '')), []));
  check('SYNTHETIC: "Notify Me" marks a listing out of stock', () => {
    const [l] = parseBigBasketMarkdown(card('Sold Out Atta', '₹99.00', 'Notify Me'));
    assert.equal(l.available, false);
  });
  check('SYNTHETIC: empty / non-BigBasket markdown yields nothing', () => {
    assert.deepEqual(parseBigBasketMarkdown(''), []);
    assert.deepEqual(parseBigBasketMarkdown('# Just a page\n\n₹5'), []);
  });
  check('SYNTHETIC: an MRP below the price is not reported as a discount', () => {
    const [l] = parseBigBasketMarkdown(card('Odd Atta', '₹100.00₹90.00'));
    assert.equal(l.mrpInr, undefined);
  });

  console.log(`\n${passed} checks passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
