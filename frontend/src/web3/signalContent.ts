import { type WalletClient } from "viem";

import { getContentDocument } from "./contentStore";
import { decryptSignalContent, PENDING_ENCRYPTED_CONTENT_CID } from "./lit";

type ResolveSignalBodyParams = {
  encryptedContentCid?: string | null;
  hintCid?: string | null;
  walletClient?: WalletClient | null;
};

export type ResolvedSignalBody = {
  contentHtml: string;
  sourceCid: string;
  sourceType: "combined" | "encrypted";
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

  if (encryptedContentCid && encryptedContentCid !== PENDING_ENCRYPTED_CONTENT_CID) {
    const encryptedDocument = await readDirectBodyFromCid(encryptedContentCid);

    if (encryptedDocument && "contentHtml" in encryptedDocument) {
      return encryptedDocument;
    }

    if (!params.walletClient) {
      throw new Error("需要先连接钱包并完成签名，才能解开这条链上正文。");
    }

    if (!encryptedDocument || encryptedDocument.kind === "signal-private-encrypted") {
      return {
        contentHtml: await decryptSignalContent(params.walletClient, {
          encryptedCid: encryptedContentCid,
        }),
        sourceCid: encryptedContentCid,
        sourceType: "encrypted",
      };
    }

    if (encryptedDocument.kind === "signal-public") {
      throw new Error("链上正文 CID 现在指向的是预览文档，不是真正的正文内容。");
    }

    if (encryptedDocument.kind === "text") {
      throw new Error("链上正文 CID 现在指向的是纯文本回应，不是可阅读的正文文档。");
    }
  }

  if (hintCid) {
    const hintDocument = await readDirectBodyFromCid(hintCid);

    if (hintDocument && "contentHtml" in hintDocument) {
      return hintDocument;
    }
  }

  if (encryptedContentCid === PENDING_ENCRYPTED_CONTENT_CID) {
    throw new Error(
      "这条信号链上的正文 CID 还没有写成功。现在链上仍是占位 CID，不是单纯 IPFS 读取失败；只有作者把真正的正文 CID 写上链后，这里才能读到正文。",
    );
  }

  if (encryptedContentCid) {
    throw new Error("还没有从链上 CID 读到可用正文。可能是 IPFS 上传未完成，或这条 CID 写入了错误的内容类型。");
  }

  throw new Error("这条信号当前没有可读取的正文 CID。");
}
