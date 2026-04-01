import { defineChain, getAddress, type Address } from "viem";

export const FUJI_RPC_URL =
  import.meta.env.VITE_RPC_URL?.trim() || "https://api.avax-test.network/ext/bc/C/rpc";
export const APP_URL = import.meta.env.VITE_APP_URL?.trim() || "http://localhost:5173";
const DEFAULT_SEMAPHORE_PROTOCOL_ADDRESS = "0xCAa24d48a29d5091B67FCD75D2794F732c7cC657";

export const seamphoreChain = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: {
    decimals: 18,
    name: "Avalanche",
    symbol: "AVAX",
  },
  rpcUrls: {
    default: {
      http: [FUJI_RPC_URL],
    },
    public: {
      http: [FUJI_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "SnowScan",
      url: "https://testnet.snowscan.xyz",
    },
  },
  testnet: true,
});

export async function resolveSemaphoreProtocolAddress(): Promise<Address> {
  return getAddress(
    import.meta.env.VITE_SEMAPHORE_PROTOCOL_ADDRESS?.trim() ||
      DEFAULT_SEMAPHORE_PROTOCOL_ADDRESS,
  );
}
