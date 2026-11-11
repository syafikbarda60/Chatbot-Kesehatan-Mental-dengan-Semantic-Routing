// E2E journey: an administrator signs in and lands on the overview.
// Credentials are the dev seeds from apps/backend/scripts/seed_dev_users.py.
// ponytail: the URL and the seeded dev account are hardcoded because a betterwright
// snippet has no process.env; add env plumbing when a second environment exists.
const DASHBOARD = 'http://localhost:3000';

await page.goto(`${DASHBOARD}/login`);
await page.getByLabel('Email', { exact: true }).waitFor();

await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
await page.getByLabel('Kata sandi', { exact: true }).fill('admin1234');
await page.getByRole('button', { name: 'Masuk' }).click();

await page.waitForURL('**/overview', { timeout: 20_000 });
const heading = await page.locator('h1').first().innerText();

return { url: page.url(), heading };
