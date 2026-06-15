import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { unlockAction } from "./actions";
import { readUnlockSession, UNLOCK_COOKIE_NAME } from "@/lib/auth";
import { normalizePanelNextPath } from "@/lib/routes";

export default async function PanelLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }, cookieStore] = await Promise.all([
    searchParams,
    cookies(),
  ]);
  const destination = normalizePanelNextPath(next);
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

  if (readUnlockSession(unlockCookie)) {
    redirect(destination);
  }

  const errorMessage =
    error === "invalid_passcode"
      ? "口令不正确"
      : error === "rate_limited"
        ? "请求过于频繁，请稍后重试"
        : undefined;

  return (
    <main className="unlock-shell">
      <section className="unlock-card">
        <div className="unlock-crest">Game Day Entry</div>
        <div className="unlock-eyebrow">HITSZ Baseball · Team Panel</div>
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

        <form action={unlockAction} className="unlock-form">
          <input type="hidden" name="next" value={destination} />
          <label htmlFor="passcode">管理员口令</label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            placeholder="请输入共享口令"
            autoComplete="current-password"
            required
          />
          <button type="submit">进入比赛日控制台</button>
        </form>

        {errorMessage ? (
          <div className="unlock-error">{errorMessage}</div>
        ) : null}

        <p className="unlock-note">
          当前工作区采用单管理员共享模式。未授权用户无法查看球员与阵容数据。
        </p>
      </section>
    </main>
  );
}
