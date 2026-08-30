import Link from "next/link";
import { appConfig } from "@/lib/app-config";

type AppShellProps = {
  children: React.ReactNode;
  active?: "prepare" | "interview" | "report";
};

export function AppShell({ children, active }: AppShellProps) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brand" href="/" aria-label={appConfig.name + " 首页"}>
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            <strong>{appConfig.name}</strong>
            <small>EVIDENCE-LED INTERVIEW PRACTICE</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="主导航">
          {appConfig.navigation.map((item) => {
            const key = item.href.startsWith("/prepare")
              ? "prepare"
              : item.href.startsWith("/interview")
                ? "interview"
                : "report";

            return (
              <Link
                className={active === key ? "is-active" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span className="build-chip">
          <i />
          OFFLINE READY
        </span>
      </header>

      {children}

      <footer className="site-footer">
        <span>AI Interview · 训练工具，不提供真实面试代答</span>
        <span>材料与录音默认仅用于本次会话</span>
      </footer>
    </div>
  );
}
