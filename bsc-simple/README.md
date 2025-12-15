## Gas-sponsored simple tester

This script creates an approval transaction with a new random wallet and submits the transaction with the `pm_isSponsorable` method to verify is sponsorability. Then it submits the transactions via `eth_sendRawTransaction`. It runs out of the box with just your Blink API key.

1. Copy the example .env file and add your Blink api key
2. To install packages: `npm i`
3. To run script: `npx tsx index.ts`
