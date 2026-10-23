import { test, expect } from "@playwright/test";
async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore customer demo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Alex", exact: true }),
  ).toBeVisible();
}
test("a customer basket reaches a verified delivery through all roles", async ({
  page,
}) => {
  await enterDemo(page);
  await page
    .getByRole("button", { name: "Add Apple 1 kg to cart", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Your cart, 1 item", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Continue to checkout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use fictional demo address", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to payment", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Promo code", exact: true })
    .fill("FRESH10");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("FRESH10 applied")).toBeVisible();
  await page
    .getByRole("button", { name: "Review your order", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Place your order", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders\/[\da-f-]+/);
  const orderURL = page.url(),
    otp = (await page.locator(".delivery-code").innerText()).trim();
  await expect(page.locator(".tracking-heading")).toContainText(
    "getting your basket ready",
  );
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Store management", exact: true })
    .getByRole("link", { name: "Orders", exact: true })
    .click();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm order", exact: true })
    .click();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark as packed", exact: true })
    .click();
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await page
    .getByRole("button", { name: "Accept & start delivery", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Send a fictional demo location",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Customer’s delivery code", exact: true })
    .fill("000000");
  await page
    .getByRole("button", { name: "Confirm delivery", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "delivery code is incorrect",
  );
  await page
    .getByRole("textbox", { name: "Customer’s delivery code", exact: true })
    .fill(otp);
  await page
    .getByRole("button", { name: "Confirm delivery", exact: true })
    .click();
  await expect(page.getByText("Delivered with care.")).toBeVisible();
  await page.getByRole("button", { name: "Shop", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(orderURL);
  await expect(
    page.getByRole("heading", {
      name: "A little goodness, delivered.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".order-card")).toContainText("Paid");
  await expect(page.locator(".map-label")).toContainText("Partner location");
});
test("catalog search, empty results and basket persistence", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search groceries", exact: true })
    .fill("apple");
  await page
    .getByRole("textbox", { name: "Search groceries", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Apple 1 kg", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add Apple 1 kg to cart", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Your cart, 1 item", exact: true }),
  ).toBeVisible();
  await page.goto("/products?q=not-a-real-product");
  await expect(
    page.getByRole("heading", {
      name: "No fresh finds just yet.",
      exact: true,
    }),
  ).toBeVisible();
});
for (const width of [375, 768, 1440])
  test(`responsive storefront has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little fresher.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
