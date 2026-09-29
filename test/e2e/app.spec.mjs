import { test, expect } from '@playwright/test';

import { startStaticServer } from '../../tools/serve.mjs';

const SUBJECTS = ['Portrait', 'Group', 'Car', 'Landscape', 'Range'];
const TIERS = ['Pixel-level', 'Critical', 'Standard', 'Custom'];
const SOLVES = ['Aperture', 'Focal length', 'Distance', 'Just check'];
const VERDICT_STATES = ['pass', 'marginal', 'fail', 'error'];

function watchErrors(page) {
  const found = [];
  page.on('console', (message) => {
    if (message.type() === 'error') found.push(message.text());
  });
  page.on('pageerror', (error) => found.push(String(error)));
  return found;
}

async function open(page, theme) {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('tacksharp.theme', value);
      if (!sessionStorage.getItem('tacksharp.test.seeded')) {
        localStorage.removeItem('tacksharp.state');
        sessionStorage.setItem('tacksharp.test.seeded', '1');
      }
    } catch (error) {
      return;
    }
  }, theme);
  await page.goto('/');
  await expect(page.locator('#verdict-headline')).not.toBeEmpty();
}

function pick(page, container, label) {
  return page.locator(`${container} button`, { hasText: new RegExp(`^${label}$`) }).first();
}

