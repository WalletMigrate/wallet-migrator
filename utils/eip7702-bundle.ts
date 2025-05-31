"use client"

interface Token {
  type: "ERC20" | "ERC721" | "NATIVE"
  name: string
  symbol: string
  balance: string
  decimals?: number
  tokenId?: string
  contractAddress: string
  selected?: boolean
  isNative?: boolean
}

interface EIP7702Transaction {
  to: string
  data: string
  value: string
  gasLimit?: string
}

interface EIP7702Bundle {
  transactions: EIP7702Transaction[]
  totalGasEstimate: string
  estimatedCost: string
  bundleHash?: string
}

// ERC20 transfer function selector
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb"
// ERC721 transferFrom function selector
const ERC721_TRANSFER_FROM_SELECTOR = "0x23b872dd"
// Bytecode for the temporary contract that will handle the bundle
const BUNDLE_CONTRACT_BYTECODE = `
608060405234801561001057600080fd5b506004361061002b5760003560e01c8063f242432a14610030575b600080fd5b61004a60048036038101906100459190610234565b61004c565b005b60005b8351811015610123576000848281518110610069576100686102a4565b5b602002602001015190506000848381518110610088576100876102a4565b5b6020026020010151905060008483815181106100a7576100a66102a4565b5b602002602001015190506000808473ffffffffffffffffffffffffffffffffffffffff16848460405160006040518083038185875af1925050503d8060008114610110576040519150601f19603f3d011682016040523d82523d6000602084013e610115565b606091505b50509050505050808061012790610303565b91505061004f565b50505050565b6000604051905090565b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b61018f82610146565b810181811067ffffffffffffffff821117156101ae576101ad610157565b5b80604052505050565b60006101c1610129565b90506101cd8282610186565b919050565b600067ffffffffffffffff8211156101ed576101ec610157565b5b602082029050602081019050919050565b6000604051905090565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061022e82610203565b9050919050565b61023e81610223565b811461024957600080fd5b50565b60008135905061025b81610235565b92915050565b600080fd5b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061030e82610261565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8203610340576103406102d3565b5b60018201905091905056fea2646970667358221220...
`

export class EIP7702BundleManager {
  private ethereum: any

  constructor() {
    if (typeof window !== "undefined") {
      this.ethereum = (window as any).ethereum
    }
  }

  /**
   * Converts an error to a safe string
   */
  private errorToString(error: any): string {
    if (typeof error === "string") return error
    if (error instanceof Error) return error.message
    if (error?.message) return error.message
    if (error?.reason) return error.reason
    return String(error)
  }

  /**
   * Checks if the current network supports EIP-7702
   */
  async checkEIP7702Support(): Promise<boolean> {
    try {
      if (!this.ethereum) return false

      const chainId = await this.ethereum.request({ method: "eth_chainId" })
      const chainIdDecimal = Number.parseInt(chainId, 16)

      console.log(`🔍 Current chain ID: ${chainIdDecimal}`)

      // Sepolia has full support for EIP-7702
      if (chainIdDecimal === 11155111) {
        console.log("✅ Sepolia detected - EIP-7702 supported")
        return true
      }

      return false
    } catch (error) {
      console.error("❌ Error checking EIP-7702 support:", error)
      return false
    }
  }

