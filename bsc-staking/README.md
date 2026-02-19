## Gas-sponsored staking simple tester

This script creates a deposit transaction to Kiln `0xBF45a2e9bBa728037A714380899fd7C4ee587312` with a new random wallet. It requests whether the transaction is sponsorable via the `pm_isSponsorable` method. Then it submits the transaction via `eth_sendRawTransaction`. It runs out of the box with just your Blink API key.

1. Copy the example .env file and add your Blink api key
2. To install packages: `npm i`
3. To run script: `npx tsx index.ts`
