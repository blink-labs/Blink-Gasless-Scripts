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
import { bsc } from "viem/chains";
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

// fetch headers (shared)
const headers = new Headers({
  "Content-Type": "application/json",
  "0x-api-key": ZERO_EX_API_KEY!,
  "0x-version": "v2",
});

// setup wallet client
const client = createWalletClient({
  account: privateKeyToAccount(("0x" + PRIVATE_KEY) as `0x${string}`),
  chain: bsc,
  transport: http(BLINK_URL + "?sponsorship=true"),
}).extend(publicActions); // extend wallet client with publicActions for public client

// set up contracts
const usdToken = getContract({
  address: "0x55d398326f99059fF775485246999027B3197955",
  abi: erc20Abi,
  client,
});

const weth = getContract({
  address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", 
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

const main = async () => {
  // specify sell amount
  // USDC supports gasless approvals because it is an ERC-20 that supports the Permit function
  const sellAmount = parseUnits("100", await usdToken.read.decimals());

  // 1. fetch price
  const priceParams = new URLSearchParams({
    chainId: client.chain.id.toString(),
    sellToken: usdToken.address,
    buyToken: weth.address,
    sellAmount: sellAmount.toString(),
    taker: client.account.address,
  });

  const priceUrl = "https://api.0x.org/swap/allowance-holder/price?" + priceParams.toString();
  const priceResponse = await fetch(priceUrl, { headers });
  const price = await fetchJsonOrThrow(priceResponse);

  console.log("Fetching price to swap 0.1 USD for WBNB with Swap API (AllowanceHolder)\n");
  console.log(priceUrl + "\n");
  console.log("🏷 priceResponse: ", price, "\n");

  // 2. fetch quote
  const quoteParams = new URLSearchParams({ taker: client.account.address });
  for (const [key, value] of priceParams.entries())
    quoteParams.append(key, value);

  const quoteUrl = "https://api.0x.org/swap/allowance-holder/quote?" + quoteParams.toString();
  const quoteResponse = await fetch(quoteUrl, { headers });
  const quote = await fetchJsonOrThrow(quoteResponse);

  console.log("Fetching quote to swap 0.1 USD for WBNB with Swap API (AllowanceHolder)\n");
  console.log("💸 quoteResponse: ", quote, "\n");

  // 3. Check if token approval is required
  const tokenApprovalRequired = quote.issues?.allowance != null;

  console.log("🪙 tokenApprovalRequired: ", tokenApprovalRequired);

  let successfulTradeHash: any = null;

  successfulTradeHash = await executeTrade(tokenApprovalRequired);

  async function executeTrade(tokenApprovalRequired: boolean) {
    // Handle token approval if needed
    if (tokenApprovalRequired) {
      await standardApproval();
    }

    // Submit the swap transaction
    const tradeHash = await submitTrade();
    return tradeHash;
  }

  // Handle standard approval for AllowanceHolder
  async function standardApproval(): Promise<any> {
    if (quote.issues.allowance !== null) {
      try {
        // Encode the approve function call
        const approvalData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [quote.issues.allowance.spender, maxUint256],
        });
        
        console.log("Approving AllowanceHolder to spend USDC...");
        
        // Create approval transaction params
        const approvalTxParams = {
          to: usdToken.address,
          data: approvalData,
          gas: 60000n,
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
          account: client.account,
          chain: client.chain,
        };
        
        // Sign and send the approval transaction
        const hash = await client.sendTransaction(approvalTxParams);
        console.log(
          "Approved AllowanceHolder to spend USDC.",
          await client.waitForTransactionReceipt({ hash })
        );
      } catch (error) {
        console.log("Error approving AllowanceHolder:", error);
      }
    } else {
      console.log("USDC already approved for AllowanceHolder");
    }
  }

  // 4. Submit the transaction via RPC (AllowanceHolder doesn't need extra signatures)
  async function submitTrade(): Promise<string | undefined> {
    try {
      const transaction = quote.transaction;
      
      console.log("📝 Transaction to sign:", {
        to: transaction.to,
        data: transaction.data.slice(0, 66) + "...",
        value: transaction.value,
        gas: transaction.gas,
        gasPrice: transaction.gasPrice,
      });

      // Send transaction params
      const sendTransactionParams = {
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: BigInt(transaction.value || 0),
        gas: BigInt(transaction.gas),
        gasPrice: 0n,
        account: client.account,
        chain: client.chain,
      }

      console.log("sendTransactionParams", sendTransactionParams);

      const isSponsorableResult = await isSponsorable(sendTransactionParams);
      if (!isSponsorableResult) {
        console.log("❌ Transaction is not sponsorable, skipping...");
        return;
      }

      // Sign and send the transaction via your RPC endpoint
      const txHash = await client.sendTransaction(sendTransactionParams);

      console.log("✅ Transaction submitted!");
      console.log("#️⃣ txHash:", txHash);
      
      // Wait for transaction receipt
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.log("🎉 Transaction confirmed in block:", receipt.blockNumber);
      
      return txHash;
    } catch (error) {
      console.error("Error submitting the swap transaction\n", error);
    }
  }

  // Transaction is already confirmed in submitTrade function
  if (successfulTradeHash) {
    console.log("✅ Swap completed successfully!");
    console.log("Transaction hash:", successfulTradeHash);
  } else {
    console.log("❌ Swap failed or was cancelled.");
  }
};

const isSponsorable = async (sendTransactionParams: any): Promise<boolean> => {
  type IsSponsorableParams = {
    to: string;
    from: string;
    value: string;
    data: string;
    gas: string;
  }

  const sponsorableParams: IsSponsorableParams = {
    "to": sendTransactionParams.to,
    "from": client.account.address,
    "value": `0x${sendTransactionParams.value.toString(16)}`,
    "data": sendTransactionParams.data as `0x${string}`,
    "gas": `0x${sendTransactionParams.gas.toString(16)}`
  } 

  console.log("sponsorableParams", sponsorableParams);

  const params = {
    "jsonrpc": "2.0",
    "method": "pm_isSponsorable", 
    "params": [sponsorableParams],
    "id": 0
  }
  const response = await fetch(BLINK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  console.log("data", data);  
  return data.result?.sponsorable ?? false;
}

main();