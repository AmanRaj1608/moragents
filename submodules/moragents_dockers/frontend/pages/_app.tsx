import "../styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { AppProps } from "next/app";
import {
  ChakraProvider,
  defineStyleConfig,
  extendTheme,
} from "@chakra-ui/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
  bsc,
} from "wagmi/chains";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import "./../styles/globals.css";
import { BiconomyProvider } from "../providers/BiconomyProvider";

const config = getDefaultConfig({
  appName: "RainbowKit App",
  projectId: "YOUR_PROJECT_ID",
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    bsc,
    // ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
  ],
  ssr: true,
});

const ButtonStyles = defineStyleConfig({
  variants: {
    greenCustom: {
      fontFamily: "Inter",
      fontSize: "16px",
      background: "#59F886",
      borderRadius: "24px",
      color: "#020804",
      "&:hover": {
        background: "#59F886",
        color: "#020804",
        transform: "scale(1.05)",
        boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)",
        border: "1px solid #59F886",
      },
    },
  },
});

const theme = extendTheme({
  initialColorMode: "dark",
  useSystemColorMode: false,
  colors: {
    header: "#020804",
    "pop-up-bg": "#1C201D",
  },
  components: {
    Button: ButtonStyles,
  },
  Text: {
    baseStyle: {
      fontFamily: "Inter",
      fontSize: "16px",
      color: "var(--dark-text-90, rgba(255, 255, 255, 0.90))",
    },
  },
});

const client = new QueryClient();
const biconomyPaymasterApiKey =
  process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY || "0SK8K7G7P.dcd425b3-68d5-4e90-9bee-40257381db7e";
const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL || "https://bundler.biconomy.io/api/v2/8453/0SK8K7G7P.dcd425b3-68d5-4e90-9bee-40257381db7e";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#111613",
            accentColorForeground: "white",
            borderRadius: "small",
            fontStack: "system",
            overlayBlur: "small",
          })}
        >
          <BiconomyProvider
            config={{
              biconomyPaymasterApiKey,
              bundlerUrl,
            }}
            queryClient={client}
          >
            <ChakraProvider theme={theme}>
              <Component {...pageProps} />
            </ChakraProvider>
          </BiconomyProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp;
