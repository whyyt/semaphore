import {
  LitAccessControlConditionResource,
  createSiweMessage,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { decryptFromJson, encryptToJson } from "@lit-protocol/encryption";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { type WalletClient } from "viem";

import { getEncryptedSignalContent, type EncryptedSignalJsonPayload } from "./contentStore";
import { resolveSemaphoreProtocolAddress } from "./deployment";

const LIT_CHAIN = "fuji";
const DEFAULT_LIT_NETWORK = "datil-test";
const DEFAULT_LIT_CONNECT_TIMEOUT_MS = 60000;
export const PENDING_ENCRYPTED_CONTENT_CID = "pending-encrypted-content";
const SIGNAL_CONTENT_VERSION = 1;
const ACCESS_CONTROL_DECRYPTION_ABILITY = "access-control-condition-decryption";

type SupportedLitNetwork = "datil-dev" | "datil-test" | "datil" | "custom";
type ResourceAbilityRequest = {
  ability: string;
  resource: LitAccessControlConditionResource;
};

let litClientPromise: Promise<LitNodeClient> | null = null;

function getLitNetworkValue(): SupportedLitNetwork {
  const configuredNetwork = import.meta.env.VITE_LIT_NETWORK?.trim();

  if (
    configuredNetwork === "datil-dev" ||
    configuredNetwork === "datil-test" ||
    configuredNetwork === "datil" ||
    configuredNetwork === "custom"
  ) {
    return configuredNetwork;
  }

  return DEFAULT_LIT_NETWORK;
}

function getLitConnectTimeout() {
  const raw = import.meta.env.VITE_LIT_CONNECT_TIMEOUT_MS?.trim();

  if (!raw) {
    return DEFAULT_LIT_CONNECT_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIT_CONNECT_TIMEOUT_MS;
  }

  return parsed;
}

function explainLitConnectionError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Could not handshake with nodes after timeout") ||
    message.includes("Could only connect to 0 of")
  ) {
    return new Error(
      "无法连接 Lit 节点网络。通常是当前网络无法访问 Lit 节点，或 Lit 测试网络暂时不稳定。请刷新后重试；如果仍失败，可切换网络/VPN，或在 Vercel 中把 VITE_LIT_NETWORK 调整为更稳定的 Lit 网络，并适当增大 VITE_LIT_CONNECT_TIMEOUT_MS。",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

function getWalletAccount(walletClient: WalletClient) {
  const account = walletClient.account;

  if (!account) {
    throw new Error("当前没有可用的钱包账户，请重新连接钱包。");
  }

  return account;
}

async function getLitClient() {
  if (!litClientPromise) {
    litClientPromise = (async () => {
      try {
        const litClient = new LitNodeClient({
          connectTimeout: getLitConnectTimeout(),
          litNetwork: getLitNetworkValue(),
        });

        await litClient.connect();
        return litClient;
      } catch (error) {
        litClientPromise = null;
        throw explainLitConnectionError(error);
      }
    })();
  }

  return litClientPromise;
}

export async function ensureLitReady() {
  await getLitClient();
}

async function getSessionSigs(
  walletClient: WalletClient,
  resourceAbilityRequests: ResourceAbilityRequest[],
) {
  const litNodeClient = await getLitClient();
  const account = getWalletAccount(walletClient);
  const expiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return litNodeClient.getSessionSigs({
    authNeededCallback: async ({
      expiration,
      nonce,
      uri,
    }) => {
      const toSign = await createSiweMessage({
        chainId: 43113,
        domain: window.location.host,
        expiration: expiration ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        nonce,
        uri: uri ?? window.location.origin,
        walletAddress: account.address,
      });

      return generateAuthSig({
        signer: {
          signMessage: async (message: string) =>
            walletClient.signMessage({
              account,
              message,
            }),
        },
        address: account.address,
        toSign,
      });
    },
    chain: LIT_CHAIN,
    expiration,
    resourceAbilityRequests: resourceAbilityRequests as never,
  });
}

async function buildSignalAccessControlConditions(signalId: string, authorAddress: string) {
  const protocolAddress = await resolveSemaphoreProtocolAddress();

  return [
    {
      chain: LIT_CHAIN,
      conditionType: "evmBasic" as const,
      contractAddress: "",
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: authorAddress,
      },
      standardContractType: "",
    },
    {
      operator: "or",
    },
    {
      chain: LIT_CHAIN,
      conditionType: "evmContract" as const,
      contractAddress: protocolAddress,
      functionAbi: {
        inputs: [
          {
            internalType: "uint256",
            name: "signalId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "reader",
            type: "address",
          },
        ],
        name: "hasActiveAccess",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      functionName: "hasActiveAccess",
      functionParams: [signalId, ":userAddress"],
      returnValueTest: {
        comparator: "=",
        key: "",
        value: "true",
      },
    },
  ];
}

async function buildResourceAbilityRequests(
  payload: EncryptedSignalJsonPayload,
): Promise<ResourceAbilityRequest[]> {
  if (!payload.unifiedAccessControlConditions) {
    throw new Error("缺少 Lit 解密条件，请重新生成这条信号。");
  }

  const resourceString = await LitAccessControlConditionResource.generateResourceString(
    payload.unifiedAccessControlConditions as never,
    payload.dataToEncryptHash,
  );

  return [
    {
      ability: ACCESS_CONTROL_DECRYPTION_ABILITY,
      resource: new LitAccessControlConditionResource(resourceString),
    },
  ];
}

export async function encryptSignalContent(
  params: {
    authorAddress: string;
    contentHtml: string;
    signalId: string;
  },
) {
  const litNodeClient = await getLitClient();
  const unifiedAccessControlConditions = await buildSignalAccessControlConditions(
    params.signalId,
    params.authorAddress,
  );
  const encryptedJson = await encryptToJson({
    chain: LIT_CHAIN,
    litNodeClient,
    string: JSON.stringify({
      contentHtml: params.contentHtml,
      version: SIGNAL_CONTENT_VERSION,
    }),
    unifiedAccessControlConditions,
  });

  const parsedPayload = JSON.parse(encryptedJson) as EncryptedSignalJsonPayload;

  if (parsedPayload.dataType !== "string") {
    throw new Error("Lit 加密结果格式异常，请重试。");
  }

  return parsedPayload;
}

export async function decryptSignalContent(
  walletClient: WalletClient,
  params: {
    encryptedCid: string;
  },
) {
  if (params.encryptedCid === PENDING_ENCRYPTED_CONTENT_CID) {
    throw new Error(
      "作者这条私密正文还没有成功上传。链上目前仍是占位内容，所以现在无法读取；需要作者重新发布，或由作者补传加密正文后才能打开。",
    );
  }

  const encryptedDocument = await getEncryptedSignalContent(params.encryptedCid);

  if (!encryptedDocument || encryptedDocument.kind !== "signal-private-encrypted") {
    throw new Error(
      "还没有找到这条信号的加密正文。可能是 IPFS 内容尚未上传成功，或作者发布时停在了中间状态。",
    );
  }

  const litNodeClient = await getLitClient();
  const resourceAbilityRequests = await buildResourceAbilityRequests(encryptedDocument.payload);
  const sessionSigs = await getSessionSigs(walletClient, resourceAbilityRequests);
  const decrypted = await decryptFromJson({
    litNodeClient,
    parsedJsonData: encryptedDocument.payload,
    sessionSigs,
  });

  if (typeof decrypted !== "string") {
    throw new Error("解密结果格式异常。");
  }

  const parsedPayload = JSON.parse(decrypted) as {
    contentHtml?: string;
    version?: number;
  };

  if (!parsedPayload.contentHtml) {
    throw new Error("正文内容为空，无法显示。");
  }

  return parsedPayload.contentHtml;
}
