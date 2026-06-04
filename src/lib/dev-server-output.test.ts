import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Writable } from "node:stream";

import { createResilientMirror } from "@/lib/dev-server-output";

class CaptureWritable extends Writable {
  chunks: string[] = [];

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.chunks.push(chunk.toString("utf8"));
    callback();
  }
}

class BrokenPipeWritable extends Writable {
  writes = 0;

  override _write(
    _chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.writes += 1;
    const error = new Error("broken pipe") as Error & { code?: string };
    error.code = "EPIPE";
    callback(error);
  }
}

describe("createResilientMirror", () => {
  it("keeps logging after console stream hits EPIPE", async () => {
    const logStream = new CaptureWritable();
    const consoleStream = new BrokenPipeWritable();
    const mirror = createResilientMirror({
      consoleStream,
      logStream,
      label: "stdout",
    });

    mirror.write("first line\n");
    await new Promise((resolve) => setImmediate(resolve));

    mirror.write("second line\n");
    await new Promise((resolve) => setImmediate(resolve));

    mirror.close();

    assert.equal(consoleStream.writes, 1);
    assert.deepEqual(logStream.chunks, [
      "first line\n",
      "[next-dev wrapper] stdout console mirror disabled: EPIPE\n",
      "second line\n",
    ]);
  });
});
