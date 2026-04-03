import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

import { APP_URL, FUJI_RPC_URL, seamphoreChain } from "./deployment";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();

export const hasWalletConnectProjectId = Boolean(walletConnectProjectId);

const injectedConnectorOptions = {
  shimDisconnect: true,
  unstable_shimAsyncInject: 1_000,
} as const;

const connectors = [
  injected({
    ...injectedConnectorOptions,
    target: "metaMask",
  }),
  injected(injectedConnectorOptions),
  ...(hasWalletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId!,
          showQrModal: true,
        }),
        coinbaseWallet({
          appName: "Semaphore",
        }),
      ]
    : []),
] as const;

export const wagmiConfig = createConfig({
  chains: [seamphoreChain],
  connectors,
  ssr: false,
  transports: {
    [seamphoreChain.id]: http(FUJI_RPC_URL),
  },
});

export const queryClient = new QueryClient();

export { APP_URL };
