import { ethers, JsonRpcProvider, parseEther, toNumber, Transaction } from "ethers";

const apiKey = // API_KEY;
const provider = new JsonRpcProvider(
  `https://bsc.blinklabs.xyz/v1/${apiKey}`
);

const wallet = ethers.Wallet.createRandom().connect(provider)
console.log("New wallet address:", wallet.address);
console.log("New wallet private key:", wallet.privateKey);

const createTransaction = async () => {
  const feeData = await provider.getFeeData();

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

const isTxSponsorable = async (tx: Transaction) => {
  const sponsorParams = [{
    to: tx.to!.toString(),
    from: wallet.address.toString(),
    value: ethers.toQuantity(tx.value!),
    data: tx.data!.toString(),
    gas: ethers.toBeHex(tx.gasLimit!),
  }];

  console.log(sponsorParams);

  const response = await provider.send("pm_isSponsorable", sponsorParams);
  return response;
};

async function main() {
  const tx = await createTransaction();
  const signedTx = await wallet.signTransaction(tx);

  const isSponsorable = await isTxSponsorable(tx);
  if (isSponsorable.sponsorable) {
    console.log("Transaction is sponsorable. Sending as sponsored transaction...");
    tx.gasPrice = 0;
    const signedSponsoredTx = await wallet.signTransaction(tx);
    console.log("Raw signed sponsored transaction: ", signedSponsoredTx);
    const txHash = await provider.send("eth_sendRawTransaction", [signedSponsoredTx]);
    console.log("Transaction hash: ", txHash);
  } else {
    console.log("Transaction is not sponsorable. Sending as normal transaction...");
    console.log("Raw signed transaction: ", signedTx);
    const txHash = await provider.send("eth_sendRawTransaction", [signedTx]);
    console.log("Transaction hash: ", txHash);
  }
};

main();