  /**
   * Creates the bytecode for the temporary contract for EIP-7702
   */
  private createBundleContractBytecode(transactions: EIP7702Transaction[]): string {
    console.log(`🔧 Creating bundle contract for ${transactions.length} transactions`)

    // Creates the bytecode that will execute all transactions in a single call
    let calldata = "0x"

    // Function selector for executeBatch(address[],bytes[],uint256[])
    calldata += "f242432a" // executeBatch function selector

    // Offset for arrays
    calldata += "0000000000000000000000000000000000000000000000000000000000000060" // offset to addresses array

    // Calculate offsets dynamically
    const addressesLength = transactions.length
    const dataOffset = 96 + addressesLength * 32 // after addresses array
    const valuesOffset = dataOffset + 32 + addressesLength * 32 // after data array

    calldata += dataOffset.toString(16).padStart(64, "0") // offset to data array
    calldata += valuesOffset.toString(16).padStart(64, "0") // offset to values array

    // Addresses array
    calldata += addressesLength.toString(16).padStart(64, "0") // array length
    transactions.forEach((tx) => {
      calldata += tx.to.slice(2).padStart(64, "0") // address
    })

    // Data array
    calldata += addressesLength.toString(16).padStart(64, "0") // array length
    let dataOffsetCounter = 32 * addressesLength // start after all offset pointers
    transactions.forEach((tx) => {
      calldata += dataOffsetCounter.toString(16).padStart(64, "0") // offset to this data
      dataOffsetCounter += 32 + Math.ceil((tx.data.length - 2) / 2) // update for next
    })

    // Actual data
    transactions.forEach((tx) => {
      const dataLength = (tx.data.length - 2) / 2
      calldata += dataLength.toString(16).padStart(64, "0") // data length
      calldata += tx.data.slice(2) // actual data
      // Pad to 32 bytes if needed
      const padding = (32 - (dataLength % 32)) % 32
      calldata += "0".repeat(padding * 2)
    })

    // Values array
    calldata += addressesLength.toString(16).padStart(64, "0") // array length
    transactions.forEach((tx) => {
      const value = BigInt(tx.value || "0")
      calldata += value.toString(16).padStart(64, "0") // value
    })

    console.log(`🔧 Bundle contract calldata: ${calldata.slice(0, 100)}...`)
    return calldata
  }

  /**
   * Prepares the bundled transactions according to EIP-7702
   */
  prepareBundledTransactions(tokens: Token[], fromAddress: string, toAddress: string): EIP7702Transaction[] {
    const transactions: EIP7702Transaction[] = []

    if (!fromAddress || !toAddress) {
      throw new Error("From and to addresses are required")
    }

    if (!this.isValidEthereumAddress(fromAddress) || !this.isValidEthereumAddress(toAddress)) {
      throw new Error("Invalid address format")
    }

    console.log(`📋 Preparing EIP-7702 bundle: ${tokens.length} tokens from ${fromAddress} to ${toAddress}`)

    for (const token of tokens) {
      console.log(`🔄 Processing token: ${token.name} (${token.symbol}) - Type: ${token.type}`)

      if (token.type === "NATIVE") {
        const balanceFloat = Number.parseFloat(token.balance)
        if (balanceFloat <= 0) {
          console.warn(`⚠️ Skipping native token ${token.symbol} with zero balance`)
          continue
        }

        const valueInWei = this.parseTokenAmount(token.balance, 18)
        console.log(`💰 Native token transfer: ${token.balance} ${token.symbol} = ${valueInWei} wei`)

        transactions.push({
          to: toAddress,
          data: "0x",
          value: `0x${valueInWei.toString(16)}`,
          gasLimit: "0x5208",
        })
      } else if (token.type === "ERC20") {
        if (!this.isValidEthereumAddress(token.contractAddress)) {
          throw new Error(`Invalid contract address for token ${token.symbol}`)
        }

        const balanceFloat = Number.parseFloat(token.balance)
        if (balanceFloat <= 0) {
          console.warn(`⚠️ Skipping ERC20 token ${token.symbol} with zero balance`)
          continue
        }

        const amount = this.parseTokenAmount(token.balance, token.decimals || 18)
        console.log(`🪙 ERC20 transfer: ${token.balance} ${token.symbol} = ${amount} units`)

        const data = this.encodeERC20Transfer(toAddress, amount)

        transactions.push({
          to: token.contractAddress,
          data,
          value: "0x0",
          gasLimit: "0xC350",
        })
      } else if (token.type === "ERC721") {
        if (!this.isValidEthereumAddress(token.contractAddress)) {
          throw new Error(`Invalid contract address for NFT ${token.name}`)
        }

        const tokenId = BigInt(token.tokenId || "0")
        console.log(`🖼️ NFT transfer: ${token.name} #${tokenId}`)

        const data = this.encodeERC721TransferFrom(fromAddress, toAddress, tokenId)

        transactions.push({
          to: token.contractAddress,
          data,
          value: "0x0",
          gasLimit: "0x11170",
        })
      }
    }

    console.log(`✅ Prepared ${transactions.length} EIP-7702 transactions`)
    return transactions
  }

