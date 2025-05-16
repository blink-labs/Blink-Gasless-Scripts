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
  tx.to= "0x55d398326f99059ff775485246999027b3197955";
  tx.data = "0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c227340000000000000000000000000000000000000000000000000000000000000000";
  tx.value = parseEther("0");
  tx.nonce = 0;
  tx.gasLimit = 30000;
  tx.maxFeePerGas = 0;
  tx.maxPriorityFeePerGas = 0;
  tx.chainId = 56;
  return tx;
};

async function main() {
  const tx = await createTransaction();
  const signedTx = await wallet.signTransaction(tx);
  // console.log("Raw signed sponsored transaction: ", signedTx);

  const txHash = await provider.send("eth_sendRawTransaction", [signedTx]);
  console.log("Transaction hash: ", txHash);
};

main();