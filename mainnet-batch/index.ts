import { config as dotenv } from "dotenv";
import {
  createWalletClient,
  http,
  getContract,
  erc20Abi,
  parseUnits,
  maxUint256,
  publicActions,
  Hex,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { wethAbi } from "./abi/weth-abi";

// load env vars
dotenv();
const { PRIVATE_KEY, ZERO_EX_API_KEY, BLINK_URL } =
  process.env;

// validate requirements
if (!PRIVATE_KEY) throw new Error("missing PRIVATE_KEY.");
if (!ZERO_EX_API_KEY) throw new Error("missing ZERO_EX_API_KEY.");
if (!BLINK_URL)
  throw new Error("missing BLINK_URL.");

const main = async () => {
  // specify sell amount
  // USDC supports gasless approvals because it is an ERC-20 that supports the Permit function
  const sellAmount = parseUnits("80", await usdc.read.decimals());

  // 1. fetch price
  const priceParams = new URLSearchParams({
    chainId: client.chain.id.toString(),
    sellToken: usdc.address,
    buyToken: weth.address,
    sellAmount: sellAmount.toString(),
    taker: client.account.address,
  });

  const priceUrl = "https://api.0x.org/swap/allowance-holder/price?" + priceParams.toString();
  const priceResponse = await fetch(priceUrl, { headers });
  const price = await fetchJsonOrThrow(priceResponse);

  console.log("Fetching price to swap 100 USDC for WETH with Swap API (AllowanceHolder)\n");
  console.log(priceUrl + "\n");
  console.log("priceResponse: ", price, "\n");

  // 2. fetch quote
  const quoteParams = new URLSearchParams({ taker: client.account.address });
  for (const [key, value] of priceParams.entries())
    quoteParams.append(key, value);

  const quoteUrl = "https://api.0x.org/swap/allowance-holder/quote?" + quoteParams.toString();
  const quoteResponse = await fetch(quoteUrl, { headers });
  const quote = await fetchJsonOrThrow(quoteResponse);

  console.log("Fetching quote to swap 100 USDC for WETH with Swap API (AllowanceHolder)\n");
  console.log("quoteResponse: ", quote, "\n");

  // 3. Check if token approval is required
  const tokenApprovalRequired = quote.issues?.allowance != null;

  console.log("tokenApprovalRequired: ", tokenApprovalRequired);

  // Get current nonce and gas price
  const nonce = await client.getTransactionCount({ address: account.address });
  const gasPrice = await client.getGasPrice();
  const priorityFee = 100000000n;

  console.log("Current nonce:", nonce);
  console.log("Gas price:", gasPrice);

  if (tokenApprovalRequired) {
    // Batch both approval and swap transactions together
    await executeBatchedTrade(nonce, gasPrice, priorityFee);
  } else {
    // Only swap transaction needed
    await executeSwapOnly(nonce, gasPrice, priorityFee);
  }

  async function executeBatchedTrade(baseNonce: number, gasPrice: bigint, priorityFee: bigint) {
    try {
      // Prepare approval transaction
      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [quote.issues.allowance.spender, maxUint256],
      });

      const approvalTxRequest = {
        to: usdc.address,
        data: approvalData,
        value: 0n,
        gas: 60000n,
        maxFeePerGas: gasPrice + priorityFee,
        maxPriorityFeePerGas: priorityFee,
        nonce: baseNonce,
        chainId: mainnet.id,
        type: 'eip1559' as const,
      };

      // Prepare swap transaction
      const transaction = quote.transaction;
      const swapTxRequest = {
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: BigInt(transaction.value || 0),
        gas: BigInt(transaction.gas),
        maxFeePerGas: gasPrice + priorityFee,
        maxPriorityFeePerGas: priorityFee,
        nonce: baseNonce + 1, // Increment nonce for second transaction
        chainId: mainnet.id,
        type: 'eip1559' as const,
      };

      console.log("\n--- Prepared Transactions ---");
      console.log("Approval tx (nonce:", baseNonce, "):", {
        to: approvalTxRequest.to,
        data: approvalTxRequest.data.slice(0, 66) + "...",
      });
      console.log("Swap tx (nonce:", baseNonce + 1, "):", {
        to: swapTxRequest.to,
        data: swapTxRequest.data.slice(0, 66) + "...",
      });

      // Step 1: Batch check if both transactions are sponsorable
      const approvalSponsorableParams: IsSponsorableParams = {
        to: approvalTxRequest.to,
        from: account.address,
        value: `0x${approvalTxRequest.value.toString(16)}`,
        data: approvalTxRequest.data,
        gas: `0x${approvalTxRequest.gas.toString(16)}`,
      };

      const swapSponsorableParams: IsSponsorableParams = {
        to: swapTxRequest.to,
        from: account.address,
        value: `0x${swapTxRequest.value.toString(16)}`,
        data: swapTxRequest.data,
        gas: `0x${swapTxRequest.gas.toString(16)}`,
      };

      console.log("\n--- Checking sponsorability (batched) ---");
      const sponsorableResults = await batchIsSponsorable([
        approvalSponsorableParams,
        swapSponsorableParams,
      ]);

      const [approvalSponsorable, swapSponsorable] = sponsorableResults;
      console.log("Approval sponsorable:", approvalSponsorable);
      console.log("Swap sponsorable:", swapSponsorable);

      if (!approvalSponsorable || !swapSponsorable) {
        console.log("One or more transactions are not sponsorable, skipping...");
        if (!approvalSponsorable) console.log("  - Approval transaction not sponsorable");
        if (!swapSponsorable) console.log("  - Swap transaction not sponsorable");
        return;
      }

      // Step 2: Sign both transactions
      console.log("\n--- Signing transactions ---");
      const signedApprovalTx = await account.signTransaction(approvalTxRequest);
      const signedSwapTx = await account.signTransaction(swapTxRequest);

      console.log("Signed approval tx:", signedApprovalTx.slice(0, 66) + "...");
      console.log("Signed swap tx:", signedSwapTx.slice(0, 66) + "...");

      // Step 3: Batch send both raw transactions
      console.log("\n--- Submitting transactions (batched) ---");
      const sendResults = await batchSendRawTransactions([signedApprovalTx, signedSwapTx]);

      const [approvalResult, swapResult] = sendResults;

      if (approvalResult.error) {
        console.log("Approval transaction failed:", approvalResult.error);
      } else {
        console.log("Approval tx hash:", approvalResult.hash);
      }

      if (swapResult.error) {
        console.log("Swap transaction failed:", swapResult.error);
      } else {
        console.log("Swap tx hash:", swapResult.hash);
      }

      // Wait for confirmations
      if (approvalResult.hash && swapResult.hash) {
        console.log("\n--- Waiting for confirmations ---");
        const [approvalReceipt, swapReceipt] = await Promise.all([
          client.waitForTransactionReceipt({ hash: approvalResult.hash }),
          client.waitForTransactionReceipt({ hash: swapResult.hash }),
        ]);

        console.log("Approval confirmed in block:", approvalReceipt.blockNumber);
        console.log("Swap confirmed in block:", swapReceipt.blockNumber);

        if (approvalReceipt.blockNumber === swapReceipt.blockNumber) {
          console.log("\nBoth transactions landed in the same block!");
        }

        console.log("\nSwap completed successfully!");
        console.log("Approval tx:", approvalResult.hash);
        console.log("Swap tx:", swapResult.hash);
      }
    } catch (error) {
      console.error("Error executing batched trade:", error);
    }
  }

  async function executeSwapOnly(baseNonce: number, gasPrice: bigint, priorityFee: bigint) {
    try {
      const transaction = quote.transaction;
      const swapTxRequest = {
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: BigInt(transaction.value || 0),
        gas: BigInt(transaction.gas),
        maxFeePerGas: gasPrice + priorityFee,
        maxPriorityFeePerGas: priorityFee,
        nonce: baseNonce,
        chainId: mainnet.id,
        type: 'eip1559' as const,
      };

      console.log("\n--- Prepared Swap Transaction ---");
      console.log("Swap tx (nonce:", baseNonce, "):", {
        to: swapTxRequest.to,
        data: swapTxRequest.data.slice(0, 66) + "...",
      });

      // Check if sponsorable
      const swapSponsorableParams: IsSponsorableParams = {
        to: swapTxRequest.to,
        from: account.address,
        value: `0x${swapTxRequest.value.toString(16)}`,
        data: swapTxRequest.data,
        gas: `0x${swapTxRequest.gas.toString(16)}`,
      };

      console.log("\n--- Checking sponsorability ---");
      const sponsorableResults = await batchIsSponsorable([swapSponsorableParams]);

      if (!sponsorableResults[0]) {
        console.log("Swap transaction is not sponsorable, skipping...");
        return;
      }

      console.log("Swap sponsorable:", sponsorableResults[0]);

      // Sign and send
      console.log("\n--- Signing transaction ---");
      const signedSwapTx = await account.signTransaction(swapTxRequest);
      console.log("Signed swap tx:", signedSwapTx.slice(0, 66) + "...");

      console.log("\n--- Submitting transaction ---");
      const sendResults = await batchSendRawTransactions([signedSwapTx]);

      const swapResult = sendResults[0];

      if (swapResult.error) {
        console.log("Swap transaction failed:", swapResult.error);
        return;
      }

      console.log("Swap tx hash:", swapResult.hash);

      // Wait for confirmation
      if (swapResult.hash) {
        console.log("\n--- Waiting for confirmation ---");
        const swapReceipt = await client.waitForTransactionReceipt({ hash: swapResult.hash });
        console.log("Swap confirmed in block:", swapReceipt.blockNumber);
        console.log("\nSwap completed successfully!");
        console.log("Swap tx:", swapResult.hash);
      }
    } catch (error) {
      console.error("Error executing swap:", error);
    }
  }
};

