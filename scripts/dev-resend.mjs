import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

export function resendDevelopmentEnvironment(args) {
  const recipient = args.length === 0 ? "shanedsouza6823@gmail.com" : args[0]?.trim();
  if (args.length > 1 || !recipient || !z.email().safeParse(recipient).success) {
    throw new Error("Usage: npm run dev:resend [-- you@example.com] (at most one test email address)");
  }
  return { LOCAL_EMAIL_MODE: "resend", LOCAL_EMAIL_TEST_RECIPIENT: recipient };
}

function main() {
  const environment = resendDevelopmentEnvironment(process.argv.slice(2));
  console.log("Starting local Resend mode. All application emails go to your designated test inbox and use Resend quota.");
  const child = spawn(process.execPath, [
    fileURLToPath(new URL("./local-dev.mjs", import.meta.url)), "dev",
  ], { stdio: "inherit", env: { ...process.env, ...environment } });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
