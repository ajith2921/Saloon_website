const { chromium } = require('playwright');

async function testRole(browser, email, password, roleName, expectedPathSubstring, expectedText) {
  console.log(`\n--- Testing ${roleName} Workflow ---`);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`Navigating to login page...`);
    await page.goto('https://saloon-website-ashen.vercel.app/login');
    await page.waitForLoadState('networkidle');

    // Click "Sign in with email" if it's visible instead of the actual form
    const emailSignInButton = await page.$('text="Sign in with email"');
    if (emailSignInButton) {
      await emailSignInButton.click();
    }

    console.log(`Logging in as ${email}...`);
    // Assuming standard input types or placeholders. 
    // We will look for inputs by type since placeholders might change.
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    // Find the submit button and click it
    // Often it's a button of type submit or has text "Sign In" / "Login"
    await page.click('button[type="submit"]');

    console.log(`Waiting for login to complete...`);
    // Wait for the URL to change from /login OR for the network to settle
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
    
    // Admins currently land on the customer homepage (/) and must manually navigate.
    // So we manually navigate them to their expected dashboard to verify access.
    if (expectedPathSubstring !== '/salons') {
      console.log(`Navigating to dashboard: ${expectedPathSubstring}`);
      await page.goto('https://saloon-website-ashen.vercel.app' + expectedPathSubstring);
      await page.waitForLoadState('networkidle');
    }

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes(expectedPathSubstring)) {
      console.log(`✅ SUCCESS: Role ${roleName} successfully accessed: ${expectedPathSubstring}`);
    } else {
      console.log(`❌ FAILURE: Role ${roleName} is at ${currentUrl}, expected ${expectedPathSubstring}`);
    }

    // Check for expected text on the page
    await page.waitForLoadState('networkidle');
    const pageText = await page.textContent('body');
    if (pageText && pageText.includes(expectedText)) {
      console.log(`✅ SUCCESS: Found expected text: "${expectedText}"`);
    } else {
      console.log(`❌ FAILURE: Could not find expected text: "${expectedText}"`);
    }

  } catch (error) {
    console.error(`❌ ERROR testing ${roleName}:`, error.message);
    // Take a screenshot of the failure for debugging
    await page.screenshot({ path: `error_${roleName}.png` });
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("Starting full workflow tests on Vercel production...");
  const browser = await chromium.launch({ headless: true });

  await testRole(
    browser, 
    'customer_test@test.com', 
    'Password123!', 
    'Customer', 
    '/salons', 
    'Find a Salon' // some text on the customer page
  );

  await testRole(
    browser, 
    'owner_test@test.com', 
    'Password123!', 
    'Admin (Salon Owner)', 
    '/admin', 
    'Queue Management'
  );

  await testRole(
    browser, 
    'super_test@test.com', 
    'Password123!', 
    'Super Admin', 
    '/super-admin', 
    'Platform Revenue' // or Analytics
  );

  await browser.close();
  console.log("\nAll workflow checks complete.");
}

main().catch(console.error);
