## Gas-sponsored simple tester (Solana)

This script generates a new random Solana keypair, builds a simple memo transaction, checks sponsorability via `pm_isSponsorable`, and submits it via `sendTransaction`. It demonstrates a passive sponsorship. An active sponsorship can be tested by sending `sponsorableResult.activeSponsorTransfer` value to the Blink sponsoring wallet as an instruction in the sponsorable transaction.

1. Add your Blink API key to .env
2. Install packages: `npm i`
3. Run script: `npx tsx index.ts`
