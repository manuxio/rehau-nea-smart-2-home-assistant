// Snapshot the live REHAU device's HTML for every endpoint we care about and
// write the result under tests/fixtures/fw-<webVersion>/. Tests then run
// offline against these fixtures and we re-snapshot on FW bumps.
//
// Usage:
//   DEVICE_URL=http://10.160.18.139 \
//   DEVICE_INSTALLER_CODE=78602d11 \
//   npm run snapshot

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { request } from "undici";

const DEVICE_URL = process.env.DEVICE_URL ?? "http://10.160.18.139";
const INSTALLER_CODE = process.env.DEVICE_INSTALLER_CODE;
const FW_TAG = process.env.FW_TAG ?? "fw-6.15";
const OUT_DIR = resolve(import.meta.dirname, "..", "tests", "fixtures", FW_TAG);

type Endpoint = {
  /** Output filename (under tests/fixtures/<fw>/). */
  name: string;
  path: string;
  method: "GET" | "POST";
  body?: string;
  installer?: boolean;
};

const tier1: Endpoint[] = [
  { name: "dashboard.html", path: "/", method: "GET" },
  { name: "room-page.html", path: "/room-page.html", method: "GET" },
  { name: "messages.html", path: "/messages.html", method: "GET" },
  { name: "user-timer-program.html", path: "/user-timer-program.html", method: "GET" },
  { name: "user-daily-program.html", path: "/user-daily-program.html", method: "GET" },
  { name: "user-weekly-program.html", path: "/user-weekly-program.html", method: "GET" },
  { name: "user-config-installer.html", path: "/user-config-installer.html", method: "GET" },
  { name: "it-settings.html", path: "/it-settings.html", method: "GET" },
  // Per-room detail (zones 0..3 in the current install).
  ...[0, 1, 2, 3].map<Endpoint>((z) => ({
    name: `room-operating-${z}.html`,
    path: "/room-operating.html",
    method: "POST",
    body: `${z}=`,
  })),
  ...[0, 1, 2, 3].map<Endpoint>((z) => ({
    name: `room-set-up-${z}.html`,
    path: "/room-set-up.html",
    method: "POST",
    body: `${z}=`,
  })),
  // First daily/weekly slot for parser shape.
  { name: "user-update-daily-1.html", path: "/user-update-daily-program.html", method: "POST", body: "1=" },
  { name: "user-update-weekly-1.html", path: "/user-update-weekly-program.html", method: "POST", body: "1=" },
];

const tier2: Endpoint[] = [
  { name: "menu.html", path: "/menu.html", method: "GET", installer: true },
  { name: "installer-room-page.html", path: "/installer-room-page.html", method: "GET", installer: true },
  ...[0, 1, 2, 3].map<Endpoint>((z) => ({
    name: `installer-room-set-up-${z}.html`,
    path: "/installer-room-set-up.html",
    method: "POST",
    body: `${z}=`,
    installer: true,
  })),
  { name: "installer-timer-program.html", path: "/installer-timer-program.html", method: "GET", installer: true },
  { name: "installer-setting.html", path: "/installer-setting.html", method: "GET", installer: true },
  { name: "hCSett.html", path: "/hCSett.html", method: "GET", installer: true },
  { name: "circSett.html", path: "/circSett.html", method: "GET", installer: true },
  { name: "deviSett.html", path: "/deviSett.html", method: "GET", installer: true },
  { name: "funcSett.html", path: "/funcSett.html", method: "GET", installer: true },
  { name: "advSett.html", path: "/advSett.html", method: "GET", installer: true },
  { name: "installer-fanc-settings.html", path: "/installer-fanc-settings.html", method: "GET", installer: true },
  { name: "installer-diagnosis.html", path: "/installer-diagnosis.html", method: "GET", installer: true },
  { name: "installer-system-statistics.html", path: "/installer-system-statistics.html", method: "GET", installer: true },
  { name: "installer-inputoutput.html", path: "/installer-inputoutput.html", method: "GET", installer: true },
  { name: "installer-adjustementOffset.html", path: "/installer-adjustementOffset.html", method: "GET", installer: true },
  { name: "diagSett.html", path: "/diagSett.html", method: "GET", installer: true },
  { name: "installer-system.html", path: "/installer-system.html", method: "GET", installer: true },
];

const installerLogin = async (): Promise<void> => {
  if (!INSTALLER_CODE) throw new Error("DEVICE_INSTALLER_CODE not set");
  const res = await request(`${DEVICE_URL}/menu.html`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `instPart=${encodeURIComponent(INSTALLER_CODE)}`,
  });
  await res.body.text();
  if (res.statusCode !== 200) {
    throw new Error(`installer login failed: ${res.statusCode}`);
  }
};

const installerLogout = async (): Promise<void> => {
  const res = await request(`${DEVICE_URL}/user-menu.html`, { method: "GET" });
  await res.body.text();
};

const fetchOne = async (e: Endpoint): Promise<string> => {
  const url = `${DEVICE_URL}${e.path}`;
  const res = await request(url, {
    method: e.method,
    ...(e.body
      ? {
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: e.body,
        }
      : {}),
    bodyTimeout: 8000,
    headersTimeout: 8000,
  });
  if (res.statusCode !== 200) {
    throw new Error(`${e.method} ${e.path} → ${res.statusCode}`);
  }
  return res.body.text();
};

const write = async (name: string, html: string): Promise<void> => {
  const out = resolve(OUT_DIR, name);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  process.stdout.write(`  wrote ${name}\n`);
};

const main = async (): Promise<void> => {
  process.stdout.write(`snapshot → ${OUT_DIR}\n`);

  process.stdout.write("Tier-1 (user pages)\n");
  for (const e of tier1) {
    try {
      const html = await fetchOne(e);
      await write(e.name, html);
    } catch (err) {
      process.stderr.write(`  FAIL ${e.name}: ${(err as Error).message}\n`);
    }
  }

  if (INSTALLER_CODE) {
    process.stdout.write("Tier-2 (installer pages)\n");
    try {
      await installerLogin();
      for (const e of tier2) {
        try {
          const html = await fetchOne(e);
          await write(e.name, html);
        } catch (err) {
          process.stderr.write(`  FAIL ${e.name}: ${(err as Error).message}\n`);
        }
      }
    } finally {
      await installerLogout();
    }
  } else {
    process.stdout.write("Tier-2 skipped (DEVICE_INSTALLER_CODE not set)\n");
  }

  process.stdout.write("done.\n");
};

main().catch((err: unknown) => {
  console.error("snapshot failed:", err);
  process.exit(1);
});
