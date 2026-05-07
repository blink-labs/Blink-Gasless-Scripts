import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY is not set");

const mode = (process.argv[2] ?? "passive").toLowerCase();
if (mode !== "passive" && mode !== "active") {
  console.error(`Unknown mode "${mode}". Use "passive" or "active".`);
  process.exit(1);
}
const sponsorshipParam = mode === "active" ? "active" : "true";

// const rpcUrl = `https://sol.blinklabs.xyz/v1/${API_KEY}?sponsorship=${sponsorshipParam}`;
// const rpcUrlLocal = `http://localhost:3000/v1/${API_KEY}?sponsorship=${sponsorshipParam}`;
const rpcUrl = `https://sol.blinklabs.xyz/v1/${API_KEY}`;
const rpcUrlLocal = `http://localhost:3000/v1/${API_KEY}`;
const connection = new Connection(rpcUrl);

const keypair = Keypair.generate();
console.log(`Mode: ${mode} sponsorship`);
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
  const response = await fetch(rpcUrlLocal, {
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

  if (mode === "active") {
    const { activeSponsorTransfer, sponsorWallet } = isSponsorableResult;
    if (activeSponsorTransfer == null || !sponsorWallet) {
      console.error(
        "Active sponsorship missing activeSponsorTransfer/sponsorWallet in response:",
        isSponsorableResult
      );
      return;
    }
    console.log(
      `Adding active sponsor transfer of ${activeSponsorTransfer} lamports to ${sponsorWallet}`
    );
    tx.add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(sponsorWallet),
        lamports: Number(activeSponsorTransfer),
      })
    );
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
