import { type WalletClient } from "viem";

import { getContentDocument } from "./contentStore";

type ResolveSignalBodyParams = {
  encryptedContentCid?: string | null;
  hintCid?: string | null;
  walletClient?: WalletClient | null;
};

export type ResolvedSignalBody = {
  contentHtml: string;
  sourceCid: string;
  sourceType: "combined";
};

async function readDirectBodyFromCid(cid: string) {
  const document = await getContentDocument(cid);

  if (!document) {
    return null;
  }

  if (document.kind === "signal-combined") {
    return {
      contentHtml: document.contentHtml,
      sourceCid: cid,
      sourceType: "combined" as const,
    };
  }

  return document;
}

export async function resolveSignalBodyFromChain(
  params: ResolveSignalBodyParams,
): Promise<ResolvedSignalBody> {
  const encryptedContentCid = params.encryptedContentCid?.trim() ?? "";
  const hintCid = params.hintCid?.trim() ?? "";

  if (encryptedContentCid) {
    const contentDocument = await readDirectBodyFromCid(encryptedContentCid);

    if (contentDocument && "contentHtml" in contentDocument) {
      return contentDocument;
    }

    if (contentDocument?.kind === "signal-public") {
      throw new Error("链上正文 CID 现在指向的是预览文档，不是真正的正文内容。");
    }

    if (contentDocument?.kind === "text") {
      throw new Error("链上正文 CID 现在指向的是纯文本回应，不是可阅读的正文文档。");
    }
  }

  if (hintCid) {
    const hintDocument = await readDirectBodyFromCid(hintCid);

    if (hintDocument && "contentHtml" in hintDocument) {
      return hintDocument;
    }
  }

  if (encryptedContentCid) {
    throw new Error("还没有从链上 CID 读到可用正文。可能是 IPFS 上传未完成，或这条 CID 写入了错误的内容类型。");
  }

  throw new Error("这条信号当前没有可读取的正文 CID。");
}
