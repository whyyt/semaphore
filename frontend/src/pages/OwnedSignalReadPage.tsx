import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useWalletClient } from "wagmi";

import { AppHeader } from "../components/layout/AppHeader";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { formatDateTimeLabel } from "../lib/format";
import { useAppState } from "../state/useAppState";
import { decryptSignalContent } from "../web3/lit";

export function OwnedSignalReadPage() {
  const navigate = useNavigate();
  const { ownedSignalId } = useParams();
  const { state } = useAppState();
  const { data: walletClient } = useWalletClient();
  const signal = state.ownSignals.find((item) => item.id.toString() === ownedSignalId);
  const [contentHtml, setContentHtml] = useState<string | null>(signal?.contentHtml ?? null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    setContentHtml(signal?.contentHtml ?? null);
    setDecryptError(null);
  }, [signal?.contentHtml, signal?.id]);

  useEffect(() => {
    if (
      !signal ||
      signal.visibility !== "private" ||
      signal.storage === "local" ||
      !signal.encryptedContentCID ||
      !walletClient
    ) {
      return;
    }

    let cancelled = false;
    setIsDecrypting(true);

    void decryptSignalContent(walletClient, {
      encryptedCid: signal.encryptedContentCID,
    })
      .then((nextContentHtml) => {
        if (cancelled) {
          return;
        }

        setContentHtml(nextContentHtml);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setDecryptError(error instanceof Error ? error.message : "正文解密失败，请重试。");
      })
      .finally(() => {
        if (!cancelled) {
          setIsDecrypting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signal, walletClient]);

  if (!signal) {
    return <Navigate to="/me?tab=signals" replace />;
  }

  const storageLabel =
    signal.visibility === "private"
      ? "◌ 仅自己可见"
      : signal.storage === "arweave"
        ? "⧫ Arweave"
        : "◎ IPFS";
  const fallbackContent = signal.content.trim();

  return (
    <div className="min-h-screen">
      <AppHeader backTo="/me?tab=signals" backLabel="返回我的信号弹" />

      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <Panel className="p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">My Signal</div>
              <h1 className="mt-3 font-display text-3xl text-[var(--text-primary)]">
                {signal.title || "未命名信号弹"}
              </h1>
              <div className="mt-3 text-xs text-[var(--text-muted)]">
                {formatDateTimeLabel(signal.ts)} · Block #{signal.blockNumber}
              </div>
            </div>
            <span className="rounded-full border border-[rgba(196,168,90,0.35)] bg-[rgba(196,168,90,0.1)] px-3 py-2 text-xs text-[var(--signal)]">
              {storageLabel}
            </span>
          </div>

          <div className="mt-8 rounded-[2rem] border border-[rgba(196,168,90,0.14)] bg-[rgba(196,168,90,0.05)] p-6">
            {contentHtml ? (
              <div
                className="semaphore-prose text-[var(--text-primary)]"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : isDecrypting ? (
              <div className="text-sm leading-7 text-[var(--text-secondary)]">正在解开你的私密正文...</div>
            ) : decryptError ? (
              <div className="rounded-3xl border border-red-800/40 bg-red-950/20 px-6 py-5 text-sm leading-7 text-red-200">
                {decryptError}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-8 text-[var(--text-primary)]">
                {fallbackContent}
              </div>
            )}
          </div>

          {signal.sourceSignalId && signal.visibility === "public" ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="violet" onClick={() => navigate(`/signals/${signal.sourceSignalId}`)}>
                查看信号页
              </Button>
              <Button onClick={() => navigate(`/signals/${signal.sourceSignalId}/read`)}>
                进入阅读
              </Button>
            </div>
          ) : null}
        </Panel>
      </main>
    </div>
  );
}
