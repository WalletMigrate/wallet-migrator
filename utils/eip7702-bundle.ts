"use client"

import {
  createWalletClient,
  createPublicClient,
  http,
  custom,
  parseEther,
  encodeFunctionData,
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient,
  type Hex,
} from "viem"
import { sepolia, mainnet } from "viem/chains"

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
  description?: string
}

interface EIP7702Bundle {
  transactions: EIP7702Transaction[]
  totalGasEstimate: string
  estimatedCost: string
  bundleHash?: string
}

// EIP-7702 Authorization structure
interface EIP7702Authorization {
  chainId: bigint
  address: Address
  nonce: bigint
  yParity: number
  r: Hex
  s: Hex
}

// EIP-7702 Wallet Capabilities
interface WalletCapabilities {
  supportsEIP7702: boolean
  supportsBatchingTransaction: boolean
  supportsPaymaster: boolean
  atomicStatus: "ready" | "supported" | "unsupported"
}

// ERC20 ABI for transfer function
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// ERC721 ABI for transferFrom function
const ERC721_ABI = [
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const

// Network configurations
const NETWORKS = {
  1: mainnet,
  11155111: sepolia,
}

// RPC URLs for public clients with multiple fallbacks
const RPC_URLS: Record<number, string[]> = {
  1: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth", "https://ethereum.publicnode.com"],
  11155111: [
    "https://lb.drpc.org/ogrpc?network=sepolia&dkey=Au_X8MHT5km3gTHdk3Zh9IDmb7qePncR8JNRKiqCbUWs",
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    "https://rpc2.sepolia.org",
  ],
  747: ["https://mainnet.evm.nodes.onflow.org"],
}

export class EIP7702BundleManager {
  private walletClient: WalletClient | null = null
  private publicClient: PublicClient | null = null
  private currentChain: any = null
  private targetChainId: number | null = null

  constructor() {
    this.initializeClients()
  }

  /**
   * Initialize Viem wallet and public clients with proper chain detection
   */
  private async initializeClients() {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        // Get current chain ID first
        const chainId = await window.ethereum.request({ method: "eth_chainId" })
        const chainIdDecimal = Number.parseInt(chainId, 16)

        // Get the appropriate chain config
        this.currentChain = NETWORKS[chainIdDecimal as keyof typeof NETWORKS] || sepolia

        // Initialize wallet client
        this.walletClient = createWalletClient({
          chain: this.currentChain,
          transport: custom(window.ethereum),
        })

        // Initialize public client with multiple RPC URLs and timeout
        const rpcUrls = RPC_URLS[chainIdDecimal] || RPC_URLS[11155111]
        this.publicClient = createPublicClient({
          chain: this.currentChain,
          transport: http(rpcUrls[0], {
            timeout: 10000,
            retryCount: 3,
            retryDelay: 1000,
          }),
        })

        console.log(`✅ Viem clients initialized with chain: ${this.currentChain.name}`)
      } catch (error) {
        console.error("❌ Failed to initialize Viem clients:", error)
        // Fallback to sepolia if detection fails
        this.currentChain = sepolia
        this.walletClient = createWalletClient({
          chain: sepolia,
          transport: custom(window.ethereum),
        })
        this.publicClient = createPublicClient({
          chain: sepolia,
          transport: http(RPC_URLS[11155111][0], {
            timeout: 10000,
            retryCount: 3,
            retryDelay: 1000,
          }),
        })
      }
    }
  }

  /**
   * Set the target chain ID for transactions
   */
  public setTargetChainId(chainId: number) {
    this.targetChainId = chainId
    console.log(`🎯 Target chain ID set to: ${chainId}`)
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
   * Check external wallet capabilities for EIP-7702 support
   * Based on Pimlico documentation
   */
  async checkExternalWalletCapabilities(): Promise<WalletCapabilities> {
    try {
      if (!this.walletClient) {
        await this.initializeClients()
        if (!this.walletClient) {
          return {
            supportsEIP7702: false,
            supportsBatchingTransaction: false,
            supportsPaymaster: false,
            atomicStatus: "unsupported",
          }
        }
      }

      const chainId = await this.walletClient.getChainId()
      console.log(`🔍 Checking wallet capabilities for chain ID: ${chainId}`)

      // Check if wallet supports EIP-7702 capabilities
      let capabilities: any = {}

      try {
        // Try to get wallet capabilities using EIP-5792 wallet_getCapabilities
        if (window.ethereum && typeof window.ethereum.request === "function") {
          console.log(`🔍 Requesting wallet capabilities...`)

          // Try the standard method first
          try {
            capabilities = await window.ethereum.request({
              method: "wallet_getCapabilities",
              params: [],
            })
            console.log(`📋 Wallet capabilities received:`, capabilities)
          } catch (capError) {
            console.log(`⚠️ wallet_getCapabilities not supported, checking manually`)

            // Fallback: Check wallet type and assume capabilities
            if (window.ethereum.isMetaMask) {
              console.log(`🦊 MetaMask detected - checking for EIP-7702 support`)
              capabilities = {
                [chainId]: {
                  atomicBatch: { supported: true },
                  paymasterService: { supported: false },
                },
              }
            } else if (window.ethereum.isAmbire) {
              console.log(`🔷 Ambire detected - assuming EIP-7702 support`)
              capabilities = {
                [chainId]: {
                  atomicBatch: { supported: true },
                  paymasterService: { supported: true },
                },
              }
            } else {
              console.log(`❓ Unknown wallet - assuming basic capabilities`)
              capabilities = {
                [chainId]: {
                  atomicBatch: { supported: false },
                  paymasterService: { supported: false },
                },
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error checking wallet capabilities:`, this.errorToString(error))
        capabilities = {}
      }

      // Parse capabilities for current chain
      const chainCapabilities = capabilities[chainId] || capabilities[`0x${chainId.toString(16)}`] || {}

      const supportsEIP7702 = Boolean(
        chainCapabilities.atomicBatch?.supported || chainCapabilities.eip7702?.supported || window.ethereum?.isAmbire, // Ambire likely supports EIP-7702
      )

      const supportsBatchingTransaction = Boolean(
        chainCapabilities.atomicBatch?.supported || chainCapabilities.batchTransactions?.supported || supportsEIP7702,
      )

      const supportsPaymaster = Boolean(
        chainCapabilities.paymasterService?.supported || chainCapabilities.paymaster?.supported,
      )

      let atomicStatus: "ready" | "supported" | "unsupported" = "unsupported"
      if (supportsBatchingTransaction) {
        atomicStatus = chainCapabilities.atomicBatch?.status === "ready" ? "ready" : "supported"
      }

      const result: WalletCapabilities = {
        supportsEIP7702,
        supportsBatchingTransaction,
        supportsPaymaster,
        atomicStatus,
      }

      console.log(`✅ Wallet capabilities determined:`, result)
      return result
    } catch (error) {
      console.error("❌ Error checking external wallet capabilities:", error)
      return {
        supportsEIP7702: false,
        supportsBatchingTransaction: false,
        supportsPaymaster: false,
        atomicStatus: "unsupported",
      }
    }
  }

  /**
   * Gets the current chain ID and checks EIP-7702 support
   */
  async checkEIP7702Support(): Promise<{ supported: boolean; capabilities?: WalletCapabilities; chainId?: number }> {
    try {
      if (!this.walletClient) {
        await this.initializeClients()
        if (!this.walletClient) return { supported: false }
      }

      const chainId = await this.walletClient.getChainId()
      console.log(`🔍 Current chain ID: ${chainId}`)

      // Update current chain if it changed
      const newChain = NETWORKS[chainId as keyof typeof NETWORKS]
      if (newChain && newChain.id !== this.currentChain?.id) {
        console.log(`🔄 Updating chain configuration from ${this.currentChain?.name || "unknown"} to ${newChain.name}`)
        this.currentChain = newChain

        // Recreate clients with new chain
        this.walletClient = createWalletClient({
          chain: this.currentChain,
          transport: custom(window.ethereum),
        })

        const rpcUrls = RPC_URLS[chainId] || RPC_URLS[11155111]
        this.publicClient = createPublicClient({
          chain: this.currentChain,
          transport: http(rpcUrls[0], {
            timeout: 10000,
            retryCount: 3,
            retryDelay: 1000,
          }),
        })

        console.log(`🔄 Updated clients to chain: ${this.currentChain.name}`)
      }

      // Check wallet capabilities
      const capabilities = await this.checkExternalWalletCapabilities()
      const network = NETWORKS[chainId as keyof typeof NETWORKS]

      if (capabilities.supportsEIP7702 && capabilities.supportsBatchingTransaction) {
        console.log(`✅ EIP-7702 supported on ${network?.name || chainId} with capabilities:`, capabilities)
        return { supported: true, capabilities, chainId }
      }

      console.log(`⚠️ EIP-7702 not supported on chain ${chainId}`)
      return { supported: false, capabilities, chainId }
    } catch (error) {
      console.error("❌ Error checking EIP-7702 support:", error)
      return { supported: false }
    }
  }

  /**
   * Prepares the bundled transactions for EIP-7702 execution
   * Following Pimlico's approach for external wallets
   */
  async prepareBundledTransactions(
    tokens: Token[],
    fromAddress: string,
    toAddress: string,
  ): Promise<EIP7702Transaction[]> {
    if (!fromAddress || !toAddress) {
      throw new Error("From and to addresses are required")
    }

    if (!this.isValidEthereumAddress(fromAddress) || !this.isValidEthereumAddress(toAddress)) {
      throw new Error("Invalid address format")
    }

    console.log(`📋 Preparing EIP-7702 bundle: ${tokens.length} tokens from ${fromAddress} to ${toAddress}`)

    // Verificar que las direcciones no sean iguales
    if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
      throw new Error("From and to addresses cannot be the same")
    }

    console.log(`✅ Verified: fromAddress (${fromAddress}) !== toAddress (${toAddress})`)

    // Check EIP-7702 support and capabilities
    const supportInfo = await this.checkEIP7702Support()
    if (!supportInfo.supported || !supportInfo.capabilities?.supportsBatchingTransaction) {
      console.log("⚠️ EIP-7702 batching not supported, preparing individual transactions for fallback")
      return await this.prepareIndividualTransactions(tokens, fromAddress, toAddress)
    }

    console.log(`✅ EIP-7702 batching supported, preparing atomic batch transactions`)

    // Prepare individual transactions that will be batched by the wallet
    const transactions: EIP7702Transaction[] = []
    const validTokens: Token[] = []

    // First pass: validate tokens
    for (const token of tokens) {
      console.log(`🔍 Processing token: ${token.name} (${token.symbol}) - Type: ${token.type}`)

      if (token.type === "NATIVE") {
        const balanceFloat = Number.parseFloat(token.balance)
        if (balanceFloat > 0) {
          validTokens.push(token)
        }
      } else if (token.type === "ERC20") {
        if (this.isValidEthereumAddress(token.contractAddress)) {
          const balanceFloat = Number.parseFloat(token.balance)
          if (balanceFloat > 0) {
            validTokens.push(token)
          }
        }
      } else if (token.type === "ERC721") {
        if (this.isValidEthereumAddress(token.contractAddress)) {
          validTokens.push(token)
        }
      }
    }

    console.log(`📊 Validation results: ${validTokens.length} valid tokens out of ${tokens.length} total`)

    if (validTokens.length === 0) {
      throw new Error("No valid tokens to transfer after validation")
    }

    // Second pass: create individual transactions for EIP-7702 atomic batching
    for (const token of validTokens) {
      console.log(`🔄 Creating transaction for: ${token.name} (${token.symbol}) - Type: ${token.type}`)

      if (token.type === "NATIVE") {
        try {
          const valueInEther = parseEther(token.balance)
          console.log(`💰 Native token transfer: ${token.balance} ${token.symbol} = ${valueInEther} wei`)

          transactions.push({
            to: toAddress,
            data: "0x", // Empty calldata for ETH transfer
            value: valueInEther.toString(),
            gasLimit: "0x5208", // 21000 gas for ETH transfer
            description: `Transfer ${token.balance} ${token.symbol} to ${toAddress}`,
          })
          console.log(`✅ Added ETH transfer transaction: ${valueInEther} wei to ${toAddress}`)
        } catch (error) {
          console.error(`❌ Error processing native token ${token.symbol}:`, this.errorToString(error))
          continue
        }
      } else if (token.type === "ERC20") {
        try {
          const amount = this.parseTokenAmount(token.balance, token.decimals || 18)
          console.log(`🪙 ERC20 transfer: ${token.balance} ${token.symbol} = ${amount} units`)

          // Use direct transfer (not transferFrom) since the user's wallet will execute directly
          const transferData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [toAddress as Address, amount],
          })

          transactions.push({
            to: token.contractAddress,
            data: transferData,
            value: "0",
            gasLimit: "0x15F90", // 90000 gas for ERC20 transfer
            description: `Transfer ${token.balance} ${token.symbol} to ${toAddress}`,
          })
          console.log(`✅ Added ERC20 transfer transaction: ${amount} ${token.symbol} to ${toAddress}`)
        } catch (error) {
          console.error(`❌ Error processing ERC20 token ${token.symbol}:`, this.errorToString(error))
          continue
        }
      } else if (token.type === "ERC721") {
        try {
          const tokenId = BigInt(token.tokenId || "0")
          console.log(`🖼️ NFT transfer: ${token.name} #${tokenId}`)

          const transferData = encodeFunctionData({
            abi: ERC721_ABI,
            functionName: "transferFrom",
            args: [fromAddress as Address, toAddress as Address, tokenId],
          })

          transactions.push({
            to: token.contractAddress,
            data: transferData,
            value: "0",
            gasLimit: "0x1D4C0", // 120000 gas for NFT transfer
            description: `Transfer NFT ${token.name} #${tokenId} to ${toAddress}`,
          })
          console.log(`✅ Added NFT transfer transaction: ${token.name} #${tokenId} to ${toAddress}`)
        } catch (error) {
          console.error(`❌ Error processing NFT ${token.name}:`, this.errorToString(error))
          continue
        }
      }
    }

    if (transactions.length === 0) {
      throw new Error("No valid transactions to bundle after processing")
    }

    console.log(`📋 Prepared ${transactions.length} transactions for EIP-7702 atomic execution`)
    console.log(`📊 Transaction summary:`)
    transactions.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.description}`)
    })

    return transactions
  }

  /**
   * Prepares individual transactions for fallback mode (when EIP-7702 is not supported)
   */
  private async prepareIndividualTransactions(
    tokens: Token[],
    fromAddress: string,
    toAddress: string,
  ): Promise<EIP7702Transaction[]> {
    const transactions: EIP7702Transaction[] = []

    // Process each token individually for fallback mode
    for (const token of tokens) {
      console.log(`🔄 Processing individual transaction for: ${token.name} (${token.symbol})`)

      if (token.type === "NATIVE") {
        const balanceFloat = Number.parseFloat(token.balance)
        if (balanceFloat <= 0) continue

        const valueInEther = parseEther(token.balance)
        transactions.push({
          to: toAddress,
          data: "0x",
          value: valueInEther.toString(),
          gasLimit: "0x5208",
          description: `Transfer ${token.balance} ${token.symbol}`,
        })
      } else if (token.type === "ERC20") {
        if (!this.isValidEthereumAddress(token.contractAddress)) continue

        const balanceFloat = Number.parseFloat(token.balance)
        if (balanceFloat <= 0) continue

        const amount = this.parseTokenAmount(token.balance, token.decimals || 18)
        const transferData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [toAddress as Address, amount],
        })

        transactions.push({
          to: token.contractAddress,
          data: transferData,
          value: "0",
          gasLimit: "0x15F90",
          description: `Transfer ${token.balance} ${token.symbol}`,
        })
      } else if (token.type === "ERC721") {
        if (!this.isValidEthereumAddress(token.contractAddress)) continue

        const tokenId = BigInt(token.tokenId || "0")
        const transferData = encodeFunctionData({
          abi: ERC721_ABI,
          functionName: "transferFrom",
          args: [fromAddress as Address, toAddress as Address, tokenId],
        })

        transactions.push({
          to: token.contractAddress,
          data: transferData,
          value: "0",
          gasLimit: "0x1D4C0",
          description: `Transfer NFT ${token.name} #${tokenId}`,
        })
      }
    }

    return transactions
  }

  /**
   * Converts token balance to amount in wei/base units
   */
  private parseTokenAmount(balance: string, decimals: number): bigint {
    try {
      const balanceFloat = Number.parseFloat(balance)
      if (balanceFloat <= 0) return BigInt(0)

      // Handle very small amounts by using string manipulation
      const balanceStr = balanceFloat.toString()
      const [integerPart, decimalPart = ""] = balanceStr.split(".")

      // Pad or truncate decimal part to match token decimals
      const paddedDecimal = decimalPart.padEnd(decimals, "0").substring(0, decimals)
      const fullAmountStr = integerPart + paddedDecimal

      const result = BigInt(fullAmountStr)
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

    let totalGas = BigInt(21000) // Base transaction cost

    // EIP-7702 provides gas efficiency - atomic execution reduces overhead
    for (const tx of transactions) {
      if (tx.data === "0x") {
        // Native transfer
        totalGas += BigInt(21000)
      } else if (tx.data.startsWith("0xa9059cbb")) {
        // ERC20 transfer
        totalGas += BigInt(65000)
      } else if (tx.data.startsWith("0x23b872dd")) {
        // ERC721 transfer
        totalGas += BigInt(85000)
      } else {
        // Generic contract call
        totalGas += BigInt(50000)
      }
    }

    // EIP-7702 provides gas efficiency - reduce overhead for atomic execution
    const eip7702Efficiency = (totalGas * BigInt(90)) / BigInt(100) // 10% gas savings
    const bundleOverhead = eip7702Efficiency + BigInt(50000) // Minimal overhead for EIP-7702

    console.log(
      `⛽ EIP-7702 bundle gas estimate: ${bundleOverhead} (includes ${transactions.length} transactions with 10% efficiency gain)`,
    )
    return bundleOverhead
  }

  /**
   * Try to switch to the target network using multiple methods
   */
  private async ensureCorrectNetwork(targetChainId: number): Promise<boolean> {
    console.log(`🔄 Ensuring we're on the correct network: Chain ID ${targetChainId}`)

    if (!window.ethereum) {
      console.error("❌ No ethereum provider found")
      return false
    }

    try {
      // Get current chain ID
      const currentChainIdHex = await window.ethereum.request({ method: "eth_chainId" })
      const currentChainId = Number.parseInt(currentChainIdHex, 16)

      console.log(`📍 Current chain ID: ${currentChainId}, Target chain ID: ${targetChainId}`)

      if (currentChainId === targetChainId) {
        console.log(`✅ Already on correct chain: ${targetChainId}`)
        return true
      }

      // Try to switch network
      try {
        console.log(`🔄 Using wallet_switchEthereumChain to switch to chain ${targetChainId}`)
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        })

        // Verify the switch
        const newChainIdHex = await window.ethereum.request({ method: "eth_chainId" })
        const newChainId = Number.parseInt(newChainIdHex, 16)

        if (newChainId === targetChainId) {
          console.log(`✅ Successfully switched to chain ${targetChainId}`)
          return true
        }
      } catch (error) {
        console.log(`⚠️ Network switch failed:`, error)
      }

      // If switch failed, show user instructions
      const networkName = targetChainId === 11155111 ? "Sepolia" : `Chain ID ${targetChainId}`
      alert(`Please manually switch your wallet to ${networkName} network before proceeding.`)

      return false
    } catch (error) {
      console.error("❌ Error ensuring correct network:", error)
      return false
    }
  }

  /**
   * Executes the EIP-7702 bundle using wallet's native batching capabilities
   * Following Pimlico's approach for external wallets
   */
  async executeEIP7702Bundle(bundle: EIP7702Bundle): Promise<Hash> {
    if (!this.walletClient) {
      await this.initializeClients()
      if (!this.walletClient) {
        throw new Error("No wallet client available")
      }
    }

    console.log(`🚀 Starting EIP-7702 atomic bundle execution with ${bundle.transactions.length} transaction(s)`)

    const supportInfo = await this.checkEIP7702Support()

    if (!supportInfo.supported || !supportInfo.capabilities?.supportsBatchingTransaction) {
      console.log("⚠️ EIP-7702 atomic batching not supported, falling back to sequential transactions")
      return await this.executeBatchTransactions(bundle.transactions)
    }

    const chainId = this.targetChainId || supportInfo.chainId || 11155111
    const network = NETWORKS[chainId as keyof typeof NETWORKS]

    try {
      // Get the current account
      const [account] = await this.walletClient.getAddresses()
      if (!account) {
        throw new Error("No accounts available. Please connect your wallet.")
      }

      console.log(`📤 Executing EIP-7702 atomic bundle from account: ${account}`)

      // Ensure correct network
      const networkSwitched = await this.ensureCorrectNetwork(chainId)
      if (!networkSwitched) {
        throw new Error(
          `Please manually switch to ${network?.name || `Chain ID ${chainId}`} in your wallet before proceeding.`,
        )
      }

      // Reinitialize clients after network switch
      await this.initializeClients()

      // Verify we're on the correct chain after switch
      const finalChainId = await this.walletClient.getChainId()
      if (finalChainId !== chainId) {
        throw new Error(`Network switch verification failed. Expected chain ${chainId}, but got ${finalChainId}.`)
      }

      console.log(`✅ Confirmed on correct network: ${network?.name || chainId} (Chain ID: ${finalChainId})`)

      // Try to use wallet's native batching capabilities
      if (
        supportInfo.capabilities?.atomicStatus === "ready" ||
        supportInfo.capabilities?.atomicStatus === "supported"
      ) {
        console.log(
          `🚀 Using wallet's native EIP-7702 atomic batching for ${bundle.transactions.length} transactions...`,
        )

        try {
          // Preparar todas las transacciones para el batch
          const calls = bundle.transactions.map((tx) => ({
            to: tx.to as Address,
            data: tx.data as `0x${string}`,
            value: tx.value ? BigInt(tx.value) : BigInt(0),
            gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
          }))

          console.log(`📤 Sending atomic batch with ${calls.length} calls in a single transaction...`)
          console.log(`📊 Batch details:`)
          calls.forEach((call, index) => {
            console.log(`  ${index + 1}. To: ${call.to}, Value: ${call.value}, Data: ${call.data.substring(0, 10)}...`)
          })

          // Intentar usar wallet_sendCalls para ejecución atómica
          let batchResult

          // Método 1: wallet_sendCalls (EIP-5792)
          try {
            batchResult = await window.ethereum.request({
              method: "wallet_sendCalls",
              params: [
                {
                  version: "1.0",
                  chainId: `0x${chainId.toString(16)}`,
                  from: account,
                  calls: calls.map((call) => ({
                    to: call.to,
                    data: call.data,
                    value: `0x${call.value.toString(16)}`,
                  })),
                  atomic: true,
                },
              ],
            })
            console.log(`✅ EIP-7702 atomic batch executed successfully with wallet_sendCalls:`, batchResult)
          } catch (method1Error) {
            console.log(`⚠️ wallet_sendCalls failed, trying alternative method:`, this.errorToString(method1Error))

            // Método 2: eth_sendBundle (algunos wallets usan este método)
            try {
              batchResult = await window.ethereum.request({
                method: "eth_sendBundle",
                params: [
                  {
                    transactions: calls.map((call) => ({
                      to: call.to,
                      data: call.data,
                      value: `0x${call.value.toString(16)}`,
                      from: account,
                    })),
                  },
                ],
              })
              console.log(`✅ EIP-7702 atomic batch executed successfully with eth_sendBundle:`, batchResult)
            } catch (method2Error) {
              console.log(`⚠️ eth_sendBundle failed, trying wallet's custom method:`, this.errorToString(method2Error))

              // Método 3: Intentar con métodos específicos de wallets
              if (window.ethereum.isAmbire) {
                try {
                  batchResult = await window.ethereum.request({
                    method: "wallet_batchTransactions",
                    params: [
                      calls.map((call) => ({
                        to: call.to,
                        data: call.data,
                        value: `0x${call.value.toString(16)}`,
                      })),
                    ],
                  })
                  console.log(`✅ EIP-7702 atomic batch executed successfully with Ambire method:`, batchResult)
                } catch (ambireError) {
                  throw new Error(`Ambire batch method failed: ${this.errorToString(ambireError)}`)
                }
              } else {
                throw new Error("No compatible batch method found in wallet")
              }
            }
          }

          // Retornar el hash de la transacción batch
          const txHash = batchResult?.hash || batchResult?.transactionHash || batchResult

          if (!txHash) {
            throw new Error("No transaction hash returned from batch execution")
          }

          console.log(`🎉 All ${calls.length} transactions executed atomically in a single transaction: ${txHash}`)
          return txHash as Hash
        } catch (batchError) {
          console.warn(`⚠️ Native batching failed, falling back to sequential:`, this.errorToString(batchError))
          return await this.executeBatchTransactions(bundle.transactions)
        }
      } else {
        console.log(`⚠️ Wallet atomic batching not ready, falling back to sequential execution`)
        return await this.executeBatchTransactions(bundle.transactions)
      }
    } catch (error) {
      const errorMsg = this.errorToString(error)
      console.error("❌ EIP-7702 atomic execution failed:", errorMsg)
      throw new Error(`EIP-7702 atomic execution failed: ${errorMsg}`)
    }
  }

  /**
   * Executes multiple transactions sequentially using Viem (fallback)
   */
  private async executeBatchTransactions(transactions: EIP7702Transaction[]): Promise<Hash> {
    if (!this.walletClient) {
      await this.initializeClients()
      if (!this.walletClient) {
        throw new Error("No wallet client available")
      }
    }

    console.log(`🔄 Executing ${transactions.length} transactions sequentially with Viem (fallback mode)`)

    // Ensure we're on the correct network for fallback mode too
    const chainId = this.targetChainId || this.currentChain?.id || 11155111

    // Try to switch to the correct network
    const networkSwitched = await this.ensureCorrectNetwork(chainId)
    if (!networkSwitched) {
      const networkName = chainId === 11155111 ? "Sepolia" : `Chain ID ${chainId}`
      throw new Error(`Please manually switch to ${networkName} in your wallet before proceeding.`)
    }

    // Reinitialize clients after network switch
    await this.initializeClients()

    const [account] = await this.walletClient.getAddresses()
    if (!account) {
      throw new Error("No accounts available. Please connect your wallet.")
    }

    console.log(`📤 Sending from account: ${account} on chain: ${chainId}`)

    const txHashes: Hash[] = []

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]

      try {
        console.log(`📤 Sending transaction ${i + 1}/${transactions.length}: ${tx.description || "Unknown"}`)

        const gasLimit = tx.gasLimit ? BigInt(tx.gasLimit) * BigInt(2) : BigInt(100000)
        console.log(`⛽ Using gas limit for transaction ${i + 1}: ${gasLimit}`)

        const hash = await this.walletClient.sendTransaction({
          account,
          chain: this.currentChain,
          to: tx.to as Address,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value || "0"),
          gas: gasLimit,
        })

        txHashes.push(hash)
        console.log(`✅ Transaction ${i + 1} sent: ${hash}`)

        // Wait for transaction to be mined
        console.log(`⏳ Waiting for transaction ${i + 1} to be mined...`)
        const receipt = await this.publicClient?.waitForTransactionReceipt({ hash })

        if (receipt?.status === "success") {
          console.log(`✅ Transaction ${i + 1} executed successfully!`)
        } else {
          console.error(`❌ Transaction ${i + 1} failed!`)
          throw new Error(
            `Transaction ${i + 1} failed on-chain. Check the transaction on the block explorer for more details.`,
          )
        }

        if (i < transactions.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        const errorMsg = this.errorToString(error)
        console.error(`❌ Transaction ${i + 1} failed:`, errorMsg)
        throw new Error(`Transaction ${i + 1} failed: ${errorMsg}`)
      }
    }

    console.log(`✅ All ${transactions.length} transactions sent successfully with Viem`)
    return txHashes[0]
  }

  /**
   * Gets the current gas price using Viem's public client with fallbacks
   */
  async getCurrentGasPrice(): Promise<bigint> {
    console.log("⛽ Getting current gas price...")

    // Try multiple methods in order of preference
    const methods = [
      () => this.getGasPriceFromViem(),
      () => this.getGasPriceFromEthereum(),
      () => this.getGasPriceFromMultipleRPCs(),
    ]

    for (const method of methods) {
      try {
        const gasPrice = await method()
        if (gasPrice > 0n) {
          console.log(`✅ Gas price obtained: ${gasPrice} wei (${Number(gasPrice) / 1e9} gwei)`)
          return gasPrice
        }
      } catch (error) {
        console.log(`⚠️ Gas price method failed:`, this.errorToString(error))
        continue
      }
    }

    // Final fallback
    const defaultGasPrice = BigInt("20000000000") // 20 gwei
    console.log(`🔄 Using default gas price: ${defaultGasPrice} wei (20 gwei)`)
    return defaultGasPrice
  }

  /**
   * Get gas price from Viem public client
   */
  private async getGasPriceFromViem(): Promise<bigint> {
    if (!this.publicClient) {
      await this.initializeClients()
      if (!this.publicClient) {
        throw new Error("No public client available")
      }
    }

    console.log("⛽ Trying Viem public client...")
    const gasPrice = await Promise.race([
      this.publicClient.getGasPrice(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Viem timeout")), 5000)),
    ])

    return gasPrice
  }

  /**
   * Get gas price from window.ethereum
   */
  private async getGasPriceFromEthereum(): Promise<bigint> {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No window.ethereum available")
    }

    console.log("⛽ Trying window.ethereum...")
    const gasPriceHex = await Promise.race([
      window.ethereum.request({ method: "eth_gasPrice" }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Ethereum timeout")), 5000)),
    ])

    return BigInt(gasPriceHex)
  }

  /**
   * Get gas price from multiple RPC endpoints
   */
  private async getGasPriceFromMultipleRPCs(): Promise<bigint> {
    const chainId = this.currentChain?.id || 11155111
    const rpcUrls = RPC_URLS[chainId] || RPC_URLS[11155111]

    console.log(`⛽ Trying multiple RPC endpoints for chain ${chainId}...`)

    for (const rpcUrl of rpcUrls) {
      try {
        console.log(`🔄 Trying RPC: ${rpcUrl}`)

        const response = await Promise.race([
          fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_gasPrice",
              params: [],
              id: 1,
            }),
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), 5000)),
        ])

        if (response.ok) {
          const data = await response.json()
          if (data.result) {
            const gasPrice = BigInt(data.result)
            console.log(`✅ Got gas price from ${rpcUrl}: ${gasPrice} wei`)
            return gasPrice
          }
        }
      } catch (error) {
        console.log(`⚠️ RPC ${rpcUrl} failed:`, this.errorToString(error))
        continue
      }
    }

    throw new Error("All RPC endpoints failed")
  }

  /**
   * Calculates the estimated cost in ETH using Viem
   */
  async calculateEstimatedCost(totalGas: bigint): Promise<string> {
    try {
      console.log(`💰 Calculating estimated cost for ${totalGas} gas...`)

      const gasPrice = await this.getCurrentGasPrice()
      console.log(`⛽ Got gas price: ${gasPrice} wei`)

      const totalCostWei = totalGas * gasPrice
      const totalCostEth = Number(totalCostWei) / Math.pow(10, 18)

      console.log(`💰 Estimated cost calculation:`)
      console.log(`   Gas: ${totalGas}`)
      console.log(`   Gas Price: ${gasPrice} wei`)
      console.log(`   Total Cost: ${totalCostWei} wei = ${totalCostEth} ETH`)

      return totalCostEth.toFixed(6)
    } catch (error) {
      const errorMsg = this.errorToString(error)
      console.error("❌ Failed to calculate estimated cost:", errorMsg)
      console.log("🔄 Returning default cost estimate")
      return "0.001000"
    }
  }

  /**
   * Validates if an address is a valid Ethereum address
   */
  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }
}

export type { EIP7702Transaction, EIP7702Bundle, WalletCapabilities }
