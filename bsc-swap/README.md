# ETH Gas sponsored swaps script

A headless example of how to use the Blink gas sponsored swap service on BSC using 0x as your swap provider.

Demonstrates the following:

1. Get an indicative price (sell 0.1 USD → buy WBNB) using 0x's `/swap/allowance-holder/price`
2. Get a firm quote (sell 0.1 USD → buy WBNB) using 0x's `/swap/allowance-holder/quote`
3. Submit the transaction using the Blink sponsorship endpoint
   
   a. Sign the approval object (if applicable)
   
   b. Sign the trade object

   c. Check whether the trade object is sponsorable
   
   d. Submit the trade object with a sponsorship request
   
4. Checks the transaction status`

> [!WARNING]  
> This is a demo, and is not ready for production use. The code has not been audited and does not account for all error handling. Use at your own risk.

#### Requirements

- Install [Bun](https://bun.sh/) (v1.1.0+)
- An Ethereum private key
- A [Blink API key] (https://blinklabs.xyz/)
- A [0x API key] (https://0x.org/) 
- Setup a wallet with 1 Binance-Peg BSC-USD (`0x55d398326f99059fF775485246999027B3197955`)

## Usage

1. Create a `.env` file and setup the required environment variables (your Ethereum private keys, 0x API key, and Blink RPC URL).

```sh
cp .env.example .env
```

2. Install dependencies

```sh
bun install
```

3. Run the script with either

```sh
# Run the script once
bun run index.ts
```

or

```sh
# Run the script in watch mode. Code automatically recompiles and re-executes upon changes.
bun --watch index.ts

```

4. This demo showcases trading 0.1 USDC for WETH.