  /**
   * Encodes the ERC20 transfer call
   */
  private encodeERC20Transfer(to: string, amount: bigint): string {
    const toAddress = to.slice(2).toLowerCase().padStart(64, "0")
    const amountHex = amount.toString(16).padStart(64, "0")
    const encoded = `${ERC20_TRANSFER_SELECTOR}${toAddress}${amountHex}`
    console.log(`🔧 ERC20 transfer encoded: ${encoded}`)
    return encoded
  }

  /**
   * Encodes the ERC721 transferFrom call
   */
  private encodeERC721TransferFrom(from: string, to: string, tokenId: bigint): string {
    const fromAddress = from.slice(2).toLowerCase().padStart(64, "0")
    const toAddress = to.slice(2).toLowerCase().padStart(64, "0")
    const tokenIdHex = tokenId.toString(16).padStart(64, "0")
    const encoded = `${ERC721_TRANSFER_FROM_SELECTOR}${fromAddress}${toAddress}${tokenIdHex}`
    console.log(`🔧 ERC721 transferFrom encoded: ${encoded}`)
    return encoded
  }

  /**
   * Converts token balance to amount in wei/base units
   */
  private parseTokenAmount(balance: string, decimals: number): bigint {
    try {
      const balanceFloat = Number.parseFloat(balance)
      if (balanceFloat <= 0) return BigInt(0)

      const multiplier = BigInt(10) ** BigInt(decimals)
      const result = BigInt(Math.floor(balanceFloat * Number(multiplier)))
      console.log(`🔢 Parsed amount: ${balance} -> ${result} (decimals: ${decimals})`)
      return result
    } catch (error) {
      console.error(`❌ Error parsing token amount: ${balance}`, error)
      throw new Error(`Failed to parse token amount: ${balance}`)
    }
  }

  /**
   * Estimates the total gas for the EIP-7702 bundle
   */
  async estimateGasForBundle(transactions: EIP7702Transaction[]): Promise<bigint> {
    console.log(`⛽ Estimating gas for EIP-7702 bundle: ${transactions.length} transactions`)

    // For EIP-7702, gas is more efficient as it's a single transaction
    let totalGas = BigInt(21000) // Base transaction cost

    // Add gas for each operation in the bundle
    for (const tx of transactions) {
      if (tx.data === "0x") {
        // Native transfer
        totalGas += BigInt(0) // Already included in base cost
      } else if (tx.data.startsWith(ERC20_TRANSFER_SELECTOR)) {
        // ERC20 transfer
        totalGas += BigInt(65000) // Typical ERC20 transfer cost
      } else if (tx.data.startsWith(ERC721_TRANSFER_FROM_SELECTOR)) {
        // ERC721 transfer
        totalGas += BigInt(85000) // Typical ERC721 transfer cost
      } else {
        // Generic contract call
        totalGas += BigInt(50000)
      }
    }

    // Overhead for EIP-7702 bundle execution (much smaller than individual transactions)
    const bundleOverhead = totalGas + BigInt(50000) // Fixed overhead for the bundle contract

    console.log(
      `⛽ EIP-7702 bundle gas estimate: ${bundleOverhead} (vs ${totalGas * BigInt(transactions.length)} individual)`,
    )
    return bundleOverhead
  }

