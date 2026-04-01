import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";

import { BrandMark } from "../ui/BrandMark";
import { GeneratedAvatar } from "../ui/GeneratedAvatar";
import { formatWalletLabel } from "../../lib/format";
import { useAppState } from "../../state/useAppState";
import { cn } from "../../lib/cn";
import { clearAuthSession } from "../../lib/authSession";

interface PrototypeAppShellProps {
  activeTab: "feed" | "hub";
  children: ReactNode;
  fabTo?: string;
}

export function PrototypeAppShell({ activeTab, children, fabTo }: PrototypeAppShellProps) {
  const navigate = useNavigate();
  const { disconnectAsync } = useDisconnect();
  const { address } = useAccount();
  const { state } = useAppState();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const walletAddress = address ?? state.session.walletAddress ?? "";
  const walletLabel = formatWalletLabel(walletAddress);
  const personalHubCount = useMemo(
    () =>
      state.answers.filter((answer) => answer.status !== "authorized").length +
      state.invites.length +
      state.gifts.length,
    [state.answers, state.gifts.length, state.invites.length],
  );

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function handleCopyAddress() {
    if (!walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);
    } catch {
      return;
    }

    setToast("Copied ✓");
    setMenuOpen(false);
  }

  async function handleDisconnect() {
    try {
      clearAuthSession();
      await disconnectAsync();
    } catch {
      return;
    }

    setMenuOpen(false);
    navigate("/onboarding", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#09090F] font-mono text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(9,9,15,0.96)] backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1440px] items-center justify-between px-4 md:px-6">
          <Link to="/discover" className="shrink-0">
            <BrandMark showText textClassName="text-base md:text-lg" />
          </Link>

          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <nav className="flex items-center gap-2">
              <NavItem to="/discover" label="Feed" active={activeTab === "feed"} />
              <NavItem
                to="/me"
                label="Personal Hub"
                active={activeTab === "hub"}
                badge={personalHubCount}
              />
            </nav>

            <ConnectButton.Custom>
              {({
                account,
                authenticationStatus,
                chain,
                mounted,
                openChainModal,
                openConnectModal,
              }) => {
                const ready = mounted && authenticationStatus !== "loading";
                const connected = ready && account && chain;

                if (!connected) {
                  return (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--text-primary)] transition-colors hover:border-[rgba(196,168,90,0.35)] hover:text-[var(--signal)]"
                    >
                      Connect Wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      type="button"
                      onClick={openChainModal}
                      className="rounded-full border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-2 text-xs text-[#FCA5A5] transition-colors hover:bg-[rgba(239,68,68,0.12)]"
                    >
                      Wrong Network
                    </button>
                  );
                }

                return (
                  <div ref={dropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((value) => !value)}
                      className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 transition-colors hover:border-[rgba(155,127,212,0.35)]"
                    >
                      <GeneratedAvatar address={walletAddress} size={24} className="border-[rgba(51,51,74,1)]" />
                      <div className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                      <span className="hidden text-[11px] tracking-[0.04em] text-[var(--text-primary)] sm:inline">
                        {account.displayName ?? walletLabel}
                      </span>
                    </button>

                    {menuOpen ? (
                      <div className="absolute right-0 top-[calc(100%+8px)] min-w-[220px] rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] py-1 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                        <div className="border-b border-[var(--line)] px-4 py-3">
                          <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Connected</div>
                          <div className="break-all text-[10px] leading-6 text-[var(--text-secondary)]">
                            {walletAddress || "已连接钱包"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopyAddress()}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[rgba(196,168,90,0.08)] hover:text-[var(--signal)]"
                        >
                          ⎘ Copy address
                        </button>
                        <Link
                          to="/me"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[rgba(155,127,212,0.08)] hover:text-[var(--resonance)]"
                        >
                          ↗ Personal Hub
                        </Link>
                        <div className="my-1 border-t border-[var(--line)]" />
                        <button
                          type="button"
                          onClick={() => void handleDisconnect()}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-[#EF4444] transition-colors hover:bg-[rgba(239,68,68,0.08)]"
                        >
                          ⏻ Disconnect
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-58px)] max-w-[1440px] flex-col">
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>

      {fabTo ? (
        <Link
          to={fabTo}
          className="fixed bottom-8 right-8 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(140deg,#D4B86A_0%,#C4A85A_55%,#A88E44_100%)] text-2xl text-[#1A1206] shadow-[0_4px_20px_rgba(196,168,90,0.45)] transition-transform hover:scale-105"
          aria-label="发出信号弹"
        >
          +
        </Link>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[rgba(196,168,90,0.45)] bg-[var(--surface-raised)] px-4 py-2 text-[11px] tracking-[0.07em] text-[var(--signal)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

interface NavItemProps {
  active: boolean;
  badge?: number;
  label: string;
  to: string;
}

function NavItem({ active, badge, label, to }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs tracking-[0.04em]",
        active
          ? "border-[rgba(196,168,90,0.35)] bg-[rgba(196,168,90,0.1)] text-[var(--signal)]"
          : "border-transparent text-[var(--text-muted)] hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
      )}
    >
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="ml-auto rounded-full border border-[rgba(155,127,212,0.35)] bg-[rgba(155,127,212,0.12)] px-1.5 py-0.5 text-[9px] text-[var(--resonance)]">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}
