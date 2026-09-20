// The dashboard keeps a hand-written mirror of src/agents/pack-size.ts (it does not import from src/).
// This fails if the two ever give different answers.
//
//   npm run build && node scripts/check-pack-size.js
//   (the src side is the compiled dist/agents/pack-size.js; the dashboard side is loaded from its .ts on
//    Node 22.18+/24)
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const src = require(path.resolve(__dirname, '../dist/agents/pack-size.js'));
  const dash = await import(path.resolve(__dirname, '../dashboard/lib/pack-size.ts'));
  const cases = [
    ['Amul Taaza Toned Milk', '500 ml'], ['Amul Gold Milk', '1 L'], ['Superior MP Wheat Atta', '1 pack (1 kg)'],
    ['Aashirvaad Atta - 5 kg', '5 kg'], ['Aashirvaad Atta 5kg', '5 KG'], ['Amul Milk (1 L)', '1 l'],
    ['Amul Milk', '1 pack'], ['Amul Milk', 'Pack of 2'], ['Amul Milk', ''], ['Amul Milk', undefined], ['Amul Milk', 500],
    ['Coke', '2 x 250 ml'], ['Ghee', '1 pack (500 gm)'],
  ];
  for (const [name, size] of cases) {
    assert.equal(dash.withPackSize(name, size), src.withPackSize(name, size), `mirror drifted for ${JSON.stringify([name, size])}`);
  }
  console.log(`${cases.length} cases: the dashboard mirror matches src/agents/pack-size.ts`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
