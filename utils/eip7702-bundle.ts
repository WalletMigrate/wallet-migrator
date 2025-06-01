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
}

interface EIP7702Bundle {
  transactions: EIP7702Transaction[]
  totalGasEstimate: string
  estimatedCost: string
  bundleHash?: string
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
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
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
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const

// Pectra Bundle Contract ABI
const PECTRA_BUNDLE_ABI = [
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const

// Pectra Bundle Contract Addresses by network
const PECTRA_BUNDLE_CONTRACTS: Record<number, Address> = {
  1: "0x9eCc1Ae7B614e6d63Ddc193070a2a53ADf9fE455", // Ethereum Mainnet
  11155111: "0xB2491C3c204E9bC257FEb9Fb6A44c3706efa5A19", // Sepolia Testnet
}

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
            timeout: 10000, // 10 second timeout
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
   * Gets the current chain ID and checks EIP-7702 support
   */
  async checkEIP7702Support(): Promise<{ supported: boolean; contractAddress?: Address; chainId?: number }> {
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

      const contractAddress = PECTRA_BUNDLE_CONTRACTS[chainId]
      const network = NETWORKS[chainId as keyof typeof NETWORKS]

      if (contractAddress && network) {
        console.log(`✅ EIP-7702 supported on ${network.name} with contract: ${contractAddress}`)
        return { supported: true, contractAddress, chainId }
      }

      console.log(`⚠️ EIP-7702 not supported on chain ${chainId}`)
      return { supported: false, chainId }
    } catch (error) {
      console.error("❌ Error checking EIP-7702 support:", error)
      return { supported: false }
    }
  }

  /**
   * Check if an ERC20 token has enough allowance for the Pectra contract
   */
  private async checkAndApproveERC20(
    tokenAddress: string,
    ownerAddress: string,
    amount: bigint,
    pectraContract: string,
  ): Promise<boolean> {
    try {
      if (!this.publicClient || !this.walletClient) {
        throw new Error("Clients not initialized")
      }

      console.log(`🔍 Checking allowance for token ${tokenAddress}...`)

      // Check current allowance
      const allowance = await this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [ownerAddress as Address, pectraContract as Address],
      })

      console.log(`📊 Current allowance: ${allowance} (needed: ${amount})`)

      // If allowance is sufficient, return true
      if (allowance >= amount) {
        console.log(`✅ Allowance sufficient for token ${tokenAddress}`)
        return true
      }

      // If not, request approval
      console.log(`🔄 Requesting approval for token ${tokenAddress}...`)

      const [account] = await this.walletClient.getAddresses()

