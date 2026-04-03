import { KeyboardEvent, MouseEvent } from "react";

import { Button } from "../ui/Button";
import { GeneratedAvatar } from "../ui/GeneratedAvatar";
import { Panel } from "../ui/Panel";
import { useCountdown } from "../../hooks/useCountdown";
import { formatDateLabel, truncateAddress } from "../../lib/format";
import {
  AnswerRecord,
  GiftRecord,
  InviteReplyType,
  InviteRecord,
  OwnedSignalRecord,
} from "../../types/domain";

export type HubToastTone = "amber" | "violet" | "green" | "red";

export function HubEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Panel className="p-5 text-center">
      <div className="text-sm text-[var(--text-secondary)]">{title}</div>
      <div className="mt-2 text-xs leading-6 text-[var(--text-muted)]">{description}</div>
    </Panel>
  );
}

export function HubToast({ message, tone }: { message: string; tone: HubToastTone }) {
  const toneClass =
    tone === "green"
      ? "border-[rgba(74,222,128,0.4)] text-[#4ADE80]"
      : tone === "red"
        ? "border-[rgba(239,68,68,0.4)] text-[#EF4444]"
        : tone === "violet"
          ? "border-[rgba(155,127,212,0.45)] text-[var(--resonance)]"
          : "border-[rgba(196,168,90,0.45)] text-[var(--signal)]";

  return (
    <div
      className={`rounded-full border bg-[rgba(24,24,42,0.96)] px-5 py-2 text-xs tracking-[0.07em] ${toneClass}`}
    >
      {message}
    </div>
  );
}

