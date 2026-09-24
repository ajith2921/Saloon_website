const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\268f6d46-8aa8-42ad-a5f3-5f24435ec084';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log("Starting full E2E workflow simulation...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  try {
    // -------------------------------------------------------------
    // STEP 1: CUSTOMER WORKFLOW
    // -------------------------------------------------------------
    console.log("--- Customer Workflow: Getting a Token ---");
    await page.goto('https://saloon-website-ashen.vercel.app/login');
    await page.waitForLoadState('networkidle');
    
    // Login Customer
    await page.click('text="Sign in with email"');
    await page.fill('input[type="email"]', 'customer_test@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
    console.log("Customer logged in.");
    
    // Make sure we are on the salons page
    if (!page.url().includes('/salons') && page.url() !== 'https://saloon-website-ashen.vercel.app/') {
      await page.goto('https://saloon-website-ashen.vercel.app/salons');
    }
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_1_customer_home.png') });
    
    // Look for a salon card and click it. 
    // Usually wrapped in an 'a' tag linking to /salons/:id
    const salonLink = await page.$('a[href^="/salons/"]');
    if (salonLink) {
      console.log("Found a salon, clicking...");
      await salonLink.click();
      await page.waitForLoadState('networkidle');
      await delay(2000); // let API settle
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_2_salon_details.png') });
      
      // Look for a "Join Queue" or "Get Token" button
      const joinButton = await page.$('text="Join Queue", text="Get Token", button:has-text("Join")');
      if (joinButton) {
        console.log("Joining queue...");
        await joinButton.click();
        await delay(3000); // Wait for modal or success
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_3_token_created.png') });
      } else {
        console.log("No join queue button found (salon might be closed or doesn't have active queue).");
      }
    } else {
      console.log("No salons found on the customer homepage.");
    }
    
    // Logout Customer
    console.log("Logging out customer...");
    await page.goto('https://saloon-website-ashen.vercel.app/login'); // fallback if no logout button
    await context.clearCookies();
    await delay(1000);

    // -------------------------------------------------------------
    // STEP 2: ADMIN WORKFLOW
    // -------------------------------------------------------------
    console.log("--- Admin Workflow: Managing the Queue ---");
    await page.goto('https://saloon-website-ashen.vercel.app/login');
    await page.waitForLoadState('networkidle');
    
    // Login Admin
    await page.click('text="Sign in with email"');
    await page.fill('input[type="email"]', 'owner_test@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
    console.log("Admin logged in.");
    
    // Navigate to Admin Dashboard manually (due to frontend routing behavior)
    await page.goto('https://saloon-website-ashen.vercel.app/admin');
    await page.waitForLoadState('networkidle');
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_4_admin_dashboard.png') });
    
    // Navigate to Queue Management
    await page.goto('https://saloon-website-ashen.vercel.app/admin/queue');
    await page.waitForLoadState('networkidle');
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_5_admin_queue.png') });
    
    // Logout Admin
    console.log("Logging out admin...");
    await context.clearCookies();
    await delay(1000);

    // -------------------------------------------------------------
    // STEP 3: SUPER ADMIN WORKFLOW
    // -------------------------------------------------------------
    console.log("--- Super Admin Workflow: Checking Stats ---");
    await page.goto('https://saloon-website-ashen.vercel.app/login');
    await page.waitForLoadState('networkidle');
    
    // Login Super Admin
    await page.click('text="Sign in with email"');
    await page.fill('input[type="email"]', 'super_test@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
    console.log("Super Admin logged in.");
    
    // Navigate to Super Admin Dashboard
    await page.goto('https://saloon-website-ashen.vercel.app/super-admin');
    await page.waitForLoadState('networkidle');
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_6_super_admin_dashboard.png') });

    console.log("✅ E2E Full Workflow Test Complete.");
  } catch (error) {
    console.error("Test failed during execution:", error);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_error.png') });
  } finally {
    await browser.close();
  }
})();