// fetch headers (shared)
const headers = new Headers({
  "Content-Type": "application/json",
  "0x-api-key": ZERO_EX_API_KEY!,
  "0x-version": "v2",
});

// setup wallet client
const account = privateKeyToAccount(("0x" + PRIVATE_KEY) as `0x${string}`);

const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(BLINK_URL + "?sponsorship=true"),
}).extend(publicActions); // extend wallet client with publicActions for public client

// set up contracts
const usdc = getContract({
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 on base
  abi: erc20Abi,
  client,
});

const weth = getContract({
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // 0x4200000000000000000000000000000000000006 on base
  abi: wethAbi,
  client,
});

// Small helper to safely parse JSON (and surface non-JSON errors)
async function fetchJsonOrThrow(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.includes("application/json")) {
    const bodyText = await res.text().catch(() => "<unreadable body>");
    throw new Error(
      `HTTP ${res.status} ${res.statusText}\n` +
        `Content-Type: ${ct}\n` +
        `Body:\n${bodyText}`
    );
  }
  return res.json();
}

// Type for sponsorable params
type IsSponsorableParams = {
  to: string;
  from: string;
  value: string;
  data: string;
  gas: string;
}

// Batched pm_isSponsorable check for multiple transactions
const batchIsSponsorable = async (txParamsArray: IsSponsorableParams[]): Promise<boolean[]> => {
  const batchRequest = txParamsArray.map((params, index) => ({
    jsonrpc: "2.0",
    method: "pm_isSponsorable",
    params: [params],
    id: index,
  }));

  console.log("Batched pm_isSponsorable request:", JSON.stringify(batchRequest, null, 2));

  const response = await fetch(BLINK_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batchRequest),
  });

  const results = await response.json();
  console.log("Batched pm_isSponsorable response:", JSON.stringify(results, null, 2));

  // Sort by id to ensure correct order
  const sortedResults = Array.isArray(results)
    ? results.sort((a: any, b: any) => a.id - b.id)
    : [results];

  return sortedResults.map((result: any) => result.result?.sponsorable ?? false);
};

// Batched eth_sendRawTransaction for multiple signed transactions
const batchSendRawTransactions = async (signedTxs: Hex[]): Promise<{ hash: Hex | null; error: any }[]> => {
  const batchRequest = signedTxs.map((signedTx, index) => ({
    jsonrpc: "2.0",
    method: "eth_sendRawTransaction",
    params: [signedTx],
    id: index,
  }));

  console.log("Batched eth_sendRawTransaction request with", signedTxs.length, "transactions");

  const response = await fetch(BLINK_URL! + "?sponsorship=true", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batchRequest),
  });

  const results = await response.json();
  console.log("Batched eth_sendRawTransaction response:", JSON.stringify(results, null, 2));

  // Sort by id to ensure correct order
  const sortedResults = Array.isArray(results)
    ? results.sort((a: any, b: any) => a.id - b.id)
    : [results];

  return sortedResults.map((result: any) => ({
    hash: result.result ?? null,
    error: result.error ?? null,
  }));
};


main();