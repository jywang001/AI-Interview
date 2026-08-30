import Link from "next/link";
import { appConfig } from "@/lib/app-config";

type AppShellProps = {
  children: React.ReactNode;
  active?: "home" | "interview" | "report";
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
          </span>
        </Link>

        <nav className="main-nav" aria-label="主导航">
          {appConfig.navigation.map((item) => {
            return (
              <Link
                className={active === item.key ? "is-active" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

      </header>

      {children}

      <footer className="site-footer">
        <span>AI Interview · 模拟面试训练</span>
      </footer>
    </div>
  );
}
