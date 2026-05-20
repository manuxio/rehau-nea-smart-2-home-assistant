#!/usr/bin/env node
// Writes the ngrok authtoken into the canonical ngrok config file so that
// `expo start --tunnel` (which spawns @expo/ngrok-bin) can open sessions.
//
// Why: ngrok requires an account-bound authtoken for ALL tunnels since 2023.
// Without it, @expo/ngrok crashes with:
//   TypeError: Cannot read properties of undefined (reading 'body')
// because its error handler assumes the failed request returned an HTTP
// response — but the agent never even got a session, so `error.response` is
// undefined.
//
// Usage:
//   npm run -w @rehau/mobile tunnel:auth -- <YOUR_TOKEN>
//   # or interactively:
//   npm run -w @rehau/mobile tunnel:auth
//
// Get your authtoken (free): https://dashboard.ngrok.com/get-started/your-authtoken

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const configDir = () => {
  // Match the path that @expo/ngrok-bin's bundled ngrok binary reads from.
  if (platform() === "win32") {
    const local = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(local, "ngrok");
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "ngrok");
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "ngrok");
};

const promptToken = async () => {
  const rl = createInterface({ input: stdin, output: stdout });
  const t = (
    await rl.question(
      "Paste your ngrok authtoken (https://dashboard.ngrok.com/get-started/your-authtoken):\n> ",
    )
  ).trim();
  rl.close();
  return t;
};

const main = async () => {
  let token = process.argv[2]?.trim();
  if (!token) token = process.env.NGROK_AUTHTOKEN?.trim();
  if (!token) token = await promptToken();
  if (!token || !/^[A-Za-z0-9_]{20,}$/.test(token)) {
    console.error("✗ That doesn't look like a valid ngrok authtoken.");
    process.exit(1);
  }

  const dir = configDir();
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "ngrok.yml");

  // Preserve any existing config keys, overwrite only authtoken.
  let body = "";
  if (existsSync(file)) {
    body = readFileSync(file, "utf8");
    if (/^authtoken:/m.test(body)) {
      body = body.replace(/^authtoken:.*$/m, `authtoken: ${token}`);
    } else {
      body = body.replace(/\s*$/, "") + `\nauthtoken: ${token}\n`;
    }
  } else {
    body = `version: "2"\nauthtoken: ${token}\n`;
  }
  writeFileSync(file, body, { mode: 0o600 });

  console.log(`✓ Wrote authtoken to ${file}`);
  console.log("  Now run:  npm run -w @rehau/mobile tunnel");
};

await main();
