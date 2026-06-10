import { defineChain } from "viem";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] }
  },
  blockExplorers: {
    default: { name: "Shannon", url: "https://shannon-explorer.somnia.network" }
  },
  testnet: true
});

export const EXPLORER = "https://shannon-explorer.somnia.network";
export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${EXPLORER}/address/${addr}`;
export const explorerBlock = (n: number | string | bigint) => `${EXPLORER}/block/${n}`;
