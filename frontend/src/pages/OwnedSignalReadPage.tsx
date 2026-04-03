import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useWalletClient } from "wagmi";

import { AppHeader } from "../components/layout/AppHeader";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { formatDateTimeLabel } from "../lib/format";
import { useAppState } from "../state/useAppState";
import { resolveSignalBodyFromChain } from "../web3/signalContent";

export function OwnedSignalReadPage() {
  const navigate = useNavigate();
  const { ownedSignalId } = useParams();
  const { state } = useAppState();
  const { data: walletClient } = useWalletClient();
  const signal = state.ownSignals.find((item) => item.id.toString() === ownedSignalId);
  const sourceSignal = signal?.sourceSignalId
    ? state.accessibleSignals.find((item) => item.id === signal.sourceSignalId)
    : null;
  const [contentHtml, setContentHtml] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isReadingContent, setIsReadingContent] = useState(false);

  useEffect(() => {
    if (!signal) {
      setContentHtml(null);
      setReadError(null);
      return;
    }

    if (signal.storage === "local") {
      setContentHtml(signal.contentHtml ?? null);
      setReadError(null);
      setIsReadingContent(false);
      return;
    }

    setContentHtml(null);
    setReadError(null);
  }, [signal]);

  useEffect(() => {
    if (
      !signal ||
      signal.storage === "local" ||
      (!signal.encryptedContentCID && !sourceSignal?.encryptedContentCID && !sourceSignal?.ipfsHash)
    ) {
      return;
    }

    let cancelled = false;
    setIsReadingContent(true);
    setContentHtml(null);
    setReadError(null);

    void resolveSignalBodyFromChain({
      encryptedContentCid: signal.encryptedContentCID ?? sourceSignal?.encryptedContentCID,
      hintCid: sourceSignal?.ipfsHash,
      walletClient,
    })
      .then((nextContentHtml) => {
        if (cancelled) {
          return;
        }

        setContentHtml(nextContentHtml.contentHtml);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setReadError(error instanceof Error ? error.message : "正文读取失败，请重试。");
      })
      .finally(() => {
        if (!cancelled) {
          setIsReadingContent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signal, sourceSignal, walletClient]);

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
  const shouldReadFromChain = signal.storage !== "local";

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
            ) : isReadingContent ? (
              <div className="text-sm leading-7 text-[var(--text-secondary)]">正在根据链上 CID 读取正文...</div>
            ) : readError ? (
              <div className="rounded-3xl border border-red-800/40 bg-red-950/20 px-6 py-5 text-sm leading-7 text-red-200">
                {readError}
              </div>
            ) : shouldReadFromChain ? (
              <div className="text-sm leading-7 text-[var(--text-secondary)]">还没有读到这条信号的链上正文。</div>
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
