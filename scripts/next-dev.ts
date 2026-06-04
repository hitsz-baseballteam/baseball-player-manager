import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

import { createResilientMirror } from "../src/lib/dev-server-output";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const logDir = join(process.cwd(), ".next", "dev", "logs");
mkdirSync(logDir, { recursive: true });
const logPath = join(logDir, "next-dev-wrapper.log");
const logStream = createWriteStream(logPath, { flags: "a" });

const stdoutMirror = createResilientMirror({
  consoleStream: process.stdout,
  logStream,
  label: "stdout",
});
const stderrMirror = createResilientMirror({
  consoleStream: process.stderr,
  logStream,
  label: "stderr",
});

logStream.write(`[next-dev wrapper] starting at ${new Date().toISOString()}\n`);

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout?.on("data", (chunk) => {
  stdoutMirror.write(chunk);
});

child.stderr?.on("data", (chunk) => {
  stderrMirror.write(chunk);
});

child.on("error", (error) => {
  logStream.write(`[next-dev wrapper] failed to start child: ${String(error)}\n`);
  shutdown(1);
});

child.on("exit", (code, signal) => {
  logStream.write(
    `[next-dev wrapper] child exited code=${code ?? "null"} signal=${signal ?? "null"}\n`,
  );
  shutdown(code ?? (signal ? 1 : 0));
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

function shutdown(code: number) {
  stdoutMirror.close();
  stderrMirror.close();
  logStream.end(() => {
    process.exit(code);
  });
}
