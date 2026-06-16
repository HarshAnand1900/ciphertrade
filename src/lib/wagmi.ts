import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "CipherTrade",
  projectId: "4dda726cc01f3e5be0450a334ed3bb8d", // get free one at cloud.walletconnect.com
  chains: [sepolia],
  ssr: true,
});