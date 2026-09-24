const { chromium, devices } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\268f6d46-8aa8-42ad-a5f3-5f24435ec084';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log("Starting Mobile Responsive Check...");
  // Use a mobile device profile (iPhone 12)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  
  try {
    // 1. Home / Login Page
    console.log("Checking Login Page...");
    await page.goto('https://saloon-website-ashen.vercel.app/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_1_login.png') });
    
    // Login Customer
    await page.click('text="Sign in with email"');
    await delay(1000);
    await page.fill('input[type="email"]', 'customer_test@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
    
    // 2. Customer Home (Salons List)
    console.log("Checking Customer Home...");
    if (!page.url().includes('/salons') && page.url() !== 'https://saloon-website-ashen.vercel.app/') {
      await page.goto('https://saloon-website-ashen.vercel.app/salons');
    }
    await page.waitForLoadState('networkidle');
    await delay(2000); // Wait for API
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_2_home_salons.png') });
    
    // 3. Salon Details
    console.log("Checking Salon Details...");
    const salonLink = await page.$('a[href^="/salons/"]');
    if (salonLink) {
      await salonLink.click();
      await page.waitForLoadState('networkidle');
      await delay(2000);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_3_salon_details.png') });
    }
    
    // Logout
    await page.goto('https://saloon-website-ashen.vercel.app/login');
    await context.clearCookies();
    await delay(1000);
    
    // 4. Admin Dashboard
    console.log("Checking Admin Dashboard...");
    await page.click('text="Sign in with email"');
    await delay(1000);
    await page.fill('input[type="email"]', 'owner_test@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
    
    await page.goto('https://saloon-website-ashen.vercel.app/admin');
    await page.waitForLoadState('networkidle');
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_4_admin_dashboard.png') });
    
    // 5. Admin Queue
    console.log("Checking Admin Queue...");
    await page.goto('https://saloon-website-ashen.vercel.app/admin/queue');
    await page.waitForLoadState('networkidle');
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_5_admin_queue.png') });
    
    console.log("✅ Mobile Workflow Check Complete.");
  } catch (error) {
    console.error("Test failed during execution:", error);
  } finally {
    await browser.close();
  }
})();
