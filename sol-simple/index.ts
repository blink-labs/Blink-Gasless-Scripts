import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY is not set");
const rpcUrl = `https://sol.blinklabs.xyz/v1/${API_KEY}?sponsorship=true`;
const connection = new Connection(rpcUrl);

const keypair = Keypair.generate();
console.log("New wallet address:", keypair.publicKey.toBase58());
console.log("Creating gasless transaction...");
console.log("--------------------------------");

const createTransaction = async () => {
  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: keypair.publicKey,
    recentBlockhash: blockhash,
  });
  tx.add(
    new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from("hello", "utf8"),
    })
  );
  return tx;
};

const rpcCall = async (method: string, params: any[]) => {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 0 }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
};

const isSponsorable = async (tx: Transaction) => {
  const serialized = tx
    .serialize({ requireAllSignatures: false })
    .toString("base64");
  return await rpcCall("pm_isSponsorable", [serialized]);
};

async function main() {
  const tx = await createTransaction();
  const isSponsorableResult = await isSponsorable(tx);
  console.log("Is sponsorable:", isSponsorableResult.sponsorable);
  if (!isSponsorableResult.sponsorable) {
    console.log("Transaction is not sponsorable");
    return;
  }

  tx.sign(keypair);
  const rawTx = tx.serialize().toString("base64");

  try {
    const signature = await rpcCall("sendTransaction", [
      rawTx,
      { encoding: "base64" },
    ]);
    console.log("Transaction signature:", signature);
  } catch (error: any) {
    console.error("RPC error message:", error?.message ?? error);
  }
}

main();
