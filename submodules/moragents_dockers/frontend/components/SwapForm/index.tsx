import React, { FC, useState, useMemo, useEffect, useCallback } from "react";
import {
  ApproveTxPayloadType,
  getApprovalTxPayload,
  getHttpClient,
  getSwapTxPayload,
  SwapMessagePayload,
  SwapTxPayloadType,
} from "../../services/backendClient";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
  HStack,
  VStack,
  IconButton,
  InputGroup,
  InputRightAddon,
} from "@chakra-ui/react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { erc20Abi, zeroAddress } from "viem";
import { oneInchNativeToken, routerAddress } from "../../config";
import { useSmartAccount } from "../../hooks/useSmartAccount";

export type SwapMessageLike =
  | {
      amount: string;
      dst: string;
      dst_address: string;
      dst_amount: string | number;
      quote: string;
      src: string;
      src_address: string;
      src_amount: number;
      interval: number;
    }
  | SwapMessagePayload;

export type SwapFormProps = {
  onSubmitSwap: (swapTx: SwapTxPayloadType) => void;
  onSubmitApprove(approveTx: ApproveTxPayloadType): void;
  onCancelSwap: (fromAction: number) => void;
  fromMessage: SwapMessageLike;
  selectedAgent: string;
  isActive: boolean;
};

type FormData = {
  amount: string;
  tokenAddress0: string;
  tokenAddress1: string;
  approvalTxPayload: ApproveTxPayloadType | null;
  swapTxPayload: SwapTxPayloadType | null;
  slippage: number;
  interval: number;
};

