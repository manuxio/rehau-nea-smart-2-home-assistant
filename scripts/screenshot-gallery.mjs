// One-shot README gallery generator.
//
// Drives Playwright through the running dev SPA (http://127.0.0.1:5173)
// and the bridge dev server (http://127.0.0.1:8080), capturing each
// screen at iPhone-Pro dimensions, then composes each capture inside a
// CSS-drawn phone frame using sharp.
//
// Output: docs/screenshots/phone-NN-name.png
//
// Run with both dev servers up:
//   node scripts/screenshot-gallery.mjs
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "http://127.0.0.1:5173";
const USER = "rehau";
const PASS = "admin123";

// iPhone-15-Pro-ish screen dimensions in CSS px.
const SCREEN_W = 390;
const SCREEN_H = 844;
// Bezel thickness; outer phone size = SCREEN + 2*BEZEL.
const BEZEL = 14;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;
const SCREEN_RADIUS = 42;
const PHONE_RADIUS = 56;
// Subtle camera-pill at the very top of the screen — small enough that
// it doesn't bleed into the SPA's page title even on short-title screens
// like "Programs" / "Messages".
const ISLAND_W = 76;
const ISLAND_H = 18;
const ISLAND_TOP = 4;
// Final canvas: a bit of bg padding around the phone for shadow.
const PAD = 36;
const CANVAS_W = PHONE_W + PAD * 2;
const CANVAS_H = PHONE_H + PAD * 2;