  /**
   * Executes the bundle using EIP-7702 native with a single signature
   */
  async executeEIP7702Bundle(bundle: EIP7702Bundle): Promise<string> {
    if (!this.ethereum) {
      throw new Error("No wallet detected")
    }

    console.log(`🚀 Starting EIP-7702 bundle execution with ${bundle.transactions.length} transactions`)

    const eip7702Supported = await this.checkEIP7702Support()

    if (!eip7702Supported) {
      console.log("⚠️ EIP-7702 not supported, falling back to sequential transactions")
      return await this.executeBatchTransactions(bundle.transactions)
    }

    try {
      console.log("🔄 Executing native EIP-7702 bundle with single signature...")

      // Get the current account
      const accounts = await this.ethereum.request({
        method: "eth_accounts",
      })

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available. Please connect your wallet.")
      }

      const fromAccount = accounts[0]
      console.log(`📤 Executing bundle from account: ${fromAccount}`)

      // Create the temporary contract for EIP-7702
      const bundleCalldata = this.createBundleContractBytecode(bundle.transactions)

      // Method 1: Use EIP-7702 with code authorization
      try {
        console.log("🔄 Attempting EIP-7702 with code authorization...")

        // First, authorize the bytecode of the temporary contract
        const authorizationList = [
          {
            chainId: "0xaa36a7", // Sepolia chain ID
            address: fromAccount,
            nonce: "0x0",
            code: BUNDLE_CONTRACT_BYTECODE,
          },
        ]

        // Create the EIP-7702 transaction with authorization list
        const eip7702Tx = {
          from: fromAccount,
          to: fromAccount, // Call ourselves (now acting as a contract)
          data: bundleCalldata,
          value: "0x0",
          gas: bundle.totalGasEstimate,
          authorizationList: authorizationList,
          type: "0x4", // EIP-7702 transaction type
        }

        console.log("📦 EIP-7702 transaction:", eip7702Tx)

        const result = await this.ethereum.request({
          method: "eth_sendTransaction",
          params: [eip7702Tx],
        })

        console.log(`✅ EIP-7702 bundle executed successfully:`, result)
        return result
      } catch (eip7702Error) {
        console.log(`⚠️ EIP-7702 method failed:`, this.errorToString(eip7702Error))
      }

      // Method 2: Use experimental bundle methods
      const bundleMethods = ["eth_sendBundle", "wallet_sendBundle", "pectra_sendBundle", "eth_sendTransactionBundle"]

      for (const method of bundleMethods) {
        try {
          console.log(`🔄 Trying bundle method: ${method}`)

          const bundleParams = {
            transactions: bundle.transactions.map((tx) => ({
              from: fromAccount,
              to: tx.to,
              data: tx.data,
              value: tx.value,
              gas: tx.gasLimit,
            })),
            gasLimit: bundle.totalGasEstimate,
          }

          const result = await this.ethereum.request({
            method: method,
            params: [bundleParams],
          })

          console.log(`✅ Bundle executed successfully with ${method}:`, result)
          return result.hash || result.bundleHash || result
        } catch (methodError) {
          console.log(`⚠️ Method ${method} failed:`, this.errorToString(methodError))
          continue
        }
      }

      // Method 3: Multicall contract (if available)
      try {
        console.log("🔄 Attempting multicall contract...")

        // Address of the Multicall3 contract on Sepolia
        const multicallAddress = "0xcA11bde05977b3631167028862bE2a173976CA11"

        const multicallData = this.encodeMulticall(bundle.transactions)

        const multicallTx = {
          from: fromAccount,
          to: multicallAddress,
          data: multicallData,
          value: "0x0",
          gas: bundle.totalGasEstimate,
        }

        const result = await this.ethereum.request({
          method: "eth_sendTransaction",
          params: [multicallTx],
        })

        console.log(`✅ Multicall executed successfully:`, result)
        return result
      } catch (multicallError) {
        console.log(`⚠️ Multicall failed:`, this.errorToString(multicallError))
      }

      // If everything fails, use fallback
      console.log("🔄 All EIP-7702 methods failed, using fallback")
      return await this.executeBatchTransactions(bundle.transactions)
    } catch (error) {
      const errorMsg = this.errorToString(error)
      console.error("❌ EIP-7702 bundle execution failed:", errorMsg)
      throw new Error(`EIP-7702 bundle execution failed: ${errorMsg}`)
    }
  }

  /**
   * Encodes a multicall
   */
  private encodeMulticall(transactions: EIP7702Transaction[]): string {
    // Multicall3.aggregate3 function selector
    const multicallSelector = "0x82ad56cb"

    // Encode array of Call3 structs
    let calldata = multicallSelector

    // Offset to calls array
    calldata += "0000000000000000000000000000000000000000000000000000000000000020"

    // Array length
    calldata += transactions.length.toString(16).padStart(64, "0")

    // Each Call3 struct: (address target, bool allowFailure, bytes callData)
    transactions.forEach((tx) => {
      // target address
      calldata += tx.to.slice(2).padStart(64, "0")
      // allowFailure = false
      calldata += "0000000000000000000000000000000000000000000000000000000000000000"
      // offset to callData
      calldata += "0000000000000000000000000000000000000000000000000000000000000060"
      // callData length
      const dataLength = (tx.data.length - 2) / 2
      calldata += dataLength.toString(16).padStart(64, "0")
      // callData
      calldata += tx.data.slice(2)
      // Pad to 32 bytes
      const padding = (32 - (dataLength % 32)) % 32
      calldata += "0".repeat(padding * 2)
    })

    return calldata
  }

  /**
   * Executes multiple transactions sequentially (fallback)
   */
  private async executeBatchTransactions(transactions: EIP7702Transaction[]): Promise<string> {
    console.log(`🔄 Executing ${transactions.length} transactions sequentially (fallback mode)`)

    const accounts = await this.ethereum.request({
      method: "eth_accounts",
    })

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts available. Please connect your wallet.")
    }

    const fromAccount = accounts[0]
    console.log(`📤 Sending from account: ${fromAccount}`)

    const txHashes: string[] = []

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]

      try {
        console.log(`📤 Sending transaction ${i + 1}/${transactions.length}`)

        const txParams = {
          from: fromAccount,
          to: tx.to,
          data: tx.data,
          value: tx.value,
          gas: tx.gasLimit,
        }

        const txHash = await this.ethereum.request({
          method: "eth_sendTransaction",
          params: [txParams],
        })

        txHashes.push(txHash)
        console.log(`✅ Transaction ${i + 1} sent: ${txHash}`)

        if (i < transactions.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        const errorMsg = this.errorToString(error)
        console.error(`❌ Transaction ${i + 1} failed:`, errorMsg)
        throw new Error(`Transaction ${i + 1} failed: ${errorMsg}`)
      }
    }

    console.log(`✅ All ${transactions.length} transactions sent successfully`)
    return txHashes[0]
  }

  /**
   * Gets the current gas price
   */
  async getCurrentGasPrice(): Promise<bigint> {
    try {
      console.log("⛽ Getting current gas price...")
      const gasPrice = await this.ethereum.request({
        method: "eth_gasPrice",
        params: [],
      })
      const gasPriceBigInt = BigInt(gasPrice)
      console.log(`⛽ Current gas price: ${gasPriceBigInt} wei`)
      return gasPriceBigInt
    } catch (error) {
      const errorMsg = this.errorToString(error)
      console.error("❌ Failed to get gas price:", errorMsg)
      const defaultGasPrice = BigInt("20000000000") // 20 gwei by default
      console.log(`🔄 Using default gas price: ${defaultGasPrice} wei`)
      return defaultGasPrice
    }
  }

  /**
   * Calculates the estimated cost in ETH
   */
  async calculateEstimatedCost(totalGas: bigint): Promise<string> {
    try {
      const gasPrice = await this.getCurrentGasPrice()
      const totalCostWei = totalGas * gasPrice
      const totalCostEth = Number(totalCostWei) / Math.pow(10, 18)
      console.log(`💰 Estimated cost: ${totalCostEth} ETH (${totalCostWei} wei)`)
      return totalCostEth.toFixed(6)
    } catch (error) {
      const errorMsg = this.errorToString(error)
      console.error("❌ Failed to calculate estimated cost:", errorMsg)
      return "0.000000"
    }
  }

  /**
   * Validates if an address is a valid Ethereum address
   */
  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }
}

export type { EIP7702Transaction, EIP7702Bundle }
