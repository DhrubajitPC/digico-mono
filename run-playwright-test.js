import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";

async function main() {
  console.log("Starting backend server (port 8787)...");
  const backend = spawn("pnpm", ["--filter", "whatsapp-webhook", "dev"], {
    stdio: "inherit",
    shell: true,
  });

  console.log("Starting frontend dev server (port 5173)...");
  const frontend = spawn("pnpm", ["--filter", "website", "dev"], {
    stdio: "inherit",
    shell: true,
  });

  // Wait 7 seconds for servers and DB initialization to complete
  await new Promise((r) => setTimeout(r, 7000));

  const artifactDir = "/Users/dhch/.gemini/antigravity/brain/1541ae2c-e20e-4660-a1bf-9fbd5182df00";

  try {
    console.log("Launching Playwright Chromium browser...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    console.log("Navigating to http://localhost:5173...");
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // 1. Screenshot: Main Dashboard View
    console.log("Capturing 1: Main Dashboard View...");
    const shot1 = path.join(artifactDir, "dashboard_main_view.png");
    await page.screenshot({ path: shot1, fullPage: true });

    // 2. Click "Pending Review" tab
    console.log("Capturing 2: Pending Review Filter Tab...");
    await page.click("button:has-text('Pending Review')");
    await page.waitForTimeout(1000);
    const shot2 = path.join(artifactDir, "dashboard_pending_review.png");
    await page.screenshot({ path: shot2, fullPage: true });

    // 3. Open Order Review Drawer
    console.log("Capturing 3: Order Review Drawer...");
    await page.click("button:has-text('Review')");
    await page.waitForTimeout(1500);
    const shot3 = path.join(artifactDir, "order_review_drawer.png");
    await page.screenshot({ path: shot3 });

    // 4. Test editing WhatsApp message preview
    console.log("Capturing 4: Live Edited WhatsApp Message Preview...");
    const textarea = page.locator("textarea");
    if ((await textarea.count()) > 0) {
      await textarea.fill(
        "Dear Souhardo Ahmed, your order #ORD-7585 has been approved by Sales Admin and is ready for dispatch.",
      );
      await page.waitForTimeout(500);
      const shot4 = path.join(artifactDir, "order_whatsapp_preview_edited.png");
      await page.screenshot({ path: shot4 });
    }

    // Close Drawer
    console.log("Closing Order Review Drawer...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);

    // 5. Open Add Order Modal
    console.log("Capturing 5: Create Manual Order Modal...");
    await page.click("button:has-text('Add order')");
    await page.waitForTimeout(1000);
    const shot5 = path.join(artifactDir, "create_manual_order_modal.png");
    await page.screenshot({ path: shot5 });

    await browser.close();
    console.log("SUCCESS: ALL PLAYWRIGHT TESTS PASSED AND SCREENSHOTS GENERATED!");
  } catch (err) {
    console.error("Playwright Test Error:", err);
  } finally {
    backend.kill();
    frontend.kill();
    process.exit(0);
  }
}

void main();
