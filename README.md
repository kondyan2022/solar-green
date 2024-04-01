# Solar green test project (Dexola Solidity Bootcamp)

## How to Run

1. Clone the repository to your computer.
2. Install dependencies using the `npm install` command.
3. Compile the project with the `npm run compile` command.

## Try running some of the following tasks:

- Compile the project

```shell
npm run compile
```

- Test the project using Hardhat

```shell
npm run test
```

- Test the project with coverage using Hardhat

```shell
npm run coverage
```

## Files

[`SolarGreenToken.sol`](./contracts/SolarGreenToken.sol) &mdash; solar green token contract
[`SolarGreenSale.sol`](./contracts/SolarGreenSale.sol) &mdash; simple contract for tokens sale in ETH. The token price is set in ETH.
[`SolarGreenSaleUSDT.sol`](./contracts/SolarGreenSaleUSDT.sol) &mdash; contract for tokens sale is in ETH and USDT. The contract inherits The token price is set in USDT. The price in ETH is determined dynamically based on the ETH/USD from the Chainlink contract.
[`MockV3Aggregator.sol`](./contracts/MockV3Aggregator.sol) &mdash; emulate of the ETH/USD from the Chainlink contract for hardhat tests
[`USDTTestToken.sol`](./contracts/USDTTestToken.sol) &mdash; emulate [test USDT contract ](https://sepolia.etherscan.io/address/0x1531bc5de10618c511349f8007c08966e45ce8ef#writeContract) for hardhat tests
