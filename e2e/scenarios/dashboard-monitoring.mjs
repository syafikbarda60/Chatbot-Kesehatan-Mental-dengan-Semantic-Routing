// E2E journey: an admin route keeps its session and renders its own screen.
// Signing in twice per journey is deliberate — a fresh browser session per journey means
// no journey inherits a login from another, which is what makes a failure meaningful.
// ponytail: the URL and the seeded dev account are hardcoded because a betterwright
// snippet has no process.env; add env plumbing when a second environment exists.
const DASHBOARD = 'http://localhost:3000';

await page.goto(`${DASHBOARD}/login`);
await page.getByLabel('Email', { exact: true }).waitFor();
await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
await page.getByLabel('Kata sandi', { exact: true }).fill('admin1234');
await page.getByRole('button', { name: 'Masuk' }).click();
await page.waitForURL('**/overview', { timeout: 20_000 });

await page.goto(`${DASHBOARD}/monitoring`);
await page.locator('h1').first().waitFor({ timeout: 20_000 });

const url = page.url();
const heading = await page.locator('h1').first().innerText();
if (!url.endsWith('/monitoring')) throw new Error(`redirected away from /monitoring: ${url}`);
if (!heading.trim()) throw new Error('monitoring rendered without a heading');

return { url, heading };
