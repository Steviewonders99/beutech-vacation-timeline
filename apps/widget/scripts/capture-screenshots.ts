/**
 * Screenshot capture script for UI review
 * Captures all tabs and views of the vacation timeline widget
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');
const BASE_URL = 'http://localhost:9000';

async function captureScreenshots() {
  // Create screenshots directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
  });
  const page = await context.newPage();

  try {
    console.log('Loading widget...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait for the widget to render
    await page.waitForSelector('.vt-widget', { timeout: 10000 });

    // Give extra time for CSS and animations
    await page.waitForTimeout(1000);

    // 1. Calendar Tab - Week View (default)
    console.log('Capturing Calendar - Week View...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-calendar-week-view.png'),
      fullPage: false,
    });

    // 2. Calendar Tab - Day View
    console.log('Capturing Calendar - Day View...');
    const dayButton = page.locator('button:has-text("Day")').first();
    if (await dayButton.isVisible()) {
      await dayButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-calendar-day-view.png'),
        fullPage: false,
      });
    }

    // 3. Calendar Tab - Month View
    console.log('Capturing Calendar - Month View...');
    const monthButton = page.locator('button:has-text("Month")').first();
    if (await monthButton.isVisible()) {
      await monthButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03-calendar-month-view.png'),
        fullPage: false,
      });
    }

    // 4. My Requests Tab
    console.log('Capturing My Requests Tab...');
    const myRequestsTab = page.locator('button[role="tab"]:has-text("My Requests")');
    if (await myRequestsTab.isVisible()) {
      await myRequestsTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '04-my-requests-tab.png'),
        fullPage: false,
      });
    }

    // 5. Request Time Off Modal
    console.log('Capturing Request Time Off Modal...');
    // Go back to calendar first
    const calendarTab = page.locator('button[role="tab"]:has-text("Calendar")');
    if (await calendarTab.isVisible()) {
      await calendarTab.click();
      await page.waitForTimeout(300);
    }

    const requestButton = page.locator('button:has-text("New Request"), button:has-text("Request Time Off")').first();
    if (await requestButton.isVisible()) {
      await requestButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '05-request-modal.png'),
        fullPage: false,
      });

      // Close modal
      const closeButton = page.locator('.vt-modal__close, button:has-text("Cancel")').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(300);
      }
    }

    // 6. Mobile view (narrow viewport)
    console.log('Capturing Mobile View...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-mobile-view.png'),
      fullPage: false,
    });

    // 7. Tablet view
    console.log('Capturing Tablet View...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '07-tablet-view.png'),
      fullPage: false,
    });

    // 8. Wide desktop view
    console.log('Capturing Wide Desktop View...');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '08-wide-desktop-view.png'),
      fullPage: false,
    });

    console.log(`\n✅ Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('Files:');
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    files.forEach(file => console.log(`  - ${file}`));

  } catch (error) {
    console.error('Error capturing screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
