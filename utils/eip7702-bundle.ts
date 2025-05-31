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

export class EIP7702BundleManager {
  private ethereum: any

  constructor() {
    if (typeof window !== "undefined") {
      this.ethereum = (window as any).ethereum
    }
  }

  /**
   * Convierte un error a string de forma segura
   */
  private errorToString(error: any): string {
    if (typeof error === "string") {
      return error
    }

    if (error instanceof Error) {
      return error.message
    }

    if (error && typeof error === "object") {
      if (error.message) return error.message
      if (error.reason) return error.reason
      if (error.data?.message) return error.data.message
      if (error.error?.message) return error.error.message
      if (error.code) return `Error code ${error.code}: ${error.message || "Unknown error"}`

      try {
        return JSON.stringify(error, null, 2)
      } catch {
        return String(error)
      }
    }

    return String(error)
  }

  /**
   * Verifica si la red actual soporta EIP-7702
   */
  async checkEIP7702Support(): Promise<boolean> {
    try {
      if (!this.ethereum) return false

      // Verificar si estamos en Sepolia (chainId 11155111)
      const chainId = await this.ethereum.request({ method: "eth_chainId" })
      const chainIdDecimal = Number.parseInt(chainId, 16)

      console.log(`🔍 Current chain ID: ${chainIdDecimal}`)

      if (chainIdDecimal === 11155111) {
        console.log("✅ Sepolia detected - EIP-7702 supported")
        return true
      }

      // Verificar si el proveedor soporta métodos EIP-7702
      try {
        await this.ethereum.request({
          method: "eth_sendBundle",
          params: [],
        })
        console.log("✅ EIP-7702 methods detected")
        return true
      } catch (error) {
        console.log("⚠️ EIP-7702 methods not available")
        return false
      }
    } catch (error) {
      console.error("❌ Error checking EIP-7702 support:", error)
      return false
    }
  }

