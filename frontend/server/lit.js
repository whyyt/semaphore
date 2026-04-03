const LIT_CHAIN = "fuji";
const DEFAULT_SEMAPHORE_PROTOCOL_ADDRESS = "0xf38041633a68B25Efa4ed15181061d9b4844663F";
const DEFAULT_LIT_NETWORK = "datil-dev";
const DEFAULT_LIT_RPC_URL = "https://yellowstone-rpc.litprotocol.com";
const DEFAULT_LIT_CONNECT_TIMEOUT_MS = 60000;
const SIGNAL_CONTENT_VERSION = 1;
const YELLOWSTONE_NETWORK = {
  chainId: 175188,
  name: "yellowstone",
};

let litClientPromise = null;
let litNodeClientClassPromise = null;
let encryptToJsonPromise = null;
let ethersPromise = null;
let litContractsPromise = null;

async function loadLitNodeClientNodeJs() {
  if (!litNodeClientClassPromise) {
    litNodeClientClassPromise = import("@lit-protocol/lit-node-client-nodejs")
      .then((module) => module.LitNodeClientNodeJs)
      .catch((error) => {
        litNodeClientClassPromise = null;
        throw error;
      });
  }

  return litNodeClientClassPromise;
}

async function loadEncryptToJson() {
  if (!encryptToJsonPromise) {
    encryptToJsonPromise = import("@lit-protocol/encryption")
      .then((module) => module.encryptToJson)
      .catch((error) => {
        encryptToJsonPromise = null;
        throw error;
      });
  }

  return encryptToJsonPromise;
}

async function loadEthers() {
  if (!ethersPromise) {
    ethersPromise = import("ethers")
      .then((module) => module.ethers ?? module.default?.ethers ?? module.default)
      .catch((error) => {
        ethersPromise = null;
        throw error;
      });
  }

  return ethersPromise;
}

async function loadLitContracts() {
  if (!litContractsPromise) {
    litContractsPromise = import("@lit-protocol/contracts")
      .catch((error) => {
        litContractsPromise = null;
        throw error;
      });
  }

  return litContractsPromise;
}

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

function getLitRpcUrl() {
  return (
    process.env.LIT_RPC_URL?.trim() ||
    process.env.VITE_LIT_RPC_URL?.trim() ||
    DEFAULT_LIT_RPC_URL
  );
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

function getStaticContractsKey(litNetwork) {
  if (litNetwork === "datil") {
    return "datil";
  }

  if (litNetwork === "datil-test") {
    return "datilTest";
  }

  return "datilDev";
}

function normalizeContractContext(dataset, provider) {
  if (!dataset || typeof dataset !== "object" || !Array.isArray(dataset.data)) {
    throw new Error("Lit 合约静态配置缺失，无法初始化服务端 Lit。");
  }

  const contractContext = {
    provider,
  };

  for (const contract of dataset.data) {
    const firstContract = contract?.contracts?.[0];

    if (!contract?.name || !firstContract?.address_hash || !firstContract?.ABI) {
      continue;
    }

    contractContext[contract.name] = {
      abi: firstContract.ABI,
      address: firstContract.address_hash,
    };
  }

  return contractContext;
}

async function buildLitClientOptions() {
  const litNetwork = getLitNetworkValue();
  const rpcUrl = getLitRpcUrl();
  const [ethers, contractsModule] = await Promise.all([loadEthers(), loadLitContracts()]);
  const dataset = contractsModule[getStaticContractsKey(litNetwork)];
  const provider = new ethers.providers.StaticJsonRpcProvider(
    {
      skipFetchSetup: true,
      url: rpcUrl,
    },
    YELLOWSTONE_NETWORK,
  );

  return {
    connectTimeout: getLitConnectTimeout(),
    contractContext: normalizeContractContext(dataset, provider),
    litNetwork,
    rpcUrl,
  };
}

async function getLitServerClient() {
  if (!litClientPromise) {
    litClientPromise = (async () => {
      try {
        const LitNodeClientNodeJs = await loadLitNodeClientNodeJs();
        const litClient = new LitNodeClientNodeJs(await buildLitClientOptions());

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
  const encryptToJson = await loadEncryptToJson();
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
