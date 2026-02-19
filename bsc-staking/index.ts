import { ethers, JsonRpcProvider, parseEther, toNumber, Transaction } from "ethers";

import dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.API_KEY;
const provider = new JsonRpcProvider(
  `https://bsc.blinklabs.xyz/v1/${apiKey}`
);

const wallet = ethers.Wallet.createRandom().connect(provider)
console.log("New wallet address:", wallet.address);
console.log("Creating gasless transaction...");
console.log("--------------------------------");

const createTransaction = async () => {
  const tx = new Transaction();
  tx.to= "0xBF45a2e9bBa728037A714380899fd7C4ee587312";
  tx.data = "0x6e553f65000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000f61a32aaf6cc01e481a914763eef950d32fc73d5";
  tx.value = parseEther("0");
  tx.nonce = 0;
  tx.gasLimit = 500000;
  tx.maxFeePerGas = 0;
  tx.maxPriorityFeePerGas = 0;
  tx.chainId = 56;
  return tx;
};

const isSponsorable = async (tx: Transaction) => {
  const params = {
    "jsonrpc": "2.0",
    "method": "pm_isSponsorable", 
    "params": [
      {
        "to": tx.to,
        "from": wallet.address, 
        "value": ethers.toQuantity(tx.value),
        "data": tx.data,
        "gas": ethers.toQuantity(tx.gasLimit)
      }
    ],
    "id": 0
  };
  
  return await provider.send("pm_isSponsorable", params.params);
};

async function main() {
  const tx = await createTransaction();
  const isSponsorableResult = await isSponsorable(tx);
  console.log("Is sponsorable:", isSponsorableResult.sponsorable);
  if (!isSponsorableResult.sponsorable) {
    console.log("Transaction is not sponsorable");
    return;
  }

  const signedTx = await wallet.signTransaction(tx);
  // console.log("Raw signed sponsored transaction: ", signedTx);

  try {
    const txHash = await provider.send("eth_sendRawTransaction", [signedTx]);
    console.log("Transaction hash:", txHash);
  } catch (error: any) {
    if (error?.error?.message) {
      console.error("RPC error message:", error.error.message);
    } else if (error?.message) {
      console.error("Error message:", error.message);
    } else {
      console.error("Unexpected error:", error);
    }
  }  
};

main();