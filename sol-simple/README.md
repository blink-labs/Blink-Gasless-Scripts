## Gas-sponsored simple tester (Solana)

This script generates a new random Solana keypair, builds a simple memo transaction, checks sponsorability via `pm_isSponsorable`, and submits it via `sendTransaction`. It supports both passive and active sponsorship modes. In active mode, it appends a `SystemProgram.transfer` of `sponsorableResult.activeSponsorTransfer` lamports to `sponsorableResult.sponsorWallet` as the final instruction in the transaction.

1. Add your Blink API key to .env
2. Install packages: `npm i`
3. Run script:
   - Passive sponsorship (default): `npx tsx index.ts` or `npx tsx index.ts passive`
   - Active sponsorship: `npx tsx index.ts active`
