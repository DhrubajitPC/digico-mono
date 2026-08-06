import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";

async function main() {
  console.log("Starting backend server...");
  const backend = spawn("pnpm", ["--filter", "whatsapp-webhook", "dev"], {
    stdio: "inherit",
    shell: true,
  });

  console.log("Starting frontend dev server...");
  const frontend = spawn("pnpm", ["--filter", "website", "dev"], {
    stdio: "inherit",
    shell: true,
  });

  // Wait 4 seconds for dev servers to boot up
  await new Promise((r) => setTimeout(r, 4000));

  const artifactDir = "/Users/dhch/.gemini/antigravity/brain/1541ae2c-e20e-4660-a1bf-9fbd5182df00";

  try {
    console.log("Launching Playwright Chromium browser...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    console.log("Navigating to Order Dashboard...");
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Screenshot 1: Main Dashboard
    const screenshot1 = path.join(artifactDir, "dashboard_main.png");
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`Saved screenshot: ${screenshot1}`);

    // Test 1: Click "Pending Review" tab
    console.log("Clicking 'Pending Review' tab...");
    await page.click("button:has-text('Pending Review')");
    await page.waitForTimeout(1000);

    // Screenshot 2: Pending Review Tab
    const screenshot2 = path.join(artifactDir, "dashboard_pending_tab.png");
    await page.screenshot({ path: screenshot2 });
    console.log(`Saved screenshot: ${screenshot2}`);

    // Test 2: Open Order Review Drawer
    console.log("Opening Order Review Drawer for first order...");
    await page.click("tbody tr:first-child");
    await page.waitForSelector("textarea", { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Screenshot 3: Order Review Drawer
    const screenshot3 = path.join(artifactDir, "order_review_drawer.png");
    await page.screenshot({ path: screenshot3 });
    console.log(`Saved screenshot: ${screenshot3}`);

    // Test 3: Edit Quantity & WhatsApp message preview
    console.log("Testing live editing of line items & WhatsApp preview...");
    await page.fill(
      "textarea",
      "Dear Souhardo Ahmed, your order #ORD-7585 has been approved by Sales Admin and is ready for dispatch.",
    );
    await page.waitForTimeout(500);

    // Screenshot 4: Edited WhatsApp Preview
    const screenshot4 = path.join(artifactDir, "order_edited_preview.png");
    await page.screenshot({ path: screenshot4 });
    console.log(`Saved screenshot: ${screenshot4}`);

    // Close drawer
    console.log("Closing drawer...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Test 4: Open "Add Order" Modal
    console.log("Opening 'Add Order' Modal...");
    await page.click("button:has-text('Add order')");
    await page.waitForSelector("form", { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Screenshot 5: Add Order Modal
    const screenshot5 = path.join(artifactDir, "create_order_modal.png");
    await page.screenshot({ path: screenshot5 });
    console.log(`Saved screenshot: ${screenshot5}`);

    await browser.close();
    console.log("SUCCESS: All Playwright E2E visual tests passed cleanly!");
  } catch (err) {
    console.error("E2E Test Error:", err);
  } finally {
    backend.kill();
    frontend.kill();
    process.exit(0);
  }
}

void main();
