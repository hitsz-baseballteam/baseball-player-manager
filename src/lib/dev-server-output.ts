import type { Writable } from "node:stream";

type MirrorOptions = {
  consoleStream: Writable;
  logStream: Writable;
  label: string;
};

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isDisconnectError(error: unknown) {
  const code = getErrorCode(error);
  return code === "EPIPE" || code === "ERR_STREAM_DESTROYED";
}

export function createResilientMirror({
  consoleStream,
  logStream,
  label,
}: MirrorOptions) {
  let consoleAvailable = true;

  const disableConsole = (reason: string) => {
    if (!consoleAvailable) {
      return;
    }

    consoleAvailable = false;
    logStream.write(`[next-dev wrapper] ${label} console mirror disabled: ${reason}\n`);
  };

  const handleConsoleError = (error: unknown) => {
    if (isDisconnectError(error)) {
      disableConsole(getErrorCode(error) ?? "stream disconnected");
      return;
    }

    disableConsole(`unexpected console stream error (${getErrorCode(error) ?? "unknown"})`);
  };

  consoleStream.on("error", handleConsoleError);

  return {
    write(chunk: string | Buffer) {
      logStream.write(chunk);

      if (!consoleAvailable) {
        return;
      }

      try {
        consoleStream.write(chunk, (error?: Error | null) => {
          if (!error) {
            return;
          }

          handleConsoleError(error);
        });
      } catch (error) {
        handleConsoleError(error);
      }
    },
    close() {
      consoleStream.off("error", handleConsoleError);
    },
  };
}
