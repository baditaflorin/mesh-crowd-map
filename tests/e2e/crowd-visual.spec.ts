import { expect, test, type Page } from "@playwright/test";

async function closeInitiallyOpenSettings(page: Page): Promise<void> {
  const settings = page.getByRole("dialog", { name: "Settings" });
  if (!(await settings.isVisible().catch(() => false))) return;
  const close = settings.getByRole("button", { name: "close" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(settings).toBeHidden();
}

test("first view makes the real coarse board and a clear next action visible", async ({ page }) => {
  await page.goto("./");
  await closeInitiallyOpenSettings(page);

  const shell = page.locator("[data-mesh-app-shell]");
  await expect(shell).toHaveAttribute("data-mesh-visual-profile", "field");
  await expect(shell).toHaveAttribute("data-mesh-shell-layout", "inset");
  await expect(page.getByRole("heading", { name: "See the room, not the people." })).toBeVisible();

  const board = page.getByRole("region", { name: "Broad areas, not locations." });
  await expect(board).toBeVisible();
  await expect(board.getByRole("button")).toHaveCount(9);
  await expect(page.getByRole("button", { name: "Add an observation" })).toBeVisible();

  const viewport = page.viewportSize();
  const boardBox = await board.boundingBox();
  expect(viewport).not.toBeNull();
  expect(boardBox).not.toBeNull();
  expect(boardBox?.y).toBeLessThan(viewport?.height ?? 0);
  expect((boardBox?.y ?? 0) + (boardBox?.height ?? 0)).toBeGreaterThan(0);
});

test("mobile first view stays within the viewport and the entry action reaches the composer", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(baseURL ?? "./");
    await closeInitiallyOpenSettings(page);

    const board = page.getByRole("region", { name: "Broad areas, not locations." });
    await expect(board).toBeVisible();
    await expect(page.getByRole("button", { name: "Add an observation" })).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);

    await page.getByRole("button", { name: "Add an observation" }).click();
    await expect(page.getByLabel("What did you notice?")).toBeFocused();
  } finally {
    await context.close();
  }
});
