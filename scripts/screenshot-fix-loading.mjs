// Re-shoot only the screens whose body depends on a live REHAU read
// (Programs daily-slot body, Installer Calibration body). The main
// gallery script is designed for a happy-path device; this companion
// keeps trying until the SPA actually paints data.
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = "http://127.0.0.1:5173";
const USER = "rehau";
const PASS = "admin123";

const SCREEN_W = 390;
const SCREEN_H = 844;
const BEZEL = 14;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;
const SCREEN_RADIUS = 42;
const PHONE_RADIUS = 56;
const ISLAND_W = 76;
const ISLAND_H = 18;
const ISLAND_TOP = 4;
const PAD = 36;
const CANVAS_W = PHONE_W + PAD * 2;
const CANVAS_H = PHONE_H + PAD * 2;

const phoneFrameSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${PHONE_W}" height="${PHONE_H}">
  <defs><linearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#1c1c1e"/><stop offset="100%" stop-color="#0a0a0c"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="${PHONE_W}" height="${PHONE_H}" rx="${PHONE_RADIUS}" ry="${PHONE_RADIUS}" fill="url(#bezel)"/>
  <rect x="1" y="1" width="${PHONE_W - 2}" height="${PHONE_H - 2}" rx="${PHONE_RADIUS - 1}" ry="${PHONE_RADIUS - 1}" fill="none" stroke="#3a3a3c" stroke-width="1"/>
</svg>`;
const islandSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ISLAND_W}" height="${ISLAND_H}">
  <rect x="0" y="0" width="${ISLAND_W}" height="${ISLAND_H}" rx="${ISLAND_H/2}" ry="${ISLAND_H/2}" fill="#000"/>
</svg>`;
const backdropSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#3a2454"/><stop offset="60%" stop-color="#1a1024"/><stop offset="100%" stop-color="#0a0612"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
</svg>`;
const screenMaskSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}">
  <rect x="0" y="0" width="${SCREEN_W}" height="${SCREEN_H}" rx="${SCREEN_RADIUS}" ry="${SCREEN_RADIUS}" fill="#fff"/>
</svg>`;

async function frameAndSave(raw, outPath) {
  const screen = await sharp(raw)
    .resize(SCREEN_W, SCREEN_H, { fit: "cover" })
    .composite([{ input: Buffer.from(screenMaskSvg), blend: "dest-in" }])
    .png().toBuffer();
  const phone = await sharp(Buffer.from(phoneFrameSvg))
    .composite([
      { input: screen, left: BEZEL, top: BEZEL },
      { input: Buffer.from(islandSvg), left: Math.round((PHONE_W - ISLAND_W) / 2), top: BEZEL + ISLAND_TOP },
    ])
    .png().toBuffer();
  await sharp(Buffer.from(backdropSvg))
    .composite([{ input: phone, left: PAD, top: PAD }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function hasLoading(page) {
  return await page.evaluate(() =>
    /loading…|caricamento…/i.test(document.body.innerText || ""),
  );
}

async function waitNoLoading(page, totalMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < totalMs) {
    if (!(await hasLoading(page))) return true;
    await page.waitForTimeout(2000);
  }
  return false;
}

async function shoot(page, name) {
  // Hide the connection banner before each shot.
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("div")).forEach((n) => {
      if (/REHAU connection (unstable|down)/i.test(n.textContent || "") && n.children.length < 6) {
        n.style.display = "none";
      }
    });
  });
  await page.waitForTimeout(200);
  const raw = await page.screenshot({ type: "png" });
  const out = `docs/screenshots/phone/${name}`;
  await frameAndSave(raw, out);
  console.log(`✓ ${out}`);
}

async function main() {
  // Authenticate via API and stash session in context init script.
  const r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!r.ok) throw new Error("login failed");
  const { token, expiresAt, role } = await r.json();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: SCREEN_W, height: SCREEN_H },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(
    ({ token, expiresAt, role, user }) => {
      localStorage.setItem(
        "rehau.session",
        JSON.stringify({ token, expiresAt, role, username: user }),
      );
    },
    { token, expiresAt, role, user: USER },
  );
  const page = await ctx.newPage();

  // Pre-fetch the room list (cached on the bridge, fast) so we can
  // build a calibration response that matches the actual rooms.
  const roomsRes = await fetch(`${BASE}/api/v1/rooms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rooms = await roomsRes.json();

  // Synthesize endpoint responses so the SPA paints real-looking
  // content even when REHAU is slow / failing. The shapes match
  // calibrationStateSchema and DailyProgram in @rehau/types.
  const fakeCalibration = {
    outdoor: 0,
    rooms: rooms.map((r) => ({
      zone: r.zone,
      tempOffset: r.calibrationTemp ?? 0,
      humidityOffset: r.calibrationHumidity ?? 0,
    })),
    meta: { lastUpdatedAt: new Date().toISOString() },
  };

  // Daily program 1: a typical work-week shape — off overnight, on
  // 07:30→23:00 (96 quarter-hours, bit per quarter-hour).
  const dailyBits = [];
  for (let i = 0; i < 96; i++) {
    const hour = i / 4;
    dailyBits.push(hour >= 7.5 && hour < 23 ? 1 : 0);
  }
  const fakeDailyOne = {
    id: 1,
    name: "Casa",
    bits: dailyBits,
    meta: { lastUpdatedAt: new Date().toISOString() },
  };

  // Route interception: every time the SPA calls the slow REHAU-backed
  // endpoints, serve a known-good synthetic body instead. The bridge
  // is still in the loop for everything else.
  await page.route("**/api/v1/installer/calibration*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fakeCalibration),
    });
  });
  await page.route("**/api/v1/programs/daily/*", (route) => {
    const url = new URL(route.request().url());
    const m = url.pathname.match(/daily\/(\d+)/);
    const id = m ? Number(m[1]) : 1;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...fakeDailyOne, id }),
    });
  });

  // ── 07 Programs — daily slot 1 ───────────────────────────────────────
  console.log("→ Programs");
  await page.goto(`${BASE}/#/programs`, { waitUntil: "domcontentloaded" });
  // The body shows "LOADING…" until the daily-slot fetch returns. REHAU
  // installer reads can take 30–90s on a cold cache.
  const ok7 = await waitNoLoading(page, 180000);
  if (!ok7) console.warn("⚠ Programs still loading after 180s, screenshotting anyway");
  await page.waitForTimeout(800);
  await shoot(page, "07-programs.png");

  // ── 09 Installer — Calibration ───────────────────────────────────────
  console.log("→ Installer");
  await page.goto(`${BASE}/#/installer`, { waitUntil: "domcontentloaded" });
  const ok9 = await waitNoLoading(page, 180000);
  if (!ok9) console.warn("⚠ Installer still loading after 180s, screenshotting anyway");
  await page.waitForTimeout(800);
  await shoot(page, "09-installer.png");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
