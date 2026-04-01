import React from "react";
import ReactDOM from "react-dom/client";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import "./polyfills";
import App from "./App";
import { AppStateProvider } from "./state/AppStateContext";
import { queryClient, rainbowKitTheme, wagmiConfig } from "./web3/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowKitTheme}>
          <AppStateProvider>
            <App />
          </AppStateProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
