
# Migrator Wallet

We are leveraging EIP-7702 to temporarily delegate EOAs to smart accounts, enabling Web3 users to migrate all their assets — ERC-20s, NFTs, dust tokens — with a single click.

This delegation allows externally owned accounts (EOAs) to execute smart contract logic without converting to a smart wallet permanently. By signing a short-lived authorization, the EOA temporarily behaves like a contract account, enabling complex asset transfers such as:

ERC-20 transfers (including custom tokens)

NFT migrations (ERC-721 / ERC-1155)

Dust token swaps via integrated routers (e.g. Uniswap)

Scam token filtering (optional)

All wrapped into a single bundled transaction

## Smart Contracts Deployed

- [Sepolia](https://sepolia.etherscan.io/address/0xB2491C3c204E9bC257FEb9Fb6A44c3706efa5A19#code)
- [Flow EVM Mainet](https://evm.flowscan.io/address/0xcCFC776c4723d5606987e5cc2b0B5AF183EDAb67#code)
- [ETHEREUM Mainnet](https://etherscan.io/address/0x9eCc1Ae7B614e6d63Ddc193070a2a53ADf9fE455#code)

[Smart Contracts Repo](https://github.com/WalletMigrate/contract-migrator/tree/main/contracts)

## Wallets Used for the Demo

[Main Wallet](https://sepolia.etherscan.io/address/0x86300e0a857aab39a601e89b0e7f15e1488d9f0c)  
[Destination/New Wallet](https://sepolia.etherscan.io/address/0xc86A2B3eA295cD70bad34C7871a733e75356C014)

## 🛠 How It’s Made

This project is built around the idea of simplifying wallet migrations for everyday Web3 users, using the cutting-edge capabilities of EIP-7702 and Account Abstraction.

### 🔄 How It Works

The user connects their EOA wallet in the frontend.

The frontend queries token balances (ERC20s, NFTs, etc.).

The user signs an EIP-7702 authorization (not a transaction).

We build a UserOperation that includes:

The Migrator’s bytecode (code)

The EIP-7702 signature (codeSignature)

The calldata for migration logic

The operation is sent to Pimlico’s bundler, which installs the bytecode temporarily onto the EOA and executes the logic — all in a single transaction.

Assets are migrated: transferred, swapped, and cleaned up without user friction.