      const hash = await this.walletClient.writeContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [pectraContract as Address, amount],
        account,
      })

      console.log(`✅ Approval transaction sent: ${hash}`)

      // Wait for transaction to be mined
      console.log(`⏳ Waiting for approval transaction to be mined...`)
      await this.publicClient.waitForTransactionReceipt({ hash })

      console.log(`✅ Approval confirmed for token ${tokenAddress}`)
      return true
    } catch (error) {
      console.error(`❌ Error approving token ${tokenAddress}:`, error)
      throw new Error(`Failed to approve token ${tokenAddress}: ${this.errorToString(error)}`)
    }
  }

  /**
   * Check if an ERC721 token is approved for the Pectra contract
   */
  private async checkAndApproveERC721(
    tokenAddress: string,
    ownerAddress: string,
    tokenId: bigint,
    pectraContract: string,
  ): Promise<boolean> {
    try {
      if (!this.publicClient || !this.walletClient) {
        throw new Error("Clients not initialized")
      }

      console.log(`🔍 Checking approval for NFT ${tokenAddress} #${tokenId}...`)

      // Check current approval
      const approved = await this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC721_ABI,
        functionName: "getApproved",
        args: [tokenId],
      })

      console.log(`📊 Current approval: ${approved} (needed: ${pectraContract})`)

      // If approved, return true
      if (approved.toLowerCase() === pectraContract.toLowerCase()) {
        console.log(`✅ Approval sufficient for NFT ${tokenAddress} #${tokenId}`)
        return true
      }

      // If not, request approval
      console.log(`🔄 Requesting approval for NFT ${tokenAddress} #${tokenId}...`)

      const [account] = await this.walletClient.getAddresses()

      const hash = await this.walletClient.writeContract({
        address: tokenAddress as Address,
        abi: ERC721_ABI,
        functionName: "approve",
        args: [pectraContract as Address, tokenId],
        account,
      })

      console.log(`✅ Approval transaction sent: ${hash}`)

      // Wait for transaction to be mined
      console.log(`⏳ Waiting for approval transaction to be mined...`)
      await this.publicClient.waitForTransactionReceipt({ hash })

      console.log(`✅ Approval confirmed for NFT ${tokenAddress} #${tokenId}`)
      return true
    } catch (error) {
      console.error(`❌ Error approving NFT ${tokenAddress} #${tokenId}:`, error)
      throw new Error(`Failed to approve NFT ${tokenAddress} #${tokenId}: ${this.errorToString(error)}`)
    }
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

    // Añadir esta verificación al inicio del método:
    if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
      throw new Error("From and to addresses cannot be the same")
    }

    console.log(`✅ Verified: fromAddress (${fromAddress}) !== toAddress (${toAddress})`)

    for (const token of tokens) {
      console.log(`🔄 Processing token: ${token.name} (${token.symbol}) - Type: ${token.type}`)

      if (token.type === "NATIVE") {
        const balanceFloat = Number.parseFloat(token.balance)
        if (balanceFloat <= 0) {
          console.warn(`⚠️ Skipping native token ${token.symbol} with zero balance`)
          continue
        }

        const valueInEther = parseEther(token.balance)
        console.log(`💰 Native token transfer: ${token.balance} ${token.symbol} = ${valueInEther} wei`)

        transactions.push({
          to: toAddress,
          data: "0x",
          value: valueInEther.toString(),
          gasLimit: "0x5208", // 21000 gas for a standard ETH transfer
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

        // Use Viem to encode the transfer function call
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [toAddress as Address, amount],
        })

        transactions.push({
          to: token.contractAddress,
          data,
          value: "0",
          gasLimit: "0x15F90", // 90000 gas for ERC20 transfer
        })
      } else if (token.type === "ERC721") {
        if (!this.isValidEthereumAddress(token.contractAddress)) {
          throw new Error(`Invalid contract address for NFT ${token.name}`)
        }

        const tokenId = BigInt(token.tokenId || "0")
        console.log(`🖼️ NFT transfer: ${token.name} #${tokenId}`)

        // Use Viem to encode the transferFrom function call
        const data = encodeFunctionData({
          abi: ERC721_ABI,
          functionName: "transferFrom",
          args: [fromAddress as Address, toAddress as Address, tokenId],
        })

        transactions.push({
          to: token.contractAddress,
          data,
          value: "0",
          gasLimit: "0x1D4C0", // 120000 gas for ERC721 transfer
        })
      }
    }

    console.log(`✅ Prepared ${transactions.length} EIP-7702 transactions`)
    console.log(
      `📋 Transaction destinations:`,
      transactions.map((tx) => tx.to),
    )
    return transactions
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
        totalGas += BigInt(21000) // Base cost for ETH transfer
      } else if (tx.data.startsWith("0xa9059cbb")) {
        // ERC20 transfer
        totalGas += BigInt(65000) // Typical ERC20 transfer cost
      } else if (tx.data.startsWith("0x23b872dd")) {
        // ERC721 transfer
        totalGas += BigInt(85000) // Typical ERC721 transfer cost
      } else {
        // Generic contract call
        totalGas += BigInt(50000)
      }
    }

    // Overhead for EIP-7702 bundle execution (much smaller than individual transactions)
    // Aumentar el overhead para asegurar que hay suficiente gas
    const bundleOverhead = totalGas + BigInt(150000) // Increased overhead for the bundle contract

    console.log(
      `⛽ EIP-7702 bundle gas estimate: ${bundleOverhead} (vs ${totalGas * BigInt(transactions.length)} individual)`,
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

      // Try multiple methods to switch network

      // Method 1: Standard EIP-1193 wallet_switchEthereumChain
      try {
        console.log(`🔄 Method 1: Using wallet_switchEthereumChain to switch to chain ${targetChainId}`)
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
        } else {
          console.log(`⚠️ Chain ID mismatch after switch: expected ${targetChainId}, got ${newChainId}`)
        }
      } catch (error) {
        console.log(`⚠️ Method 1 failed:`, error)
      }

      // Method 2: Try Ambire Wallet specific method if available
      if (window.ethereum.isAmbire) {
        try {
          console.log(`🔄 Method 2: Using Ambire-specific method to switch to chain ${targetChainId}`)
          // Note: This is hypothetical - check Ambire docs for actual method
          await window.ethereum.request({
            method: "wallet_setNetwork",
            params: [targetChainId],
          })

          // Verify the switch
          const newChainIdHex = await window.ethereum.request({ method: "eth_chainId" })
          const newChainId = Number.parseInt(newChainIdHex, 16)

          if (newChainId === targetChainId) {
            console.log(`✅ Successfully switched to chain ${targetChainId} using Ambire method`)
            return true
          }
        } catch (error) {
          console.log(`⚠️ Method 2 failed:`, error)
        }
      }

      // Method 3: Try adding the chain first, then switching
      try {
        console.log(`🔄 Method 3: Adding chain ${targetChainId} before switching`)

        // Define chain parameters based on target chain ID
        let chainParams: any = null

        if (targetChainId === 11155111) {
          // Sepolia
          chainParams = {
            chainId: `0x${targetChainId.toString(16)}`,
            chainName: "Ethereum Sepolia",
            nativeCurrency: {
              name: "Sepolia ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://lb.drpc.org/ogrpc?network=sepolia&dkey=Au_X8MHT5km3gTHdk3Zh9IDmb7qePncR8JNRKiqCbUWs"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }
        }

        if (chainParams) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [chainParams],
          })

          // Verify the switch
          const newChainIdHex = await window.ethereum.request({ method: "eth_chainId" })
          const newChainId = Number.parseInt(newChainIdHex, 16)

          if (newChainId === targetChainId) {
            console.log(`✅ Successfully added and switched to chain ${targetChainId}`)
            return true
          }
        }
      } catch (error) {
        console.log(`⚠️ Method 3 failed:`, error)
      }

      // If we get here, all methods failed
      console.error(`❌ All network switch methods failed for chain ${targetChainId}`)

      // Show user instructions
      const networkName = targetChainId === 11155111 ? "Sepolia" : `Chain ID ${targetChainId}`
      alert(`Please manually switch your wallet to ${networkName} network before proceeding.`)

      return false
    } catch (error) {
      console.error("❌ Error ensuring correct network:", error)
      return false
    }
  }

  /**
   * Executes the bundle using direct method
   */
  async executeEIP7702Bundle(bundle: EIP7702Bundle): Promise<Hash> {
    if (!this.walletClient) {
      await this.initializeClients()
      if (!this.walletClient) {
        throw new Error("No wallet client available")
      }
    }

    console.log(`🚀 Starting bundle execution with ${bundle.transactions.length} transactions`)

    const supportInfo = await this.checkEIP7702Support()

    if (!supportInfo.supported || !supportInfo.contractAddress || !supportInfo.chainId) {
      console.log("⚠️ EIP-7702 not supported, falling back to sequential transactions")
      return await this.executeBatchTransactions(bundle.transactions)
    }

    const pectraContract = supportInfo.contractAddress
    const chainId = this.targetChainId || supportInfo.chainId
    const network = NETWORKS[chainId as keyof typeof NETWORKS]

    try {
      console.log(`🔄 Executing bundle with contract: ${pectraContract}`)

      // Get the current account
      const [account] = await this.walletClient.getAddresses()
      if (!account) {
        throw new Error("No accounts available. Please connect your wallet.")
      }

      console.log(`📤 Executing bundle from account: ${account}`)

      // FORCE network switch - this is critical for correct network execution
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
        throw new Error(
          `Network switch verification failed. Expected chain ${chainId}, but got ${finalChainId}. Please manually switch to ${network?.name || `Chain ID ${chainId}`} in your wallet.`,
        )
      }

      console.log(`✅ Confirmed on correct network: ${network?.name || chainId} (Chain ID: ${finalChainId})`)

      // Check and approve tokens if needed
      console.log(`🔄 Checking and approving tokens if needed...`)

      for (const tx of bundle.transactions) {
        // Skip native token transfers
        if (tx.data === "0x" || tx.data === "") continue

        // Check if this is an ERC20 transfer
        if (tx.data.startsWith("0xa9059cbb")) {
          const tokenAddress = tx.to
          const transferData = tx.data.slice(10) // Remove function selector

          // Extract destination and amount from transfer data
          const paddedTo = `0x${transferData.slice(0, 64).slice(24)}`
          const amount = BigInt(`0x${transferData.slice(64)}`)

          console.log(`🔄 Checking ERC20 token ${tokenAddress} for transfer of ${amount} to ${paddedTo}`)

          // Check and approve if needed
          await this.checkAndApproveERC20(tokenAddress, account, amount, pectraContract)
        }

        // Check if this is an ERC721 transferFrom
        else if (tx.data.startsWith("0x23b872dd")) {
          const tokenAddress = tx.to
          const transferData = tx.data.slice(10) // Remove function selector

          // Extract from, to, and tokenId from transfer data
          const paddedFrom = `0x${transferData.slice(0, 64).slice(24)}`
          const paddedTo = `0x${transferData.slice(64, 128).slice(24)}`
          const tokenId = BigInt(`0x${transferData.slice(128)}`)

          console.log(
            `🔄 Checking ERC721 token ${tokenAddress} for transfer of #${tokenId} from ${paddedFrom} to ${paddedTo}`,
          )

          // Check and approve if needed
          await this.checkAndApproveERC721(tokenAddress, account, tokenId, pectraContract)
        }
      }

      // Prepare the batch call data for the Pectra contract
      const targets = bundle.transactions.map((tx) => tx.to as Address)
      const values = bundle.transactions.map((tx) => BigInt(tx.value || "0"))
      const calldatas = bundle.transactions.map((tx) => tx.data as `0x${string}`)

      console.log(`📤 Bundle targets:`, targets)
      console.log(
        `📤 Bundle values:`,
        values.map((v) => v.toString()),
      )
      console.log(`📤 Sending to Pectra contract: ${pectraContract}`)
      console.log(`📤 From account: ${account}`)

      // Verificar si hay suficiente ETH para la transacción
      const totalValue = values.reduce((sum, val) => sum + val, BigInt(0))
      console.log(`💰 Total value being sent: ${totalValue} wei`)

      // Aumentar el gas limit para asegurar que hay suficiente
      const gasLimit = BigInt(bundle.totalGasEstimate) * BigInt(2)
      console.log(`⛽ Using increased gas limit: ${gasLimit}`)

      // Enviar la transacción directamente al contrato Pectra
      const hash = await this.walletClient.writeContract({
        address: pectraContract,
        abi: PECTRA_BUNDLE_ABI,
        functionName: "executeBatch",
        args: [targets, values, calldatas],
        value: totalValue,
        gas: gasLimit,
        account,
      })

      console.log(`✅ Transaction sent successfully:`, hash)

      // Wait for transaction receipt to verify success
      console.log(`⏳ Waiting for transaction to be mined...`)
      const receipt = await this.publicClient?.waitForTransactionReceipt({ hash })

      console.log(`📝 Transaction receipt:`, receipt)

      if (receipt?.status === "success") {
        console.log(`✅ Transaction executed successfully!`)
      } else {
        console.error(`❌ Transaction failed!`)
        throw new Error("Transaction failed on-chain. Check the transaction on the block explorer for more details.")
      }

      return hash
    } catch (error) {
      const errorMsg = this.errorToString(error)
      console.error("❌ Bundle execution failed:", errorMsg)

      // Mostrar información detallada del error para diagnóstico
      console.error("Error details:", JSON.stringify(error, null, 2))

      // Intentar extraer más información del error
      if (typeof error === "object" && error !== null) {
        console.error("Error code:", (error as any).code)
        console.error("Error data:", (error as any).data)
        console.error("Error message:", (error as any).message)
      }

      throw new Error(`Transaction failed: ${errorMsg}. Please check your wallet balance and try again.`)
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

    // Añadir logging de las direcciones de destino:
    console.log(
      `📋 Fallback transaction destinations:`,
      transactions.map((tx) => tx.to),
    )

    // Ensure we're on the correct network for fallback mode too
    const chainId = this.targetChainId || this.currentChain?.id || 11155111 // Default to Sepolia

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
        console.log(`📤 Sending transaction ${i + 1}/${transactions.length}`)

        // Aumentar el gas limit para cada transacción individual
        const gasLimit = tx.gasLimit ? BigInt(tx.gasLimit) * BigInt(2) : BigInt(100000)
        console.log(`⛽ Using increased gas limit for transaction ${i + 1}: ${gasLimit}`)

        const hash = await this.walletClient.sendTransaction({
          account,
          chain: this.currentChain, // Explicitly provide chain
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
      return "0.001000" // Return a reasonable default instead of 0
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
