// Tests for the add-to-cart product reference resolver. Two things are being protected:
//   1. Correctness — each merchant's command takes a different form (id vs URL) and getting it
//      wrong means every add-to-cart for that merchant fails, which is what was happening to Zepto.
//   2. Safety — a "product URL" is handed to a real, logged-in browser session. A URL that isn't
//      genuinely that merchant's must never get through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canAddToCart, isAddToCartMerchant, resolveProductRef } from "./product-ref";

// Real URLs of the shapes each merchant actually returns.
const BIGBASKET_URL =
  "https://www.bigbasket.com/pd/150502/fresho-farm-eggs-table-tray-medium-antibiotic-residue-free-30-pcs/";
const ZEPTO_URL = "https://www.zeptonow.com/pn/maggi-2-minute-noodles/pvid/8f3c1e22-1111-4a2b-9f00-abc123456789";

// ---------------------------------------------------------------------------------------------
// BigBasket — id extraction from a real URL (the path verified live against webcmd).
// ---------------------------------------------------------------------------------------------

test("bigbasket: extracts the /pd/<id>/ id from a real product URL and prefers it over the URL", () => {
  const result = resolveProductRef(BIGBASKET_URL, "bigbasket");
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.arg, "150502");
  assert.equal(result.ok && result.kind, "id");
});

test("bigbasket: a bare id passes through unchanged", () => {
  const result = resolveProductRef("150502", "bigbasket");
  assert.equal(result.ok && result.arg, "150502");
});

test("bigbasket: a valid bigbasket URL with no /pd/ segment falls back to passing the URL", () => {
  const result = resolveProductRef("https://www.bigbasket.com/ps/?q=eggs", "bigbasket");
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.kind, "url");
});

// ---------------------------------------------------------------------------------------------
// Zepto — the merchant whose add-to-cart was outright broken before this.
// ---------------------------------------------------------------------------------------------

test("zepto: a real product URL is accepted (its command takes a URL, not an id)", () => {
  const result = resolveProductRef(ZEPTO_URL, "zepto");
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.kind, "url");
  assert.equal(result.ok && result.arg, ZEPTO_URL);
});

test("zepto: a bare id is refused with a reason, not silently guessed into a URL", () => {
  // Zepto URLs are /pn/<slug>/pvid/<uuid> — the slug isn't derivable from the uuid, so inventing
  // one would send the browser somewhere wrong.
  const result = resolveProductRef("8f3c1e22-1111-4a2b-9f00-abc123456789", "zepto");
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /URL/i);
});

// ---------------------------------------------------------------------------------------------
// Blinkit — id only.
// ---------------------------------------------------------------------------------------------

test("blinkit: a product id is accepted, a URL is refused", () => {
  assert.equal(resolveProductRef("512345", "blinkit").ok, true);
  assert.equal(resolveProductRef("https://blinkit.com/prn/x/prid/512345", "blinkit").ok, false);
});

test("blinkit: junk that isn't an id is refused", () => {
  assert.equal(resolveProductRef("../../etc/passwd", "blinkit").ok, false);
  assert.equal(resolveProductRef("--quantity 99", "blinkit").ok, false);
  assert.equal(resolveProductRef("", "blinkit").ok, false);
});

// ---------------------------------------------------------------------------------------------
// Host validation — the actual security boundary.
// ---------------------------------------------------------------------------------------------

test("a URL on the wrong merchant's host is refused", () => {
  assert.equal(resolveProductRef(BIGBASKET_URL, "zepto").ok, false);
  assert.equal(resolveProductRef(ZEPTO_URL, "bigbasket").ok, false);
});

test("lookalike and suffix-attack hosts are refused", () => {
  const attacks = [
    "https://evil-bigbasket.com/pd/150502/x/",
    "https://bigbasket.com.attacker.net/pd/150502/x/",
    "https://notzeptonow.com/pn/x/pvid/y",
    "https://attacker.net/?next=https://www.bigbasket.com/pd/150502/x/",
  ];
  for (const url of attacks) {
    assert.equal(resolveProductRef(url, "bigbasket").ok, false, `must refuse ${url}`);
    assert.equal(resolveProductRef(url, "zepto").ok, false, `must refuse ${url}`);
  }
});

test("a legitimate subdomain of the merchant is allowed", () => {
  const result = resolveProductRef("https://www.bigbasket.com/pd/999/x/", "bigbasket");
  assert.equal(result.ok, true);
});

test("non-https URLs are refused even on the right host", () => {
  assert.equal(resolveProductRef("http://www.bigbasket.com/pd/150502/x/", "bigbasket").ok, false);
  assert.equal(resolveProductRef("javascript:alert(1)//bigbasket.com", "bigbasket").ok, false);
});

// ---------------------------------------------------------------------------------------------
// canAddToCart — what the UI uses to disable Proceed with a real reason.
// ---------------------------------------------------------------------------------------------

test("canAddToCart: an Anakin bigbasket result (no id, real URL) is addable via the URL's id", () => {
  const result = canAddToCart("bigbasket", "", BIGBASKET_URL);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.arg, "150502");
});

test("canAddToCart: an Anakin zepto result (no id, real URL) is addable", () => {
  assert.equal(canAddToCart("zepto", "", ZEPTO_URL).ok, true);
});

test("canAddToCart: a webcmd blinkit result (real id, no URL) is addable", () => {
  assert.equal(canAddToCart("blinkit", "512345", undefined).ok, true);
});

test("canAddToCart: a result with neither a usable id nor URL is refused with a reason", () => {
  const result = canAddToCart("zepto", "", undefined);
  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.message.length > 0);
});

test("isAddToCartMerchant rejects anything outside the three real merchants", () => {
  assert.equal(isAddToCartMerchant("blinkit"), true);
  assert.equal(isAddToCartMerchant("zepto"), true);
  assert.equal(isAddToCartMerchant("bigbasket"), true);
  assert.equal(isAddToCartMerchant("district"), false);
  assert.equal(isAddToCartMerchant(undefined), false);
});