const screens = [
  {
    file: "00-login.png",
    title: "Login",
    description: "JWT-bearer auth, local-only — no e-mail, no cloud, no 2FA. Behind Home Assistant's ingress the form is skipped entirely: the bridge reads HA's `X-Ingress-Path` header and hands the SPA a token straight through.",
    needsAuth: false,
    setup: async (page) => {
      // Fresh context, no session — SPA will render the Login form.
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const userInput = page.locator('input[type="text"]').first();
      if (await userInput.count() > 0) {
        await userInput.fill("rehau");
        await page.locator('input[type="password"]').first().fill("••••••••");
      }
      await page.waitForTimeout(200);
    },
  },
  {
    file: "01-home.png",
    title: "Dashboard",
    description: "Per-room cards grouped by floor, with quick-apply scene tiles up top. Each card shows current temperature, mode, and a tap-to-open setpoint preview.",
    setup: async (page) => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1800);
    },
  },
  {
    file: "02-room-detail.png",
    title: "Room — Mode + Setpoint",
    description: "Mode chooser (Standby / Normal / Reduced / Program) precedes the big setpoint dial. Optimistic writes mean the new target shows instantly while the REHAU base station catches up.",
    setup: async (page) => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      const card = page.locator('button, [role="button"]').filter({ hasText: /^[A-Z]/ }).first();
      // Try clicking the first room card on the dashboard.
      const roomLink = page.locator('a[href*="#/room/"], [data-room-id]').first();
      if (await roomLink.count() > 0) {
        await roomLink.click();
      } else {
        // Fallback: pull the first room id from the API and navigate.
        const id = await page.evaluate(async () => {
          const s = JSON.parse(localStorage.getItem("rehau.session") || "{}");
          const r = await fetch("/api/v1/rooms", { headers: { Authorization: `Bearer ${s.token}` } });
          const list = await r.json();
          return list?.[0]?.id;
        });
        if (id) await page.goto(`${BASE}/#/room/${encodeURIComponent(id)}`);
      }
      await page.waitForTimeout(2000);
    },
  },
  {
    file: "03-system.png",
    title: "System",
    description: "Theme, language, body-text size slider, and account controls live in one place. Below: REHAU device version, fetch telemetry, and an explicit force-refresh button.",
    setup: async (page) => {
      await page.goto(`${BASE}/#/system`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
    },
  },
  {
    file: "04-floors.png",
    title: "Floors editor",
    description: "Assign each room to a floor name. The Dashboard automatically groups rooms by floor (alphabetic), with anything unassigned dropping into a single bottom group.",
    setup: async (page) => {
      await page.goto(`${BASE}/#/system`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      // Scroll System down to reveal the Floors editor.
      await page.evaluate(() => {
        const el = document.querySelector("#root");
        const heading = Array.from(document.querySelectorAll("h2, h3, [class*='SectionHead']"))
          .find((n) => /floor|piano/i.test(n.textContent || ""));
        if (heading && el) {
          const r = heading.getBoundingClientRect();
          el.scrollTop += r.top - 60;
        }
      });
      await page.waitForTimeout(400);
    },
  },
  {
    file: "05-scenes-editor.png",
    title: "Scenes — global mode + setpoint",
    description: "A scene picks a mode (and, for Normal / Reduced, a target setpoint) plus an icon. One tap from the Dashboard fires every targeted room through the bridge's optimistic-write path.",
    setup: async (page) => {
      await page.goto(`${BASE}/#/system`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      // Manually scroll to where the Scenes card sits before looking
      // for the button — scrollIntoViewIfNeeded can hang if the element
      // is in a slow-mounting subtree.
      await page.evaluate(() => {
        const root = document.getElementById("root");
        if (root) root.scrollTop = 1100;
      });
      await page.waitForTimeout(400);
      const addBtn = page.locator('button:has-text("Add scene"), button:has-text("Aggiungi scena")').first();
      await addBtn.waitFor({ state: "visible", timeout: 10000 });
      await addBtn.click();
      await page.waitForTimeout(600);
      // Fill the name so the form looks intentional.
      const nameInput = page.locator('input[placeholder*="Evening" i], input[placeholder*="Sera" i]').first();
      if (await nameInput.count() > 0) await nameInput.fill("Evening");
      // Make sure mode is Normal (Stepper only appears for normal/reduced).
      const normalBtn = page.locator('button:has-text("Normal"), button:has-text("Normale")').first();
      if (await normalBtn.count() > 0) await normalBtn.click();
      await page.waitForTimeout(300);
      // Scroll the editor form to the top of the viewport.
      await page.evaluate(() => {
        const root = document.getElementById("root");
        const form = Array.from(document.querySelectorAll("input")).find(
          (i) => /Evening|Sera/i.test(i.placeholder || ""),
        );
        if (root && form) {
          const r = form.getBoundingClientRect();
          root.scrollTop += r.top - 120;
        }
      });
      await page.waitForTimeout(200);
    },
  },
  {
    file: "06-scenes-perroom.png",
    title: "Scenes — per-room control",
    description: "Switch the scope toggle to Per-room and pick a different mode (and setpoint) for each room — or leave rooms on Skip to keep them untouched.",
    setup: async (page) => {
      // Hard reload so the previous screenshot's open form doesn't
      // shadow the "Add scene" button we need.
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.goto(`${BASE}/#/system`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      await page.evaluate(() => {
        const root = document.getElementById("root");
        if (root) root.scrollTop = 1100;
      });
      await page.waitForTimeout(400);
      const addBtn = page.locator('button:has-text("Add scene"), button:has-text("Aggiungi scena")').first();
      await addBtn.waitFor({ state: "visible", timeout: 10000 });
      await addBtn.click();
      await page.waitForTimeout(500);
      const perRoomBtn = page.locator('button:has-text("Per room"), button:has-text("Per stanza")').first();
      if (await perRoomBtn.count() > 0) await perRoomBtn.click();
      await page.waitForTimeout(400);
      // Scroll the form so the per-room list is the dominant content.
      await page.evaluate(() => {
        const root = document.getElementById("root");
        const list = Array.from(document.querySelectorAll("select")).find(
          (s) => Array.from(s.options).some((o) => /skip|salta/i.test(o.text)),
        );
        if (root && list) {
          const r = list.getBoundingClientRect();
          root.scrollTop += r.top - 180;
        }
      });
      await page.waitForTimeout(200);
    },
  },
  {
    file: "07-programs.png",
    title: "Programs",
    description: "Five weekly programs × ten daily slots, mirrored straight from the device. Edit a slot inline; the bridge writes the whole form (REHAU's all-or-nothing semantics) in one round trip.",
    setup: async (page) => {
      await page.goto(`${BASE}/#/programs`, { waitUntil: "networkidle" });
      await waitForLoaded(page, 30000);
      await page.waitForTimeout(500);
    },
  },
  {
    file: "08-messages.png",
    title: "Messages",
    description: "The REHAU device's notification log, with a one-tap clear-all. Each entry shows when it fired and an explicit acknowledged state.",
    setup: async (page) => {
      await page.goto(`${BASE}/#/messages`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
    },
  },
  {
    file: "09-installer.png",
    title: "Installer — icon tabs",
    description: "Restricted-access section for installer-code users. Six subtabs (Curve, Calibration, Bus, I/O, Diagnostics, Advanced) sit behind a horizontally-scrolling icon strip.",
    setup: async (page) => {
      await page.goto(`${BASE}/#/installer`, { waitUntil: "networkidle" });
      // Installer subtab hits the REHAU installer-login dance which
      // takes a few round trips. Wait until the "loading…" placeholder
      // is gone or 45s elapses (REHAU is slow on cold-cache reads).
      await waitForLoaded(page, 45000);
      await page.waitForTimeout(500);
    },
  },
];

const phoneFrameSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${PHONE_W}" height="${PHONE_H}" viewBox="0 0 ${PHONE_W} ${PHONE_H}">
  <defs>
    <linearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1c1e"/>
      <stop offset="100%" stop-color="#0a0a0c"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${PHONE_W}" height="${PHONE_H}" rx="${PHONE_RADIUS}" ry="${PHONE_RADIUS}" fill="url(#bezel)"/>
  <rect x="1" y="1" width="${PHONE_W - 2}" height="${PHONE_H - 2}" rx="${PHONE_RADIUS - 1}" ry="${PHONE_RADIUS - 1}" fill="none" stroke="#3a3a3c" stroke-width="1"/>
</svg>`;

// Dynamic-island pill — drawn last on top of everything.
const islandSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ISLAND_W}" height="${ISLAND_H}">
  <rect x="0" y="0" width="${ISLAND_W}" height="${ISLAND_H}" rx="${ISLAND_H / 2}" ry="${ISLAND_H / 2}" fill="#000"/>
</svg>`;

// Soft drop-shadow + violet gradient backdrop.
const backdropSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3a2454"/>
      <stop offset="60%" stop-color="#1a1024"/>
      <stop offset="100%" stop-color="#0a0612"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
</svg>`;

const roundedScreenMaskSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}">
  <rect x="0" y="0" width="${SCREEN_W}" height="${SCREEN_H}" rx="${SCREEN_RADIUS}" ry="${SCREEN_RADIUS}" fill="#fff"/>
</svg>`;

/**
 * Wait until every "loading…" / "caricamento…" placeholder is gone OR
 * `timeoutMs` elapses (whichever first). Better than a fixed sleep for
 * REHAU-backed views — the device can be cold and take 20-40s before
 * data lands.
 */
async function waitForLoaded(page, timeoutMs) {
  try {
    await page.waitForFunction(
      () => {
        const t = document.body.innerText.toLowerCase();
        return !/loading…|caricamento…/.test(t);
      },
      { timeout: timeoutMs, polling: 500 },
    );
  } catch {
    // best-effort: if still loading after the budget, screenshot what we have
  }
}

async function frameScreenshot(rawScreenshot, outPath) {
  // 1. Mask the screen content with the rounded-corner mask.
  const screenRounded = await sharp(rawScreenshot)
    .resize(SCREEN_W, SCREEN_H, { fit: "cover" })
    .composite([{ input: Buffer.from(roundedScreenMaskSvg), blend: "dest-in" }])
    .png()
    .toBuffer();

  // 2. Phone body + screen + island.
  const phone = await sharp(Buffer.from(phoneFrameSvg))
    .composite([
      { input: screenRounded, left: BEZEL, top: BEZEL },
      { input: Buffer.from(islandSvg), left: Math.round((PHONE_W - ISLAND_W) / 2), top: BEZEL + ISLAND_TOP },
    ])
    .png()
    .toBuffer();

  // 3. Place the phone on the gradient backdrop.
  await sharp(Buffer.from(backdropSvg))
    .composite([{ input: phone, left: PAD, top: PAD }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  await mkdir("docs/screenshots/phone", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: SCREEN_W, height: SCREEN_H },
    deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Screenshot",
  });
  const page = await ctx.newPage();

  // Hit the bridge directly for a JWT, then drop it into localStorage
  // BEFORE the SPA loads. Same-origin, so the SPA picks it up on boot
  // and skips the Login screen entirely. Far more robust than driving
  // the form with Playwright (the SPA's `Field` is a controlled input
  // whose default value is "admin", which made `fill()` racey).
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!loginRes.ok) throw new Error(`login failed ${loginRes.status}`);
  const { token, expiresAt, role } = await loginRes.json();
  await ctx.addInitScript(
    ({ token, expiresAt, role, user }) => {
      localStorage.setItem(
        "rehau.session",
        JSON.stringify({ token, expiresAt, role, username: user }),
      );
    },
    { token, expiresAt, role, user: USER },
  );

  // Pre-warm the slow REHAU-backed endpoints so the installer / programs
  // screens have data ready by the time Playwright navigates there. The
  // bridge holds responses in-memory once read, so subsequent SPA
  // requests resolve instantly off the cache.
  process.stdout.write("⏳ pre-warming REHAU-backed endpoints… ");
  const auth = { Authorization: `Bearer ${token}` };
  const prewarmUrls = [
    "/api/v1/installer/calibration",
    "/api/v1/installer/curve",
    "/api/v1/installer/diagnostics/topology",
    "/api/v1/installer/io",
    "/api/v1/programs/daily/1",
    "/api/v1/programs/weekly/1",
  ];
  await Promise.all(
    prewarmUrls.map((u) =>
      fetch(`${BASE}${u}`, { headers: auth }).catch(() => {}),
    ),
  );
  process.stdout.write("done\n");

  // Second context for the Login shot — no auth init-script, so the
  // SPA actually renders the form instead of bypassing it.
  const loginCtx = await browser.newContext({
    viewport: { width: SCREEN_W, height: SCREEN_H },
    deviceScaleFactor: 2,
  });
  const loginPage = await loginCtx.newPage();

  const captured = [];
  for (const s of screens) {
    process.stdout.write(`📸 ${s.file}… `);
    const targetPage = s.needsAuth === false ? loginPage : page;
    await s.setup(targetPage);
    // Hide the connection-state banner so transient REHAU blips don't
    // bleed into every screenshot. The banner is its own feature; we
    // showcase it intentionally on one dedicated shot.
    await targetPage.evaluate(() => {
      document.querySelectorAll('[data-conn-banner]').forEach((n) => n.remove());
      Array.from(document.querySelectorAll("div")).forEach((n) => {
        if (/REHAU connection (unstable|down)/i.test(n.textContent || "") && n.children.length < 6) {
          n.style.display = "none";
        }
      });
    });
    await targetPage.waitForTimeout(150);
    const raw = await targetPage.screenshot({ type: "png" });
    const out = `docs/screenshots/phone/${s.file}`;
    await frameScreenshot(raw, out);
    captured.push({ ...s, out });
    process.stdout.write("ok\n");
  }

  await browser.close();

  // Emit a markdown snippet the user can paste straight into README.
  const md = [
    "## Screenshots",
    "",
    "All shots taken from the bundled SPA running against a real REHAU Nea Smart 2.0 base station on the LAN — no mocks.",
    "",
  ];
  for (const c of captured) {
    md.push(`### ${c.title}`);
    md.push("");
    md.push(`![${c.title}](docs/screenshots/phone/${c.file})`);
    md.push("");
    md.push(c.description);
    md.push("");
  }
  await writeFile("docs/screenshots/phone/README-snippet.md", md.join("\n"));
  console.log("\nMarkdown snippet written to docs/screenshots/phone/README-snippet.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
