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
  tx.to= "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  tx.data = "0x095ea7b3000000000000000000000000111111125421cA6dc452d289314280a0f8842A650000000000000000000000000000000000000000000000000000000000000000";
  tx.value = parseEther("0");
  tx.nonce = 0;
  tx.gasLimit = 60000;
  tx.maxFeePerGas = 0;
  tx.maxPriorityFeePerGas = 0;
  tx.chainId = 56;
  return tx;
};

async function main() {
  const tx = await createTransaction();

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