import { expect, test } from "@playwright/test";

test("separate browser contexts do not share carts, drafts or cookies", async ({ browser, baseURL }) => {
  const first = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const second = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const firstPage = await first.newPage();
    const secondPage = await second.newPage();
    await firstPage.goto("/cart");
    await expect.poll(() => firstPage.evaluate(() => localStorage.getItem("peppermint-audio-cart"))).toBe("[]");
    await firstPage.evaluate(() => {
      localStorage.setItem("peppermint-audio-cart", JSON.stringify([{
        id: "equipment:isolation-check", name: "Disposable isolation item",
        kind: "equipment", price: 1, quantity: 1,
      }]));
      localStorage.setItem("peppermint-audio-booking-draft", "disposable-isolation-check");
      document.cookie = "isolation-check=first; path=/";
    });
    await secondPage.goto("/cart");
    await expect.poll(() => secondPage.evaluate(() => localStorage.getItem("peppermint-audio-cart"))).toBe("[]");
    expect(await secondPage.evaluate(() => ({
      cart: localStorage.getItem("peppermint-audio-cart"),
      draft: localStorage.getItem("peppermint-audio-booking-draft"),
      cookie: document.cookie.includes("isolation-check"),
    }))).toEqual({ cart: "[]", draft: null, cookie: false });
    expect(await firstPage.evaluate(() => document.cookie.includes("isolation-check"))).toBe(true);
  } finally {
    await first.close();
    await second.close();
  }
});