export function HubSignalCard({
  onOpen,
  onDelete,
  signal,
}: {
  onOpen: () => void;
  onDelete: () => void;
  signal: OwnedSignalRecord;
}) {
  const displayHook = signal.hook?.trim() || signal.title?.trim() || signal.content.slice(0, 40);
  const displayQuestion = signal.question?.trim() || null;
  const storageLabel =
    signal.visibility === "private"
      ? "◌ 仅自己可见"
      : signal.storage === "arweave"
        ? "⧫ Arweave"
        : "◎ IPFS";

  function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onDelete();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpen();
  }

  return (
    <Panel
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="relative cursor-pointer overflow-hidden p-4 pl-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(196,168,90,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,168,90,0.35)]"
    >
      <div className="absolute bottom-0 left-0 top-0 w-[2px] bg-gradient-to-b from-[var(--signal)] to-transparent" />
      <div className="space-y-4">
        <p className="font-display text-sm leading-7 text-[var(--text-secondary)]">
          {displayHook}
        </p>
        <div className="rounded-[1.25rem] border border-white/5 bg-black/30 px-4 py-3">
          <p className="font-display text-xs italic leading-6 text-[var(--signal)]">
            “{displayQuestion ?? "暂未写下问题"}”
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
          <span>◎ {signal.resonances}</span>
          {signal.linked > 0 ? (
            <span className="rounded-full border border-[rgba(155,127,212,0.35)] bg-[rgba(155,127,212,0.12)] px-2 py-1 text-[var(--resonance)]">
              ⬡ {signal.linked} 相连
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[rgba(196,168,90,0.35)] bg-[rgba(196,168,90,0.1)] px-2 py-1 text-[10px] text-[var(--signal)]">
            {storageLabel}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-all duration-200 hover:border-[rgba(239,68,68,0.35)] hover:text-[#EF4444]"
          >
            ✕ 删除
          </button>
        </div>
      </div>
    </Panel>
  );
}

export function HubAnswerCard({
  answer,
  onAuthorize,
  onLater,
}: {
  answer: AnswerRecord;
  onAuthorize: () => void;
  onLater: () => void;
}) {
  return (
    <Panel className={answer.status === "authorized" ? "border-[rgba(74,222,128,0.3)] p-4" : "p-4"}>
      <div className="mb-3 flex items-center gap-3">
        <SenderAvatar address={answer.from} size={30} />
        <div className="flex-1">
          <div className="font-mono text-[11px] text-[var(--text-secondary)]">
            {answer.ens ?? truncateAddress(answer.from)}
          </div>
          <div className="text-[9px] text-[var(--text-muted)]">{formatDateLabel(answer.ts)}</div>
        </div>
        {answer.status === "authorized" ? <HubCountdownBadge endTime={answer.authorizedAt} /> : null}
        {answer.status === "authorizing" ? (
          <span className="rounded-full border border-[rgba(196,168,90,0.35)] bg-[rgba(196,168,90,0.1)] px-2 py-1 text-[9px] text-[var(--signal)]">
            授权中
          </span>
        ) : null}
      </div>

      <p className="font-display text-sm leading-7 text-[var(--text-secondary)]">{answer.preview}</p>
      <div className="mt-3 rounded-lg border border-[var(--line)] bg-[rgba(24,24,42,0.9)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
        关联文章：{answer.article}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {answer.status === "pending" ? (
          <>
            <Button onClick={onAuthorize}>⬡ 开门授权</Button>
            <Button variant="ghost" onClick={onLater}>
              稍后处理
            </Button>
          </>
        ) : null}
        {answer.status === "authorized" ? <Button variant="green">✓ 限时阅读中</Button> : null}
      </div>
    </Panel>
  );
}

export function HubInviteCard({
  invite,
  onRead,
}: {
  invite: InviteRecord;
  onRead?: () => void;
  onReplyText: (value: string) => void;
  onReplyType: (replyType: InviteReplyType) => void;
  onSubmit: () => void;
  onToggle: () => void;
}) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <SenderAvatar address={invite.from} size={30} />
          <div className="flex-1">
            <div className="font-mono text-[11px] text-[var(--text-secondary)]">
              {invite.ens ?? truncateAddress(invite.from)}
            </div>
            <div className="text-[9px] text-[var(--text-muted)]">{formatDateLabel(invite.ts)} 发出邀请</div>
          </div>
          {invite.accessExpiresAt ? <HubCountdownBadge endTime={invite.accessExpiresAt} /> : null}
          <span className="rounded-full border border-[rgba(196,168,90,0.35)] bg-[rgba(196,168,90,0.1)] px-2 py-1 text-[9px] text-[var(--signal)]">
            邀请
          </span>
        </div>

        <div className="mb-3 rounded-lg border border-[var(--line)] bg-[rgba(24,24,42,0.9)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
          {invite.article}
        </div>
        <p className="font-display text-sm leading-7 text-[var(--text-secondary)]">{invite.excerpt}</p>

        <div className="mt-4 flex gap-2">
          {invite.canRead && onRead ? (
            <Button variant="green" className="flex-1" onClick={onRead}>
              ✓ 点击查看原文
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export function HubGiftCard({
  gift,
  onOpen,
}: {
  gift: GiftRecord;
  onOpen: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpen();
  }

  return (
    <Panel
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="cursor-pointer p-4 transition-all duration-200 hover:border-[rgba(196,168,90,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,168,90,0.35)]"
    >
      <div className="mb-3 flex items-center gap-3">
        <SenderAvatar address={gift.from} size={28} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
              {gift.ens ?? truncateAddress(gift.from)}
            </span>
            <span className="rounded-full border border-[rgba(196,168,90,0.35)] bg-[rgba(196,168,90,0.1)] px-2 py-1 text-[9px] text-[var(--signal)]">
              {gift.type}
            </span>
          </div>
          <div className="text-[9px] text-[var(--text-muted)]">
            {formatDateLabel(gift.ts)} · {gift.article}
          </div>
        </div>
      </div>
      <p className="border-l border-[rgba(196,168,90,0.35)] pl-4 font-display text-[15px] leading-8 text-[var(--text-primary)]">
        {gift.message}
      </p>
    </Panel>
  );
}

function SenderAvatar({ address, size }: { address: string; size: number }) {
  return <GeneratedAvatar address={address} size={size} className="border-[rgba(51,51,74,1)]" />;
}

function HubCountdownBadge({ endTime }: { endTime: number | null }) {
  const { label, isExpired } = useCountdown(endTime);

  if (!endTime) {
    return null;
  }

  return (
    <span
      className={
        isExpired
          ? "inline-flex items-center gap-1 rounded-full border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.1)] px-2 py-1 text-[9px] text-[#EF4444]"
          : "inline-flex items-center gap-1 rounded-full border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.1)] px-2 py-1 text-[9px] text-[#4ADE80]"
      }
    >
      {label}
    </span>
  );
}
