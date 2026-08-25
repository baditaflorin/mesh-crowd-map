import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";

test("a coarse observation reaches another peer's accessible list", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", {
    storagePrefix: "mesh-crowd-map",
  });

  try {
    await a.getByLabel("Your display name").fill("Ari");
    await b.getByLabel("Your display name").fill("Bea");
    await a.getByLabel("What did you notice?").fill("Short queue at registration");
    await a.getByLabel("Optional context").fill("About five minutes.");
    await a.getByRole("combobox", { name: "Broad area" }).selectOption("north");
    await a.getByRole("button", { name: "Share for one hour" }).click();

    await expect(b.getByText("Short queue at registration", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      b
        .getByRole("region", { name: "Broad areas, not locations." })
        .getByRole("button", { name: /North, 1 note/i }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await cleanup();
  }
});
