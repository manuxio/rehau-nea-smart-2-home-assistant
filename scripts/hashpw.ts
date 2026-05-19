// Generate a bcrypt hash for the API_PASSWORD_HASH env var.
//
// Usage:
//   npm run hashpw -- <password>          # one-shot
//   npm run hashpw                        # read from stdin

import { hash } from "bcrypt";
import { createInterface } from "node:readline/promises";

const ROUNDS = 12;

const readFromStdin = async (): Promise<string> => {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const pw = await rl.question("password: ");
  rl.close();
  return pw;
};

const main = async (): Promise<void> => {
  const arg = process.argv[2];
  const pw = arg ?? (await readFromStdin());
  if (!pw || pw.length < 8) {
    process.stderr.write("password must be at least 8 chars\n");
    process.exit(1);
  }
  const h = await hash(pw, ROUNDS);
  process.stdout.write(`${h}\n`);
};

main().catch((err: unknown) => {
  console.error("hashpw failed:", err);
  process.exit(1);
});
