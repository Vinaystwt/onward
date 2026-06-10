import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { somniaTestnet } from "@/config/chain";
import { shortAddr } from "@/lib/format";
import { motion } from "framer-motion";

export function WalletPill() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const onWrongChain = isConnected && chainId !== somniaTestnet.id;

  const primary = connectors[0];

  if (!isConnected) {
    return (
      <button
        type="button"
        className="btn-primary text-sm"
        disabled={isPending || !primary}
        onClick={() => primary && connect({ connector: primary })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (onWrongChain) {
    return (
      <button
        type="button"
        className="btn-primary text-sm bg-signal-amber text-ink"
        onClick={() => switchChain({ chainId: somniaTestnet.id })}
      >
        Switch to Somnia
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={() => disconnect()}
      className="pill pill-brand num text-xs hover:bg-brand/20"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      title="Disconnect"
    >
      <span className="h-2 w-2 rounded-full bg-signal-mint" />
      {shortAddr(address)}
    </motion.button>
  );
}
