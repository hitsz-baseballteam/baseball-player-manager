"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function UnlockForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSubmitting || isPending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });

      if (response.status === 401) {
        setError("口令不正确");
        return;
      }

      if (!response.ok) {
        setError("暂时无法验证口令，请稍后重试");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="unlock-shell">
      <section className="unlock-card">
        <div className="unlock-eyebrow">Baseball Player Manager</div>
        <h1>共享口令保护</h1>
        <p>
          当前线上工作区使用单管理员共享模式。输入管理员口令后，才能查看和修改球员与阵容数据。
        </p>
        <form onSubmit={handleSubmit} className="unlock-form">
          <label htmlFor="passcode">管理员口令</label>
          <input
            id="passcode"
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder="请输入共享口令"
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={isBusy}>
            {isBusy ? "验证中..." : "进入工作区"}
          </button>
        </form>
        {error ? <div className="unlock-error">{error}</div> : null}
      </section>
    </main>
  );
}
