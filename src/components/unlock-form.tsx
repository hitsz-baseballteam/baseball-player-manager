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
        <div className="unlock-crest">Game Day Entry</div>
        <div className="unlock-eyebrow">Baseball Player Manager</div>
        <h1>进入球队共享工作区</h1>
        <p>
          这是比赛日用的共享球员与排阵控制台。输入管理员口令后，才能查看名册、阵容方案和工作区数据。
        </p>

        <div className="unlock-highlights" aria-hidden="true">
          <div className="unlock-highlight">
            <strong>共享名册</strong>
            <span>球员资料、守位偏好与状态统一维护</span>
          </div>
          <div className="unlock-highlight">
            <strong>多套方案</strong>
            <span>常规先发、守备优先和临时调整集中留档</span>
          </div>
          <div className="unlock-highlight">
            <strong>版本保护</strong>
            <span>工作区通过版本号控制并发写入，减少互相覆盖</span>
          </div>
        </div>

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
            {isBusy ? "验证中..." : "进入比赛日控制台"}
          </button>
        </form>

        {error ? <div className="unlock-error">{error}</div> : null}

        <p className="unlock-note">
          当前工作区采用单管理员共享模式。未授权用户无法查看球员与阵容数据。
        </p>
      </section>
    </main>
  );
}