export const SwapForm: FC<SwapFormProps> = ({
  isActive,
  onSubmitSwap,
  onSubmitApprove,
  onCancelSwap,
  fromMessage,
  selectedAgent,
}) => {
  const chainId = useChainId();
  const [formData, setFormData] = useState<FormData>({
    amount: "",
    tokenAddress0: "",
    tokenAddress1: "",
    approvalTxPayload: null,
    swapTxPayload: null,
    slippage: 0.1,
    interval: 0, // Default interval set to 0ms (no recurring swaps)
  });
  const { smartAccountClient, smartAccountAddress } = useSmartAccount();

  const [isButtonLoading, setIsButtonLoading] = useState<boolean>(false);
  const [disableButtons, setDisableButtons] = useState<boolean>(false);

  // Helper function to format the interval
  const formatInterval = (
    intervalMs: number
  ): { value: number; unit: string } => {
    if (intervalMs >= 3600000) {
      let value = intervalMs / 3600000;
      return { value, unit: value == 1 ? "hour" : "hours" };
    } else if (intervalMs >= 60000) {
      let value = intervalMs / 60000;
      return { value, unit: value == 1 ? "minute" : "minutes" };
    } else {
      let value = intervalMs / 1000;
      return { value, unit: value == 1 ? "second" : "seconds" };
    }
  };
  const { value: intervalValue, unit: intervalUnit } = useMemo(
    () => formatInterval(fromMessage.interval),
    [fromMessage.interval]
  );

  const isNativeToken = useMemo(() => {
    const result =
      fromMessage.src_address.toLowerCase() ===
      oneInchNativeToken.toLowerCase();
    console.log(`Is native token: ${result}`);
    return result;
  }, [fromMessage.src_address]);

  const allowance = useReadContract({
    abi: erc20Abi,
    address: formData.tokenAddress0 as `0x${string}`,
    functionName: "allowance",
    args: [smartAccountAddress || zeroAddress, routerAddress],
  });

  const decimals = useReadContract({
    abi: erc20Abi,
    address: formData.tokenAddress0 as `0x${string}`,
    functionName: "decimals",
    args: [],
  });

  const isSwapOrApproval = useMemo(() => {
    return (
      isNativeToken ||
      (allowance.data &&
        BigInt(allowance.data) >=
          BigInt(
            parseFloat(String(formData.amount || 0)) *
              10 ** parseFloat(String(decimals?.data || "18"))
          ))
    );
  }, [allowance.data, isNativeToken, formData.amount, decimals?.data]);

  const handleCancelSwap = useCallback(() => {
    onCancelSwap(isSwapOrApproval ? 0 : 1);
    setDisableButtons(true);
  }, [onCancelSwap, isSwapOrApproval]);

  const handleSwap = useCallback(
    async (address: string) => {
      setIsButtonLoading(true);
      try {
        if (!smartAccountClient) {
          console.log("Smart account client not initialized");
          return;
        }
        const trx = [];
        if (!isNativeToken && !isSwapOrApproval) {
          const _payload_approve = await getApprovalTxPayload(
            getHttpClient(selectedAgent),
            chainId,
            fromMessage.src_address,
            Number(fromMessage.src_amount),
            decimals?.data || 18
          );
          const approveTx = {
            to: _payload_approve.data.response.to,
            data: _payload_approve.data.response.data,
          };
          trx.push(approveTx);
        }
        const _payload = await getSwapTxPayload(
          getHttpClient(selectedAgent),
          fromMessage.src_address,
          fromMessage.dst_address,
          address,
          Number(fromMessage.src_amount),
          formData.slippage,
          chainId,
          decimals?.data || 18
        );
        console.log("Swap payload generated", _payload);
        const trx2 = {
          to: _payload.tx.to,
          data: _payload.tx.data,
        };
        trx.push(trx2);
        const userOp = await smartAccountClient.buildUserOp(trx);
        console.log(userOp);
        const { wait } = await smartAccountClient.sendUserOp(userOp);
        const receipt = await wait();
        console.log(receipt);

        // todo: instead of logging have the onSubmitSwap success callback here
        // onSubmitSwap(_payload);
        setDisableButtons(true);
      } catch (e) {
        console.log(`Failed to generate Swap TX payload: ${e}`);
      } finally {
        setIsButtonLoading(false);
      }
    },
    [
      smartAccountClient,
      isNativeToken,
      isSwapOrApproval,
      selectedAgent,
      fromMessage.src_address,
      fromMessage.dst_address,
      fromMessage.src_amount,
      formData.slippage,
      chainId,
      decimals?.data,
    ]
  );

  useEffect(() => {
    setDisableButtons(false);
  }, [isSwapOrApproval]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      amount: fromMessage.src_amount.toString(),
      tokenAddress0: fromMessage.src_address,
      tokenAddress1: fromMessage.dst_address,
    }));
  }, [fromMessage]);

  return (
    <Box
      sx={{
        border: "1px solid #CCCECD",
        borderRadius: "8px",
        backgroundColor: "#111613",
        p: 3,
        mt: 4,
        ml: 2,
        mb: 4,
        overflow: "hidden",
        position: "relative",
        "& > *": {
          filter: !isActive ? "blur(8px)" : "none",
          pointerEvents: !isActive ? "none" : "auto",
        },
      }}
    >
      <form onSubmit={(e) => e.preventDefault()}>
        <VStack>
          <HStack width="full" justifyContent="space-between">
            <Box flex="1" w={"10%"} pr={2} borderRight={`1px solid #CCCECD`}>
              <VStack>
                <Text>You pay</Text>
                <HStack>
                  <Text
                    sx={{
                      color: "#9A9C9B",
                      fontSize: "16px",
                      fontStyle: "normal",
                      fontWeight: 400,
                      lineHeight: "125 %",
                    }}
                  >
                    {fromMessage.src_amount}
                  </Text>
                  <Text>{fromMessage.src}</Text>
                </HStack>
              </VStack>
            </Box>
            <Box flex="1" pl={2} borderRight={`1px solid #CCCECD`}>
              <VStack>
                <Text>You receive</Text>
                <HStack>
                  <Text
                    sx={{
                      color: "#9A9C9B",
                      fontSize: "16px",
                      fontStyle: "normal",
                      fontWeight: 400,
                      lineHeight: "125 %",
                    }}
                  >
                    {parseFloat(String(fromMessage.dst_amount)).toFixed(4)}
                  </Text>
                  <Text>{fromMessage.dst}</Text>
                </HStack>
              </VStack>
            </Box>
            {fromMessage.interval != 0 ? (
              <Box flex="1" pr={2}>
                <VStack>
                  <Text>Swap every</Text>
                  <HStack>
                    <Text
                      sx={{
                        color: "#9A9C9B",
                        fontSize: "16px",
                        fontStyle: "normal",
                        fontWeight: 400,
                        lineHeight: "125 %",
                      }}
                    >
                      {intervalValue.toFixed(2)}
                    </Text>
                    <Text>{intervalUnit}</Text>
                  </HStack>
                  <Text
                    sx={{
                      color: "#676B68",
                      fontSize: "10px",
                    }}
                  >
                    Powered by Biconomy
                  </Text>
                </VStack>
              </Box>
            ) : (
              <Box flex="1" pr={2}>
                <FormControl>
                  <HStack mb={1}>
                    <Text
                      sx={{
                        fontSize: "16px",
                      }}
                    >
                      Slippage
                    </Text>
                  </HStack>
                  <InputGroup
                    sx={{
                      backgroundColor: "#111613",
                      borderRadius: "8px",
                      border: "1px solid #676B68",
                    }}
                  >
                    <Input
                      sx={{
                        border: "none",
                        color: "white",
                      }}
                      type="number"
                      value={formData.slippage}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          slippage: parseFloat(e.target.value),
                        }))
                      }
                    />
                    <InputRightAddon
                      sx={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#9A9C9B",
                      }}
                    />
                    %
                  </InputGroup>

                  <Text
                    sx={{
                      color: "#676B68",
                      fontSize: "10px",
                    }}
                  >
                    Using 1 inch
                  </Text>
                </FormControl>
              </Box>
            )}

            <Box
              flex="1"
              alignItems={"center"}
              justifyContent={"center"}
              pl={4}
            >
              <VStack>
                <Button
                  isLoading={isButtonLoading}
                  variant={"greenCustom"}
                  w={"100%"}
                  type="submit"
                  onClick={() => handleSwap(smartAccountAddress || "")}
                  colorScheme="blue"
                  sx={{
                    pointerEvents: disableButtons ? "none" : "auto",
                    textColor: disableButtons ? "#9A9C9B" : "#020804",
                  }}
                >
                  Swap
                </Button>
                )
                <Button
                  variant={"ghost"}
                  w={"100%"}
                  sx={{
                    fontSize: "14px",
                    color: "#FFFFFF",
                    fontWeight: 500,
                    fontFamily: "Inter",
                    "&:hover": {
                      backgroundColor: "transparent",
                      color: "#59F886",
                    },
                    pointerEvents: disableButtons ? "none" : "auto",
                    textColor: disableButtons ? "#9A9C9B" : "innerhit",
                  }}
                  onClick={handleCancelSwap}
                >
                  Cancel
                </Button>
              </VStack>
            </Box>
          </HStack>
        </VStack>
      </form>
    </Box>
  );
};