test.describe('Tack Sharp', () => {
  test('the theme follows the stored preference', async ({ page }, info) => {
    const theme = info.project.name;
    await open(page, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe(theme === 'light' ? 'rgb(238, 241, 243)' : 'rgb(21, 26, 31)');
  });

  test('every preset, tier, solve mode and view resolves without console errors', async ({ page }, info) => {
    const errors = watchErrors(page);
    await open(page, info.project.name);

    for (const subject of SUBJECTS) {
      await pick(page, '#subject-picker', subject).click();
      for (const tier of TIERS) {
        await pick(page, '#tier-picker', tier).click();
        for (const solve of SOLVES) {
          await pick(page, '#solve-controls', solve).click();
          const state = await page.locator('#verdict').getAttribute('data-state');
          expect(VERDICT_STATES).toContain(state);
          await expect(page.locator('#verdict-headline')).not.toBeEmpty();
        }
      }
      for (const view of ['Close-up', 'Whole scene']) {
        const button = page.locator(`#view-${view === 'Close-up' ? 'closeup' : 'scene'}`);
        if (await button.isEnabled()) await button.click();
      }
    }

    await pick(page, '#subject-picker', 'Portrait').click();
    for (const mode of ['Best point', 'On eyes', 'Manual']) {
      await pick(page, '#solve-controls', mode).click();
      await expect(page.locator('#verdict-headline')).not.toBeEmpty();
    }

    expect(errors).toEqual([]);
  });

  test('the free calculator keeps three locks and never degenerates', async ({ page }, info) => {
    const errors = watchErrors(page);
    await open(page, info.project.name);
    await page.locator('#tab-free').click();
    await expect(page.locator('#free-fields .free-row')).toHaveCount(5);

    const lockedCount = () => page.locator('#free-fields .free-row:not(.computed)').count();
    expect(await lockedCount()).toBe(3);

    const stepUp = async (label) => {
      const row = page.locator('#free-fields .free-row', { hasText: label }).first();
      await row.locator('.stepper button').nth(1).click();
    };

    for (const label of ['Near limit', 'Far limit', 'Focus distance', 'Near limit', 'Aperture']) {
      await stepUp(label);
      expect(await lockedCount()).toBe(3);
      const degenerate = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#free-fields .free-row')];
        const locked = rows
          .filter((row) => !row.classList.contains('computed'))
          .map((row) => row.querySelector('.free-label').textContent);
        return ['Focus distance', 'Near limit', 'Far limit'].every((name) => locked.includes(name));
      });
      expect(degenerate).toBe(false);
    }

    await page.locator('#free-fields .free-row', { hasText: 'Far limit' }).locator('.chip').click();
    await expect(page.locator('#free-fields .free-row', { hasText: 'Far limit' }).locator('input')).toHaveValue('∞');

    expect(errors).toEqual([]);
  });

  test('settings survive a reload', async ({ page }, info) => {
    await open(page, info.project.name);
    await pick(page, '#subject-picker', 'Car').click();
    await pick(page, '#tier-picker', 'Standard').click();
    await page.locator('#units-chip').click();
    await expect(page.locator('#units-chip')).toHaveText('m');

    await page.reload();
    await expect(page.locator('#units-chip')).toHaveText('m');
    await expect(pick(page, '#subject-picker', 'Car')).toHaveAttribute('aria-pressed', 'true');
    await expect(pick(page, '#tier-picker', 'Standard')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the app launches with the origin server gone', async ({ browser }, info) => {
    const server = await startStaticServer();
    const context = await browser.newContext({
      serviceWorkers: 'allow',
      viewport: { width: 412, height: 915 },
      colorScheme: info.project.name,
    });
    const page = await context.newPage();
    const errors = watchErrors(page);

    await page.goto(server.origin);
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            if (!navigator.serviceWorker.controller) return 0;
            const keys = await caches.keys();
            if (!keys.length) return 0;
            return (await caches.open(keys[0])).keys().then((entries) => entries.length);
          }),
        { timeout: 20000, message: 'the service worker never took control with a full cache' },
      )
      .toBeGreaterThan(20);

    await server.close();

    await page.reload();
    await expect(page.locator('h1')).toHaveText('Tack Sharp');
    await expect(page.locator('#verdict-headline')).not.toBeEmpty();
    expect(await page.evaluate(() => document.fonts.check('16px Barlow'))).toBe(true);
    expect(await page.evaluate(() => Boolean(document.getElementById('stage-canvas').getContext('2d')))).toBe(true);
    expect(errors).toEqual([]);

    await context.close();
  });

  test('key states are captured for review', async ({ page }, info) => {
    const theme = info.project.name;
    await open(page, theme);

    const shots = [
      ['portrait-marginal', async () => {}],
      [
        'landscape-stack',
        async () => {
          await pick(page, '#subject-picker', 'Landscape').click();
          await pick(page, '#tier-picker', 'Critical').click();
        },
      ],
      [
        'car-standard',
        async () => {
          await pick(page, '#subject-picker', 'Car').click();
          await pick(page, '#tier-picker', 'Standard').click();
        },
      ],
      [
        'group-closeup',
        async () => {
          await pick(page, '#subject-picker', 'Group').click();
          await page.locator('#view-closeup').click();
        },
      ],
      [
        'free-calculator',
        async () => {
          await page.locator('#tab-free').click();
        },
      ],
    ];

    for (const [name, prepare] of shots) {
      await prepare();
      await page.waitForTimeout(120);
      await page.screenshot({ path: `test-results/${theme}-${name}.png`, fullPage: false });
    }
  });

  test('the diagram scrub reports a distance and a blur', async ({ page }, info) => {
    await open(page, info.project.name);
    const canvas = page.locator('#stage-canvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.8);
    const scrub = page.locator('#stage-scrub');
    await expect(scrub).toBeVisible();
    await expect(scrub).toContainText('µm');
    await page.mouse.up();
    await expect(scrub).toBeHidden();
  });

  test('controls are at least 38 pixels tall and the page does not scroll sideways', async ({ page }, info) => {
    await open(page, info.project.name);
    const short = await page.evaluate(() => {
      const selectors = ['.stepper button', '.stepper input', '.segmented button', '.select'];
      const bad = [];
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          if (node.closest('[hidden]') || !node.getClientRects().length) continue;
          if (node.getBoundingClientRect().height < 37.5) bad.push(`${selector}: ${node.getBoundingClientRect().height}`);
        }
      }
      return bad;
    });
    expect(short).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
