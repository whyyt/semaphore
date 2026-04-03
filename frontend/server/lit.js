import { encryptToJson } from "@lit-protocol/encryption";
import { LitNodeClientNodeJs } from "@lit-protocol/lit-node-client-nodejs";

const LIT_CHAIN = "fuji";
const DEFAULT_SEMAPHORE_PROTOCOL_ADDRESS = "0xf38041633a68B25Efa4ed15181061d9b4844663F";
const DEFAULT_LIT_NETWORK = process.env.NODE_ENV === "production" ? "datil-test" : "datil-dev";
const DEFAULT_LIT_CONNECT_TIMEOUT_MS = 60000;
const SIGNAL_CONTENT_VERSION = 1;

let litClientPromise = null;

function getLitNetworkValue() {
  const configuredNetwork = process.env.LIT_NETWORK?.trim() || process.env.VITE_LIT_NETWORK?.trim();

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
  const raw =
    process.env.LIT_CONNECT_TIMEOUT_MS?.trim() || process.env.VITE_LIT_CONNECT_TIMEOUT_MS?.trim();

  if (!raw) {
    return DEFAULT_LIT_CONNECT_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIT_CONNECT_TIMEOUT_MS;
  }

  return parsed;
}

function explainLitConnectionError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("ERR_CONNECTION_CLOSED") ||
    message.includes("ERR_TIMED_OUT") ||
    message.includes("Could not handshake with nodes after timeout") ||
    message.includes("Could only connect to 0 of")
  ) {
    return new Error(
      "无法连接 Lit 节点网络。当前发布流程已经改为通过服务端连接 Lit；如果这里仍失败，说明不是浏览器代理问题，而是部署环境到 Lit 节点的链路本身不稳定。请优先检查 LIT_NETWORK / VITE_LIT_NETWORK 配置，并尝试改用 datil-dev 或增大 LIT_CONNECT_TIMEOUT_MS。",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

function resolveSemaphoreProtocolAddress() {
  return (
    process.env.SEMAPHORE_PROTOCOL_ADDRESS?.trim() ||
    process.env.VITE_SEMAPHORE_PROTOCOL_ADDRESS?.trim() ||
    DEFAULT_SEMAPHORE_PROTOCOL_ADDRESS
  );
}

async function getLitServerClient() {
  if (!litClientPromise) {
    litClientPromise = (async () => {
      try {
        const litClient = new LitNodeClientNodeJs({
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

function buildSignalAccessControlConditions(signalId, authorAddress) {
  return [
    {
      chain: LIT_CHAIN,
      conditionType: "evmBasic",
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
      conditionType: "evmContract",
      contractAddress: resolveSemaphoreProtocolAddress(),
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

export async function handleLitReadyRequest() {
  await getLitServerClient();
  return {
    ok: true,
  };
}

export async function handleLitEncryptRequest(rawBody) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new Error("加密请求缺少正文内容。");
  }

  const { authorAddress, contentHtml, signalId } = rawBody;

  if (typeof authorAddress !== "string" || !authorAddress.trim()) {
    throw new Error("加密请求缺少 authorAddress。");
  }

  if (typeof contentHtml !== "string" || !contentHtml.trim()) {
    throw new Error("加密请求缺少 contentHtml。");
  }

  if (typeof signalId !== "string" || !signalId.trim()) {
    throw new Error("加密请求缺少 signalId。");
  }

  const litNodeClient = await getLitServerClient();
  const unifiedAccessControlConditions = buildSignalAccessControlConditions(
    signalId,
    authorAddress,
  );
  const encryptedJson = await encryptToJson({
    chain: LIT_CHAIN,
    litNodeClient,
    string: JSON.stringify({
      contentHtml,
      version: SIGNAL_CONTENT_VERSION,
    }),
    unifiedAccessControlConditions,
  });

  const payload = JSON.parse(encryptedJson);

  if (payload.dataType !== "string") {
    throw new Error("Lit 加密结果格式异常，请重试。");
  }

  return {
    payload,
  };
}