  /**
   * Prepara las transacciones bundled según EIP-7702
   */
  prepareBundledTransactions(tokens: Token[], fromAddress: string, toAddress: string): EIP7702Transaction[] {
    const transactions: EIP7702Transaction[] = []

    // Validate addresses
    if (!fromAddress || !toAddress) {
      throw new Error("From and to addresses are required")
    }

    if (!this.isValidEthereumAddress(fromAddress) || !this.isValidEthereumAddress(toAddress)) {
      throw new Error("Invalid address format")
    }

    console.log(`📋 Preparing EIP-7702 bundle: ${tokens.length} transactions from ${fromAddress} to ${toAddress}`)

    for (const token of tokens) {
      console.log(`🔄 Processing token: ${token.name} (${token.symbol}) - Type: ${token.type}`)

      if (token.type === "NATIVE") {
        // Transferencia de token nativo
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
          gasLimit: "0x5208", // 21000 gas para transferencia nativa
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
          gasLimit: "0xC350", // 50000 gas estimado para ERC20
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
          gasLimit: "0x11170", // 70000 gas estimado para ERC721
        })
      }
    }

    console.log(`✅ Prepared ${transactions.length} EIP-7702 transactions`)
    return transactions
  }

  /**
   * Codifica la llamada transfer de ERC20
   */
  private encodeERC20Transfer(to: string, amount: bigint): string {
    const toAddress = to.slice(2).toLowerCase().padStart(64, "0")
    const amountHex = amount.toString(16).padStart(64, "0")
    const encoded = `${ERC20_TRANSFER_SELECTOR}${toAddress}${amountHex}`
    console.log(`🔧 ERC20 transfer encoded: ${encoded}`)
    return encoded
  }

  /**
   * Codifica la llamada transferFrom de ERC721
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
   * Convierte balance de token a cantidad en wei/unidades base
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
   * Estima el gas total para el bundle EIP-7702
   */
  async estimateGasForBundle(transactions: EIP7702Transaction[]): Promise<bigint> {
    let totalGas = BigInt(0)

    console.log(`⛽ Estimating gas for EIP-7702 bundle: ${transactions.length} transactions`)

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]
      try {
        console.log(`⛽ Estimating gas for transaction ${i + 1}:`, tx)

        const gasEstimate = await this.ethereum.request({
          method: "eth_estimateGas",
          params: [
            {
              to: tx.to,
              data: tx.data,
              value: tx.value,
            },
          ],
        })

        const gasAmount = BigInt(gasEstimate)
        totalGas += gasAmount
        console.log(`✅ Transaction ${i + 1} gas estimate: ${gasAmount}`)
      } catch (error) {
        const errorMsg = this.errorToString(error)
        console.warn(`⚠️ Gas estimation failed for transaction ${i + 1}:`, errorMsg)

        const fallbackGas = BigInt(tx.gasLimit || "0x5208")
        totalGas += fallbackGas
        console.log(`🔄 Using fallback gas for transaction ${i + 1}: ${fallbackGas}`)
      }
    }

    // Agregar overhead para EIP-7702 bundle (5% adicional)
    const bundleOverhead = (totalGas * BigInt(105)) / BigInt(100)
    console.log(`⛽ Total estimated gas with EIP-7702 overhead: ${totalGas} -> ${bundleOverhead}`)
    return bundleOverhead
  }

  /**
   * Ejecuta el bundle usando EIP-7702 nativo
   */
  async executeEIP7702Bundle(bundle: EIP7702Bundle): Promise<string> {
    if (!this.ethereum) {
      throw new Error("No wallet detected")
    }

    console.log(`🚀 Starting EIP-7702 bundle execution with ${bundle.transactions.length} transactions`)

    // Verificar soporte EIP-7702
    const eip7702Supported = await this.checkEIP7702Support()

    if (!eip7702Supported) {
      console.log("⚠️ EIP-7702 not supported, falling back to sequential transactions")
      return await this.executeBatchTransactions(bundle.transactions)
    }

    try {
      console.log("🔄 Attempting native EIP-7702 bundle execution...")

      // Método EIP-7702: Bundle nativo
      const bundleParams = {
        transactions: bundle.transactions.map((tx) => ({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          gas: tx.gasLimit,
        })),
        gasLimit: bundle.totalGasEstimate,
      }

      console.log("📦 EIP-7702 Bundle params:", bundleParams)

      // Intentar diferentes métodos EIP-7702
      const eip7702Methods = ["eth_sendBundle", "eth_sendTransactionBundle", "wallet_sendBundle", "pectra_sendBundle"]

      for (const method of eip7702Methods) {
        try {
          console.log(`🔄 Trying EIP-7702 method: ${method}`)

          const result = await this.ethereum.request({
            method: method,
            params: [bundleParams],
          })

          console.log(`✅ EIP-7702 bundle executed successfully with ${method}:`, result)
          return result.hash || result.bundleHash || result
        } catch (methodError) {
          const errorMsg = this.errorToString(methodError)
          console.log(`⚠️ Method ${method} failed:`, errorMsg)
          continue
        }
      }

      // Si ningún método EIP-7702 funciona, usar fallback
      console.log("🔄 All EIP-7702 methods failed, using fallback")
      return await this.executeBatchTransactions(bundle.transactions)
    } catch (error) {
      const errorMsg = this.errorToString(error)
      console.error("❌ EIP-7702 bundle execution failed:", errorMsg)
      throw new Error(`EIP-7702 bundle execution failed: ${errorMsg}`)
    }
  }

  /**
   * Ejecuta múltiples transacciones secuencialmente (fallback)
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

    // Ejecutar transacciones una por una
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

        // Pequeña pausa entre transacciones para evitar nonce conflicts
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
    return txHashes[0] // Retornar el hash de la primera transacción
  }

  /**
   * Obtiene el precio actual del gas
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
      const defaultGasPrice = BigInt("20000000000") // 20 gwei por defecto
      console.log(`🔄 Using default gas price: ${defaultGasPrice} wei`)
      return defaultGasPrice
    }
  }

  /**
   * Calcula el costo estimado en ETH
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
   * Valida si una dirección es una dirección Ethereum válida
   */
  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }
}

export type { EIP7702Transaction, EIP7702Bundle }
