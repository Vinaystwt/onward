import { http, createConfig, createStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { somniaTestnet } from "./chain";

// Configure the public RPC transport with a sane timeout and batched JSON RPC, so
// any wallet that exposes only a slow injected provider still gets fast reads via
// the public Somnia endpoint, and reads never hang the UI forever.
const transport = http(somniaTestnet.rpcUrls.default.http[0], {
  timeout: 12_000,
  retryCount: 1,
  retryDelay: 600,
  batch: { batchSize: 256, wait: 12 }
});

export const wagmiConfig = createConfig({
  chains: [somniaTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [somniaTestnet.id]: transport
  },
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined
  }),
  ssr: false,
  multiInjectedProviderDiscovery: true
});
