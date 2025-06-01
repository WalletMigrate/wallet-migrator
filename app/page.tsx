"use client"

import { useState, useEffect } from "react"
import { Wallet, Loader2, AlertCircle, Send, CheckCircle2, Eye, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import type { Network } from "@/components/network-selector"
import { TransactionPreview } from "@/components/transaction-preview"
import { ScamWarning } from "@/components/scam-warning"
import type { PectraBundle } from "@/utils/pectra-bundle"
import { ScamDetector, type Token } from "@/utils/scam-detection"
import { getTokenBalance } from "@/utils/token-balance"
import { EIP7702BundleManager, type EIP7702Bundle } from "@/utils/eip7702-bundle"
// Añadir la importación del componente WalletConnection
import { WalletConnection } from "@/components/wallet-connection"
// Añadir la importación de NetworkSelector que también falta
import { NetworkSelector } from "@/components/network-selector"
// Importar el nuevo componente de header
import { AppHeader } from "@/components/app-header"

// Mover esta definición al inicio del archivo, después de las importaciones
const NETWORKS = [
  {
    id: "sepolia",
    name: "Ethereum Sepolia (EIP-7702 Ready)",
    endpoint: "https://eth-sepolia.blockscout.com/api",
    chainId: 11155111,
    rpcUrl: "https://lb.drpc.org/ogrpc?network=sepolia&dkey=Au_X8MHT5km3gTHdk3Zh9IDmb7qePncR8JNRKiqCbUWs",
    blockExplorer: "https://sepolia.etherscan.io",
    eip7702Supported: true,
  },
  {
    id: "ethereum",
    name: "Ethereum Mainnet",
    endpoint: "https://eth.blockscout.com/api",
    chainId: 1,
    eip7702Supported: false,
  },
  {
    id: "flow",
    name: "Flow EVM",
    endpoint: "https://evm.flowscan.io/api",
    chainId: 747,
    rpcUrl: "https://mainnet.evm.nodes.onflow.org",
    blockExplorer: "https://evm.flowscan.io",
    eip7702Supported: false,
  },
]

// RPC URLs with fallbacks for each network
const NETWORK_RPC_URLS: Record<string, string[]> = {
  sepolia: [
    "https://lb.drpc.org/ogrpc?network=sepolia&dkey=Au_X8MHT5km3gTHdk3Zh9IDmb7qePncR8JNRKiqCbUWs",
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    "https://rpc2.sepolia.org",
  ],
  ethereum: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth", "https://ethereum.publicnode.com"],
  flow: ["https://mainnet.evm.nodes.onflow.org"],
}

// Actualizar NATIVE_TOKENS para incluir Sepolia
const NATIVE_TOKENS: Record<string, Omit<Token, "balance" | "selected">> = {
  ethereum: {
    type: "NATIVE",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    contractAddress: "0x0000000000000000000000000000000000000000",
    isNative: true,
  },
  sepolia: {
    type: "NATIVE",
    name: "Sepolia Ether",
    symbol: "SepoliaETH",
    decimals: 18,
    contractAddress: "0x0000000000000000000000000000000000000000",
    isNative: true,
  },
  polygon: {
    type: "NATIVE",
    name: "Polygon",
    symbol: "MATIC",
    decimals: 18,
    contractAddress: "0x0000000000000000000000000000000000000000",
    isNative: true,
  },
  flow: {
    type: "NATIVE",
    name: "Flow",
    symbol: "FLOW",
    decimals: 18,
    contractAddress: "0x0000000000000000000000000000000000000000",
    isNative: true,
  },
}

// Agregar tokens conocidos de Sepolia para testing
const SEPOLIA_KNOWN_TOKENS = {
  // USDC en Sepolia (para testing)
  "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238": {
    name: "USD Coin (Sepolia)",
    symbol: "USDC",
    decimals: 6,
  },
  // WETH en Sepolia
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": {
    name: "Wrapped Ether (Sepolia)",
    symbol: "WETH",
    decimals: 18,
  },
  // DAI en Sepolia
  "0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6": {
    name: "Dai Stablecoin (Sepolia)",
    symbol: "DAI",
    decimals: 18,
  },
}

// Direcciones actualizadas de tokens importantes en Polygon
const POLYGON_KNOWN_TOKENS = {
  // USDC Native (nueva dirección)
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  // USDC PoS (dirección antigua, mantener por compatibilidad)
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": {
    name: "USD Coin (PoS)",
    symbol: "USDC.e",
    decimals: 6,
  },
  // USDT PoS
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": {
    name: "Tether USD (PoS)",
    symbol: "USDT",
    decimals: 6,
  },
  // DAI PoS
  "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": {
    name: "Dai Stablecoin (PoS)",
    symbol: "DAI",
    decimals: 18,
  },
  // WETH
  "0x7ceb23fd6f0dd0d0d0d0d0d0d0d0d0d0d0d0d0d0": {
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
  },
  // WMATIC
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": {
    name: "Wrapped Matic",
    symbol: "WMATIC",
    decimals: 18,
  },
}

// Agregar tokens conocidos de Flow EVM
const FLOW_KNOWN_TOKENS = {
  // Token 1
  "0x2aabea2058b5ac2d339b163c6ab6f2b6d53aabed": {
    name: "Flow Token 1",
    symbol: "FT1",
    decimals: 18,
  },
  // Token 2
  "0x7f27352d5f83db87a5a3e00f4b07cc2138d8ee52": {
    name: "Flow Token 2",
    symbol: "FT2",
    decimals: 18,
  },
}

// Función para generar un ID único para cada token
const generateTokenId = (token: Omit<Token, "selected">, networkId: string): string => {
  if (token.isNative) {
    return `native-${networkId}`
  }
  if (token.type === "ERC721" && token.tokenId) {
    return `${token.contractAddress}-${token.tokenId}`
  }
  return token.contractAddress
}

// Función específica para Sepolia que verifica tokens conocidos directamente
const fetchSepoliaTokensDirect = async (address: string, selectedNetwork: Network): Promise<Token[]> => {
  console.log("🔍 Fetching Sepolia tokens directly via RPC...")
  console.log(`📋 Checking ${Object.keys(SEPOLIA_KNOWN_TOKENS).length} known tokens for address: ${address}`)

  const tokens: Token[] = []

  for (const [tokenAddress, tokenInfo] of Object.entries(SEPOLIA_KNOWN_TOKENS)) {
    try {
      console.log(`🪙 Checking ${tokenInfo.symbol} at ${tokenAddress}...`)

      const balanceRaw = await getTokenBalance(address, tokenAddress, selectedNetwork)
      const balanceFloat = Number.parseFloat(balanceRaw) / Math.pow(10, tokenInfo.decimals)

      console.log(`📊 ${tokenInfo.symbol} balance: ${balanceRaw} raw = ${balanceFloat} ${tokenInfo.symbol}`)

      // Include tokens even with zero balance for debugging, but mark them
      if (balanceFloat >= 0) {
        tokens.push({
          type: "ERC20",
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          balance: balanceFloat.toFixed(6),
          decimals: tokenInfo.decimals,
          contractAddress: tokenAddress.toLowerCase(),
          selected: false,
          isNative: false,
        })

        if (balanceFloat > 0) {
          console.log(`✅ Found ${tokenInfo.symbol} with balance: ${balanceFloat}`)
        } else {
          console.log(`ℹ️ Found ${tokenInfo.symbol} with zero balance`)
        }
      }
    } catch (error) {
      console.error(`❌ Error checking ${tokenInfo.symbol}:`, error)
    }
  }

  console.log(`✅ Direct RPC check complete: ${tokens.length} tokens found`)
  return tokens
}

// Función específica para Flow EVM que verifica tokens conocidos directamente
const fetchFlowTokensDirect = async (address: string, selectedNetwork: Network): Promise<Token[]> => {
  console.log("🔍 Fetching Flow EVM tokens directly via RPC...")
  console.log(`📋 Checking ${Object.keys(FLOW_KNOWN_TOKENS).length} known tokens for address: ${address}`)

  const tokens: Token[] = []

  for (const [tokenAddress, tokenInfo] of Object.entries(FLOW_KNOWN_TOKENS)) {
    try {
      console.log(`🪙 Checking ${tokenInfo.symbol} at ${tokenAddress}...`)

      const balanceRaw = await getTokenBalance(address, tokenAddress, selectedNetwork)
      const balanceFloat = Number.parseFloat(balanceRaw) / Math.pow(10, tokenInfo.decimals)

      console.log(`📊 ${tokenInfo.symbol} balance: ${balanceRaw} raw = ${balanceFloat} ${tokenInfo.symbol}`)

      // Include tokens even with zero balance for debugging, but mark them
      if (balanceFloat >= 0) {
        tokens.push({
          type: "ERC20",
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          balance: balanceFloat.toFixed(6),
          decimals: tokenInfo.decimals,
          contractAddress: tokenAddress.toLowerCase(),
          selected: false,
          isNative: false,
        })

        if (balanceFloat > 0) {
          console.log(`✅ Found ${tokenInfo.symbol} with balance: ${balanceFloat}`)
        } else {
          console.log(`ℹ️ Found ${tokenInfo.symbol} with zero balance`)
        }
      }
    } catch (error) {
      console.error(`❌ Error checking ${tokenInfo.symbol}:`, error)
    }
  }

  console.log(`✅ Direct RPC check complete: ${tokens.length} tokens found`)
  return tokens
}

export default function TokenViewer() {
  const BLOCKSCOUT_API_KEY = "d7530c00-be3b-45f9-8b2b-65ef9a024de4"
  const [connectedAddress, setConnectedAddress] = useState("")
  const [destinationAddress, setDestinationAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lastRequestTime, setLastRequestTime] = useState(0)
  const [isTransferring, setIsTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(
    NETWORKS.find((n) => n.id === "sepolia") || NETWORKS[0],
  )
  const [tokenCache, setTokenCache] = useState<Record<string, Token[]>>({})
  const [tokenCountsByNetwork, setTokenCountsByNetwork] = useState<Record<string, number>>({})
  const [isLoadingTokenCounts, setIsLoadingTokenCounts] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [bundlePreview, setBundlePreview] = useState<EIP7702Bundle | null>(null)
  const [bundleManager] = useState(() => new EIP7702BundleManager())
  const [isEIP7702Supported, setIsEIP7702Supported] = useState(false)

  const isValidEthereumAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Function to get native token balance using RPC with multiple fallbacks
  const getNativeTokenBalance = async (address: string, network: Network): Promise<string> => {
    console.log(`🔍 Getting native balance for ${network.name}...`)

    // Get RPC URLs for this network
    const rpcUrls = NETWORK_RPC_URLS[network.id] || [network.rpcUrl].filter(Boolean)

    if (rpcUrls.length === 0) {
      console.log(`⚠️ No RPC URLs available for ${network.name}`)
      return "0"
    }

    // Try each RPC URL with timeout
    for (const rpcUrl of rpcUrls) {
      try {
        console.log(`🔄 Trying RPC: ${rpcUrl}`)

        const response = await Promise.race([
          fetch(rpcUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBalance",
              params: [address, "latest"],
              id: 1,
            }),
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), 5000)),
        ])

        if (response.ok) {
          const data = await response.json()
          if (data.result) {
            const balanceInEther = Number.parseInt(data.result, 16) / Math.pow(10, 18)
            console.log(
              `✅ ${network.name} balance from ${rpcUrl}: ${balanceInEther} ${NATIVE_TOKENS[network.id]?.symbol}`,
            )
            return balanceInEther.toFixed(6)
          }
        } else {
          console.log(`⚠️ RPC ${rpcUrl} returned status: ${response.status}`)
        }
      } catch (error) {
        console.log(`⚠️ RPC ${rpcUrl} failed:`, error)
        continue
      }
    }

    // If all RPC calls fail, try MetaMask as fallback for supported networks
    if (network.id !== "flow") {
      try {
        console.log(`🔄 Trying MetaMask fallback for ${network.name}...`)

        if (typeof window !== "undefined" && window.ethereum) {
          // Try to switch to the correct network
          try {
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${network.chainId.toString(16)}` }],
            })
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              console.log(`Network ${network.name} not available in wallet`)
            }
          }

          const balance = await Promise.race([
            window.ethereum.request({
              method: "eth_getBalance",
              params: [address, "latest"],
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("MetaMask timeout")), 5000)),
          ])

          const balanceInEther = Number.parseInt(balance, 16) / Math.pow(10, 18)
          console.log(
            `✅ ${network.name} balance from MetaMask: ${balanceInEther} ${NATIVE_TOKENS[network.id]?.symbol}`,
          )
          return balanceInEther.toFixed(6)
        }
      } catch (metamaskError) {
        console.error(`❌ MetaMask fallback failed for ${network.name}:`, metamaskError)
      }
    }

    console.error(`❌ All methods failed for fetching native balance on ${network.name}`)
    return "0"
  }

  const fetchWithRetry = async (url: string, maxRetries = 3, baseDelay = 1000): Promise<Response> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BLOCKSCOUT_API_KEY}`,
          },
        })

        if (response.status === 429) {
          // Rate limited, wait before retrying
          const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff
          console.log(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        return response
      } catch (error) {
        if (attempt === maxRetries - 1) throw error
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    throw new Error("Max retries exceeded")
  }

  // Función específica para Polygon que verifica tokens conocidos directamente
  const fetchPolygonTokensDirect = async (address: string, selectedNetwork: Network): Promise<Token[]> => {
    console.log("🔍 Fetching Polygon tokens directly via RPC...")
    console.log(`📋 Checking ${Object.keys(POLYGON_KNOWN_TOKENS).length} known tokens for address: ${address}`)

    const tokens: Token[] = []

    for (const [tokenAddress, tokenInfo] of Object.entries(POLYGON_KNOWN_TOKENS)) {
      try {
        console.log(`🪙 Checking ${tokenInfo.symbol} at ${tokenAddress}...`)

        const balanceRaw = await getTokenBalance(address, tokenAddress, selectedNetwork)
        const balanceFloat = Number.parseFloat(balanceRaw) / Math.pow(10, tokenInfo.decimals)

        console.log(`📊 ${tokenInfo.symbol} balance: ${balanceRaw} raw = ${balanceFloat} ${tokenInfo.symbol}`)

        // Include tokens even with zero balance for debugging, but mark them
        if (balanceFloat >= 0) {
          tokens.push({
            type: "ERC20",
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            balance: balanceFloat.toFixed(6),
            decimals: tokenInfo.decimals,
            contractAddress: tokenAddress.toLowerCase(),
            selected: false,
            isNative: false,
          })

          if (balanceFloat > 0) {
            console.log(`✅ Found ${tokenInfo.symbol} with balance: ${balanceFloat}`)
          } else {
            console.log(`ℹ️ Found ${tokenInfo.symbol} with zero balance`)
          }
        }
      } catch (error) {
        console.error(`❌ Error checking ${tokenInfo.symbol}:`, error)
      }
    }

    console.log(`✅ Direct RPC check complete: ${tokens.length} tokens found`)
    return tokens
  }

  // Actualizar la función fetchERC20Tokens para incluir Sepolia
  const fetchERC20Tokens = async (address: string, network: Network): Promise<Token[]> => {
    console.log(`🔍 Fetching ERC20 tokens for ${network.name}...`)

    // Para Sepolia, usar método directo similar a Polygon
    if (network.id === "sepolia") {
      console.log("🔄 Using direct method for Sepolia...")

      // Método 1: Tokens conocidos via RPC directo
      const directTokens = await fetchSepoliaTokensDirect(address, network)

      // Método 2: Blockscout API
      let apiTokens: Token[] = []
      try {
        const blockscoutBaseUrl = network.endpoint
        console.log(`🔗 Fetching from Blockscout: ${blockscoutBaseUrl}`)

        const response = await fetchWithRetry(
          `${blockscoutBaseUrl}?module=account&action=tokenlist&address=${address}&apikey=${BLOCKSCOUT_API_KEY}`,
        )

        if (response.ok) {
          const data = await response.json()
          console.log(`📊 Sepolia Blockscout API response:`, data)

          if (data.status === "1" && data.result && Array.isArray(data.result)) {
            apiTokens = data.result
              .map((token: any) => {
                const isERC721 = token.type === "ERC-721" || token.tokenID !== undefined

                return {
                  type: isERC721 ? ("ERC721" as const) : ("ERC20" as const),
                  name: token.name || "Unknown Token",
                  symbol: token.symbol || "???",
                  balance: isERC721 ? "1" : formatTokenBalance(token.balance, token.decimals),
                  decimals: isERC721 ? undefined : Number.parseInt(token.decimals) || 18,
                  tokenId: isERC721 ? token.tokenID : undefined,
                  contractAddress: token.contractAddress?.toLowerCase(),
                  selected: false,
                  isNative: false,
                }
              })
              .filter((token) => token.contractAddress)

            console.log(`✅ Found ${apiTokens.length} tokens via Blockscout API`)
          }
        }
      } catch (apiError) {
        console.error("❌ Blockscout API failed:", apiError)
      }

      // Combinar resultados, priorizando tokens con balance > 0
      const allTokens = [...directTokens, ...apiTokens]
      const uniqueTokens = new Map<string, Token>()

      allTokens.forEach((token) => {
        const key = token.contractAddress.toLowerCase()
        const existingToken = uniqueTokens.get(key)

        // Priorizar tokens con balance > 0, o si no existe uno previo
        if (!existingToken || Number.parseFloat(token.balance) > Number.parseFloat(existingToken.balance)) {
          uniqueTokens.set(key, token)
        }
      })

      // Filtrar solo tokens con balance > 0 para el resultado final
      const finalTokens = Array.from(uniqueTokens.values()).filter((token) => Number.parseFloat(token.balance) > 0)

      console.log(`✅ Final Sepolia tokens (with balance > 0): ${finalTokens.length}`)
      console.log(
        `📋 Tokens found:`,
        finalTokens.map((t) => `${t.symbol}: ${t.balance}`),
      )

      return finalTokens
    }

    // Para Polygon, intentar múltiples métodos
    if (network.id === "polygon") {
      console.log("🔄 Using multiple methods for Polygon...")

      // Método 1: Tokens conocidos via RPC directo (PRIORITARIO)
      const directTokens = await fetchPolygonTokensDirect(address, network)

      // Método 2: Blockscout API
      let apiTokens: Token[] = []
      try {
        const blockscoutBaseUrl = network.endpoint
        console.log(`🔗 Fetching from Blockscout: ${blockscoutBaseUrl}`)

        const response = await fetchWithRetry(
          `${blockscoutBaseUrl}?module=account&action=tokenlist&address=${address}&apikey=${BLOCKSCOUT_API_KEY}`,
        )

        if (response.ok) {
          const data = await response.json()
          console.log(`📊 Polygon Blockscout API response:`, data)

          if (data.status === "1" && data.result && Array.isArray(data.result)) {
            apiTokens = data.result
              .map((token: any) => {
                const isERC721 = token.type === "ERC-721" || token.tokenID !== undefined

                return {
                  type: isERC721 ? ("ERC721" as const) : ("ERC20" as const),
                  name: token.name || "Unknown Token",
                  symbol: token.symbol || "???",
                  balance: isERC721 ? "1" : formatTokenBalance(token.balance, token.decimals),
                  decimals: isERC721 ? undefined : Number.parseInt(token.decimals) || 18,
                  tokenId: isERC721 ? token.tokenID : undefined,
                  contractAddress: token.contractAddress?.toLowerCase(),
                  selected: false,
                  isNative: false,
                }
              })
              .filter((token) => token.contractAddress)

            console.log(`✅ Found ${apiTokens.length} tokens via Blockscout API`)
          }
        }
      } catch (apiError) {
        console.error("❌ Blockscout API failed:", apiError)
      }

      // Método 3: PolygonScan API como fallback
      let polygonScanTokens: Token[] = []
      try {
        console.log("🔄 Trying PolygonScan API...")
        const polygonScanResponse = await fetch(
          `https://api.polygonscan.com/api?module=account&action=tokenlist&address=${address}&apikey=YourApiKeyToken`,
        )

        if (polygonScanResponse.ok) {
          const polygonScanData = await polygonScanResponse.json()
          console.log("📊 PolygonScan API response:", polygonScanData)

          if (polygonScanData.status === "1" && polygonScanData.result && Array.isArray(polygonScanData.result)) {
            polygonScanTokens = polygonScanData.result
              .map((token: any) => ({
                type: "ERC20" as const,
                name: token.name || "Unknown Token",
                symbol: token.symbol || "???",
                balance: formatTokenBalance(token.balance, token.decimals),
                decimals: Number.parseInt(token.decimals) || 18,
                contractAddress: token.contractAddress?.toLowerCase(),
                selected: false,
                isNative: false,
              }))
              .filter((token) => token.contractAddress)

            console.log(`✅ Found ${polygonScanTokens.length} tokens via PolygonScan API`)
          }
        }
      } catch (polygonScanError) {
        console.error("❌ PolygonScan API failed:", polygonScanError)
      }

      // Combinar resultados de todos los métodos, priorizando tokens con balance > 0
      const allTokens = [...directTokens, ...apiTokens, ...polygonScanTokens]
      const uniqueTokens = new Map<string, Token>()

      allTokens.forEach((token) => {
        const key = token.contractAddress.toLowerCase()
        const existingToken = uniqueTokens.get(key)

        // Priorizar tokens con balance > 0, o si no existe uno previo
        if (!existingToken || Number.parseFloat(token.balance) > Number.parseFloat(existingToken.balance)) {
          uniqueTokens.set(key, token)
        }
      })

      // Filtrar solo tokens con balance > 0 para el resultado final
      const finalTokens = Array.from(uniqueTokens.values()).filter((token) => Number.parseFloat(token.balance) > 0)

      console.log(`✅ Final Polygon tokens (with balance > 0): ${finalTokens.length}`)
      console.log(
        `📋 Tokens found:`,
        finalTokens.map((t) => `${t.symbol}: ${t.balance}`),
      )

      return finalTokens
    }

    // Para Flow EVM, usar método directo similar a Sepolia y Polygon
    if (network.id === "flow") {
      console.log("🔄 Using direct method for Flow EVM...")

      // Método 1: Tokens conocidos via RPC directo
      const directTokens = await fetchFlowTokensDirect(address, network)

      // Método 2: Blockscout API como fallback
      let apiTokens: Token[] = []
      try {
        const blockscoutBaseUrl = network.endpoint
        console.log(`🔗 Fetching from Blockscout: ${blockscoutBaseUrl}`)

        const response = await fetchWithRetry(
          `${blockscoutBaseUrl}?module=account&action=tokenlist&address=${address}&apikey=${BLOCKSCOUT_API_KEY}`,
        )

        if (response.ok) {
          const data = await response.json()
          console.log(`📊 Flow EVM Blockscout API response:`, data)

          if (data.status === "1" && data.result && Array.isArray(data.result)) {
            apiTokens = data.result
              .map((token: any) => {
                const isERC721 = token.type === "ERC-721" || token.tokenID !== undefined

                return {
                  type: isERC721 ? ("ERC721" as const) : ("ERC20" as const),
                  name: token.name || "Unknown Token",
                  symbol: token.symbol || "???",
                  balance: isERC721 ? "1" : formatTokenBalance(token.balance, token.decimals),
                  decimals: isERC721 ? undefined : Number.parseInt(token.decimals) || 18,
                  tokenId: isERC721 ? token.tokenID : undefined,
                  contractAddress: token.contractAddress?.toLowerCase(),
                  selected: false,
                  isNative: false,
                }
              })
              .filter((token) => token.contractAddress)

            console.log(`✅ Found ${apiTokens.length} tokens via Flow EVM Blockscout API`)
          }
        }
      } catch (apiError) {
        console.error("❌ Flow EVM Blockscout API failed:", apiError)
      }

      // Combinar resultados, priorizando tokens con balance > 0
      const allTokens = [...directTokens, ...apiTokens]
      const uniqueTokens = new Map<string, Token>()

      allTokens.forEach((token) => {
        const key = token.contractAddress.toLowerCase()
        const existingToken = uniqueTokens.get(key)

        // Priorizar tokens con balance > 0, o si no existe uno previo
        if (!existingToken || Number.parseFloat(token.balance) > Number.parseFloat(existingToken.balance)) {
          uniqueTokens.set(key, token)
        }
      })

      // Filtrar solo tokens con balance > 0 para el resultado final
      const finalTokens = Array.from(uniqueTokens.values()).filter((token) => Number.parseFloat(token.balance) > 0)

      console.log(`✅ Final Flow EVM tokens (with balance > 0): ${finalTokens.length}`)
      console.log(
        `📋 Tokens found:`,
        finalTokens.map((t) => `${t.symbol}: ${t.balance}`),
      )

      return finalTokens
    }

    // Para otras redes, usar el método original
    try {
      const blockscoutBaseUrl = network.endpoint
      console.log(`🔗 Fetching from: ${blockscoutBaseUrl}`)

      const response = await fetchWithRetry(
        `${blockscoutBaseUrl}?module=account&action=tokenlist&address=${address}&apikey=${BLOCKSCOUT_API_KEY}`,
      )

      if (!response.ok) {
        console.log(`❌ HTTP error! status: ${response.status}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log(`📊 ${network.name} API response:`, data)

      // Manejar diferentes formatos de respuesta de Blockscout
      let tokenList = []

      if (data.status === "1" && data.result) {
        tokenList = data.result
      } else if (data.result && Array.isArray(data.result)) {
        tokenList = data.result
      } else if (data.items && Array.isArray(data.items)) {
        // Algunos endpoints de Blockscout usan 'items' en lugar de 'result'
        tokenList = data.items
      } else {
        console.log(`⚠️ No tokens found or unexpected response format for ${network.name}`)
        return []
      }

      console.log(`📋 Raw token list for ${network.name}:`, tokenList)

      // Transform Blockscout response to our Token interface
      const tokens = tokenList
        .map((token: any) => {
          const isERC721 = token.type === "ERC-721" || token.tokenID !== undefined || token.token_id !== undefined

          // Handle different field names from different Blockscout versions
          const contractAddress = token.contractAddress || token.token?.address || token.address
          const tokenName = token.name || token.token?.name || "Unknown Token"
          const tokenSymbol = token.symbol || token.token?.symbol || "???"
          const tokenBalance = token.balance || token.value || "0"
          const tokenDecimals = token.decimals || token.token?.decimals || "18"
          const tokenId = token.tokenID || token.token_id || token.id

          console.log(`🪙 Processing token: ${tokenName} (${tokenSymbol}) - Balance: ${tokenBalance}`)

          return {
            type: isERC721 ? ("ERC721" as const) : ("ERC20" as const),
            name: tokenName,
            symbol: tokenSymbol,
            balance: isERC721 ? "1" : formatTokenBalance(tokenBalance, tokenDecimals),
            decimals: isERC721 ? undefined : Number.parseInt(tokenDecimals.toString()) || 18,
            tokenId: isERC721 ? tokenId : undefined,
            contractAddress: contractAddress?.toLowerCase(),
            selected: false,
            isNative: false,
          }
        })
        .filter((token) => token.contractAddress) // Filter out tokens without contract address

      console.log(`✅ Found ${tokens.length} valid tokens for ${network.name}`)
      return tokens
    } catch (error) {
      console.error(`❌ Error fetching tokens for ${network.name}:`, error)
      return []
    }
  }

  // Function to fetch token counts for all networks
  const fetchTokenCountsForAllNetworks = async (address: string) => {
    if (!isValidEthereumAddress(address)) {
      return
    }

    setIsLoadingTokenCounts(true)
    const counts: Record<string, number> = {}

    console.log("🔄 Fetching token counts for all networks...")

    try {
      // For each network, either use cached data or fetch new data
      for (const network of NETWORKS) {
        const cacheKey = `${network.id}-${address}`

        // If we have cached tokens for this network, use them to get the count
        if (tokenCache[cacheKey]) {
          counts[network.id] = tokenCache[cacheKey].length
          console.log(`💾 ${network.name}: ${counts[network.id]} tokens (cached)`)
        } else {
          // Otherwise, fetch the count from the API
          try {
            // Start with 1 for native token
            let tokenCount = 1

            if (network.id === "flow") {
              // For Flow EVM, try to get a quick count
              try {
                const response = await fetchWithRetry(
                  `${network.endpoint}?module=account&action=tokenlist&address=${address}&apikey=${BLOCKSCOUT_API_KEY}`,
                )

                if (response.ok) {
                  const data = await response.json()
                  if (data && data.result && Array.isArray(data.result)) {
                    tokenCount += data.result.length
                  }
                }
              } catch (flowError) {
                console.log(`⚠️ Flow token count failed: ${flowError}`)
              }
            } else {
              // For other networks, use Blockscout API
              const response = await fetchWithRetry(
                `${network.endpoint}?module=account&action=tokenlist&address=${address}&apikey=${BLOCKSCOUT_API_KEY}`,
              )

              if (response.ok) {
                const data = await response.json()

                if (data.status === "1" && data.result) {
                  tokenCount += data.result.length
                }
              }
            }

            counts[network.id] = tokenCount
            console.log(`🔍 ${network.name}: ${tokenCount} tokens (fetched)`)
          } catch (error) {
            console.error(`❌ Error fetching tokens for ${network.name}:`, error)
            counts[network.id] = 1 // At least native token
          }
        }
      }

      setTokenCountsByNetwork(counts)
    } catch (error) {
      console.error("❌ Error fetching token counts:", error)
    } finally {
      setIsLoadingTokenCounts(false)
    }
  }

  const handleCheckTokens = async (address: string) => {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    const minInterval = 1000 // 1 second between requests (reduced since we have API key)

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest
      console.log(`Rate limiting: waiting ${waitTime}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    setLastRequestTime(Date.now())

    if (!isValidEthereumAddress(address)) {
      setError("Invalid wallet address")
      return
    }

    const cacheKey = `${selectedNetwork.id}-${address}`
    if (tokenCache[cacheKey]) {
      console.log("Using cached tokens")
      setTokens(tokenCache[cacheKey])
      return
    }

    setIsLoading(true)
    setError(null)
    setTokens([]) // Clear previous tokens while loading

    try {
      console.log(`🚀 Starting token check for ${selectedNetwork.name} (${address})`)

      // Get native token balance first
      const nativeBalance = await getNativeTokenBalance(address, selectedNetwork)

      const nativeToken: Token = {
        ...NATIVE_TOKENS[selectedNetwork.id],
        balance: nativeBalance,
        selected: false,
      }

      // Fetch ERC-20 and ERC-721 tokens
      const erc20Tokens = await fetchERC20Tokens(address, selectedNetwork)

      // Combine native token with ERC tokens
      const allTokens = [nativeToken, ...erc20Tokens]

      // Analyze tokens for scams
      const analyzedTokens = ScamDetector.analyzeTokenList(allTokens)

      console.log(`📊 Total tokens found for ${selectedNetwork.name}: ${analyzedTokens.length}`)

      setTokens(analyzedTokens)

      // Cache the results
      setTokenCache((prev) => ({
        ...prev,
        [cacheKey]: analyzedTokens,
      }))

      console.log(`✅ Successfully loaded ${analyzedTokens.length} tokens for ${selectedNetwork.name}`)
      // Update token counts for this network
      setTokenCountsByNetwork((prev) => ({
        ...prev,
        [selectedNetwork.id]: analyzedTokens.length,
      }))
    } catch (err) {
      console.error(`❌ Error fetching tokens for ${selectedNetwork.name}:`, err)
      setError(err instanceof Error ? err.message : "Failed to fetch tokens")
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-fetch tokens when wallet is connected
  useEffect(() => {
    if (connectedAddress && isValidEthereumAddress(connectedAddress)) {
      handleCheckTokens(connectedAddress)
    } else {
      // Reset tokens if wallet is disconnected
      setTokens([])
    }
  }, [connectedAddress, selectedNetwork])

  // Fetch token counts when wallet is connected
  useEffect(() => {
    if (connectedAddress && isValidEthereumAddress(connectedAddress)) {
      fetchTokenCountsForAllNetworks(connectedAddress)
    }
  }, [connectedAddress])

  const formatTokenBalance = (balance: string, decimals: string | number) => {
    try {
      const decimalPlaces = Number.parseInt(decimals.toString()) || 18
      const balanceNum = Number.parseFloat(balance)

      if (balanceNum === 0) return "0"

      const formattedBalance = balanceNum / Math.pow(10, decimalPlaces)

      if (formattedBalance < 0.001) {
        return formattedBalance.toExponential(2)
      } else if (formattedBalance < 1) {
        return formattedBalance.toFixed(6)
      } else {
        return formattedBalance.toFixed(4)
      }
    } catch (error) {
      return balance
    }
  }

  // Función corregida para manejar selección de tokens por ID único
  const handleTokenSelection = (tokenId: string, selected: boolean) => {
    setTokens((prev) =>
      prev.map((token) => {
        const currentTokenId = generateTokenId(token, selectedNetwork.id)
        return currentTokenId === tokenId ? { ...token, selected } : token
      }),
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setTokens((prev) => prev.map((token) => ({ ...token, selected })))
  }

  const selectedTokens = tokens.filter((token) => token.selected)
  const scamTokens = tokens.filter((token) => token.isScam)
  const legitimateTokens = tokens.filter((token) => !token.isScam)
  const scamStats = ScamDetector.getScamStats(tokens)

  // Añadir este console.log en la función handlePreviewBundle para verificar qué tipo de transacción se está preparando
  const handlePreviewBundle = async () => {
    if (!isValidEthereumAddress(destinationAddress)) {
      setError("Please enter a valid destination address")
      return
    }

    if (selectedTokens.length === 0) {
      setError("Please select at least one token to transfer")
      return
    }

    // Check if any selected tokens are scams
    const selectedScamTokens = selectedTokens.filter((token) => token.isScam)
    if (selectedScamTokens.length > 0) {
      const confirmTransfer = confirm(
        `⚠️ WARNING: You have selected ${selectedScamTokens.length} potential scam token(s). ` +
          `Transferring scam tokens may be dangerous and could result in loss of funds. ` +
          `Are you sure you want to continue?`,
      )
      if (!confirmTransfer) {
        return
      }
    }

    try {
      setError(null)
      console.log("🔄 Starting bundle preview preparation...")

      // Preparar las transacciones bundled
      console.log("📋 Preparing bundled transactions...")
      const transactions = await bundleManager.prepareBundledTransactions(
        selectedTokens,
        connectedAddress,
        destinationAddress,
      )

      // Buscar la función handlePreviewBundle y reemplazar el console.log después de "🔍 TRANSACTION DEBUG:" con:

      console.log("🔍 TRANSACTION DEBUG:", transactions)
      console.log(`📊 Preparando ${transactions.length} transacciones para envío atómico:`)
      transactions.forEach((tx, index) => {
        const functionSelector = tx.data.substring(0, 10)
        let txType = "Desconocido"

        if (tx.data === "0x") {
          txType = "Transferencia ETH"
        } else if (functionSelector === "0xa9059cbb") {
          txType = "Transferencia ERC20"
        } else if (functionSelector === "0x23b872dd") {
          txType = "Transferencia ERC721"
        }

        console.log(`  ${index + 1}. ${txType} -> ${tx.to}, Valor: ${tx.value}, Gas: ${tx.gasLimit || "auto"}`)
      })

      // Estimar gas
      console.log("⛽ Estimating gas for bundle...")
      const totalGas = await bundleManager.estimateGasForBundle(transactions)
      console.log(`✅ Gas estimated: ${totalGas}`)

      // Calcular costo estimado
      console.log("💰 Calculating estimated cost...")
      const estimatedCost = await bundleManager.calculateEstimatedCost(totalGas)
      console.log(`✅ Cost estimated: ${estimatedCost} ETH`)

      const bundle: PectraBundle = {
        transactions,
        totalGasEstimate: totalGas.toString(),
        estimatedCost,
      }

      console.log("✅ Bundle preview prepared successfully:", bundle)
      setBundlePreview(bundle)
      setShowPreview(true)
    } catch (err) {
      console.error("❌ Error preparing bundle:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to prepare bundle"
      setError(`Bundle preparation failed: ${errorMessage}`)

      // Reset preview state on error
      setBundlePreview(null)
      setShowPreview(false)
    }
  }

  // Verificar soporte EIP-7702 cuando cambie la red
  useEffect(() => {
    const checkSupport = async () => {
      if (selectedNetwork.eip7702Supported) {
        const supportInfo = await bundleManager.checkEIP7702Support()
        setIsEIP7702Supported(supportInfo.supported)
        console.log(`🔍 EIP-7702 support: ${supportInfo.supported}`)
        if (supportInfo.contractAddress) {
          console.log(`📋 Using Pectra contract: ${supportInfo.contractAddress}`)
        }
      } else {
        setIsEIP7702Supported(false)
      }
    }

    checkSupport()
  }, [selectedNetwork, bundleManager])

  // Actualizar solo la parte relevante del archivo para establecer el targetChainId

  // En la función TokenViewer, añadir este useEffect:

  useEffect(() => {
    // Cuando cambia la red seleccionada, actualizar el targetChainId en el bundleManager
    if (bundleManager && selectedNetwork) {
      bundleManager.setTargetChainId(selectedNetwork.chainId)
      console.log(`🎯 Set target chain ID to ${selectedNetwork.chainId} (${selectedNetwork.name})`)
    }
  }, [selectedNetwork, bundleManager])

  const handleExecuteBundle = async () => {
    if (!bundlePreview) return

    const confirmMessage = isEIP7702Supported
      ? `🚀 EIP-7702 Atomic Bundle Execution\n\n` +
        `✅ Single signature required\n` +
        `✅ All ${selectedTokens.length} transactions execute atomically\n` +
        `✅ All succeed together or all fail together\n` +
        `✅ Reduced gas costs\n\n` +
        `Your EOA will temporarily act as a smart contract.\n\n` +
        `Do you want to continue?`
      : `⚠️ Sequential Transaction Execution\n\n` +
        `❌ EIP-7702 not available on this network\n` +
        `📝 ${selectedTokens.length} separate signatures required\n` +
        `⚠️ Transactions may partially succeed/fail\n\n` +
        `Do you want to continue?`

    const confirmBatch = confirm(confirmMessage)

    if (!confirmBatch) {
      return
    }

    setIsTransferring(true)
    setError(null)

    try {
      console.log("🚀 Executing bundle with Viem...")

      const txHash = await bundleManager.executeEIP7702Bundle(bundlePreview)

      console.log("✅ Bundle executed successfully:", txHash)

      const successMessage = isEIP7702Supported
        ? `🎉 EIP-7702 Atomic Bundle Executed!\n\n` +
          `Bundle Hash: ${txHash}\n\n` +
          `✅ All ${selectedTokens.length} transactions executed atomically\n` +
          `✅ Single signature used\n` +
          `✅ Gas optimized execution`
        : `✅ Sequential Transactions Completed!\n\n` +
          `First Transaction Hash: ${txHash}\n\n` +
          `Check your wallet for all transaction confirmations.`

      alert(successMessage)

      // Reset selection after successful transfer
      setTokens((prev) => prev.map((token) => ({ ...token, selected: false })))
      setDestinationAddress("")
      setShowPreview(false)
      setBundlePreview(null)
    } catch (err) {
      console.error("❌ Bundle execution failed:", err)
      setError(err instanceof Error ? err.message : "Failed to execute bundle")
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <AppHeader />

      <div className="container max-w-3xl py-6 px-4 mx-auto">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Token Migration Tool
              {isEIP7702Supported && <Zap className="h-5 w-5 text-yellow-500" />}
            </CardTitle>
            <CardDescription>
              Connect your wallet to view tokens and migrate them using EIP-7702 atomic bundles
              {isEIP7702Supported && " - Single signature, atomic execution enabled!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Componente de conexión de wallet - DEBE estar aquí */}
              <WalletConnection onAddressChange={setConnectedAddress} />

              {/* Selector de red */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Network</label>
                  <NetworkSelector
                    selectedNetwork={selectedNetwork}
                    onNetworkChange={setSelectedNetwork}
                    tokenCounts={tokenCountsByNetwork}
                    isLoadingTokens={isLoading || isLoadingTokenCounts}
                  />
                </div>
              </div>
            </div>

            {/* EIP-7702 Status Alert */}
            {selectedNetwork.eip7702Supported && (
              <Alert
                className={`mt-4 ${isEIP7702Supported ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}
              >
                <Zap className={`h-4 w-4 ${isEIP7702Supported ? "text-green-600" : "text-yellow-600"}`} />
                <AlertDescription className={isEIP7702Supported ? "text-green-800" : "text-yellow-800"}>
                  {isEIP7702Supported ? (
                    <>
                      <strong>EIP-7702 Active:</strong> Atomic bundling enabled! Single signature for all transactions.
                    </>
                  ) : (
                    <>
                      <strong>EIP-7702 Checking:</strong> Verifying atomic bundle support...
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Error alert */}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Scam Warning */}
            {tokens.length > 0 && scamStats.scam > 0 && (
              <div className="mt-4">
                <ScamWarning
                  scamCount={scamStats.scam}
                  totalCount={scamStats.total}
                  scamPercentage={scamStats.scamPercentage}
                />
              </div>
            )}

            {isLoading && (
              <div className="mt-6 flex flex-col items-center justify-center py-10 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-sm text-neutral-600">
                  Cargando tokens de {connectedAddress.substring(0, 6)}...{connectedAddress.substring(38)} en{" "}
                  {selectedNetwork.name}
                </span>
              </div>
            )}

            {tokens.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Select Tokens to Transfer</h3>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={tokens.every((token) => token.selected)}
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium">
                      Select All ({selectedTokens.length}/{tokens.length})
                    </label>
                  </div>
                </div>

                <Tabs defaultValue="legitimate">
                  <TabsList className="mb-4">
                    <TabsTrigger value="legitimate" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Legitimate ({legitimateTokens.length})
                    </TabsTrigger>
                    <TabsTrigger value="native">Native</TabsTrigger>
                    <TabsTrigger value="erc20">ERC-20</TabsTrigger>
                    <TabsTrigger value="erc721">ERC-721</TabsTrigger>
                    <TabsTrigger value="scam" className="flex items-center gap-2 text-red-600">
                      ⚠️ Potential Scams ({scamTokens.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="legitimate">
                    <SelectableTokenList
                      tokens={legitimateTokens}
                      onTokenSelection={handleTokenSelection}
                      networkId={selectedNetwork.id}
                    />
                  </TabsContent>

                  <TabsContent value="native">
                    <SelectableTokenList
                      tokens={tokens.filter((token) => token.type === "NATIVE")}
                      onTokenSelection={handleTokenSelection}
                      networkId={selectedNetwork.id}
                    />
                  </TabsContent>

                  <TabsContent value="erc20">
                    <SelectableTokenList
                      tokens={tokens.filter((token) => token.type === "ERC20" && !token.isScam)}
                      onTokenSelection={handleTokenSelection}
                      networkId={selectedNetwork.id}
                    />
                  </TabsContent>

                  <TabsContent value="erc721">
                    <SelectableTokenList
                      tokens={tokens.filter((token) => token.type === "ERC721" && !token.isScam)}
                      onTokenSelection={handleTokenSelection}
                      networkId={selectedNetwork.id}
                    />
                  </TabsContent>

                  <TabsContent value="scam">
                    <div className="space-y-3">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>⚠️ DANGER ZONE:</strong> These tokens are flagged as potential scams. Never interact
                          with them or visit any links they contain. Transferring these tokens is not recommended.
                        </AlertDescription>
                      </Alert>
                      <SelectableTokenList
                        tokens={scamTokens}
                        onTokenSelection={handleTokenSelection}
                        networkId={selectedNetwork.id}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {selectedTokens.length > 0 && !showPreview && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          <span className="font-medium text-blue-800">
                            {selectedTokens.length} token{selectedTokens.length > 1 ? "s" : ""} selected for transfer
                          </span>
                          {selectedTokens.some((token) => token.isScam) && (
                            <Badge variant="destructive" className="ml-2">
                              ⚠️ {selectedTokens.filter((token) => token.isScam).length} scam token(s) selected
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="destination" className="text-sm font-medium text-blue-800">
                            Destination Wallet Address
                          </label>
                          <Input
                            id="destination"
                            placeholder="Enter destination address (0x...)"
                            value={destinationAddress}
                            onChange={(e) => setDestinationAddress(e.target.value)}
                            className="border-blue-300"
                          />
                        </div>

                        <Button
                          onClick={handlePreviewBundle}
                          disabled={!destinationAddress || selectedTokens.length === 0}
                          className="w-full"
                          size="lg"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Preview Bundle Transaction
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showPreview && bundlePreview && (
                  <div className="space-y-4">
                    <TransactionPreview
                      tokens={selectedTokens}
                      fromAddress={connectedAddress}
                      toAddress={destinationAddress}
                      estimatedGas={bundlePreview.totalGasEstimate}
                      estimatedCost={bundlePreview.estimatedCost}
                      onConfirm={handleExecuteBundle}
                      onCancel={() => setShowPreview(false)}
                      isEIP7702Supported={isEIP7702Supported}
                    />

                    <div className="flex gap-3">
                      <Button onClick={handleExecuteBundle} disabled={isTransferring} className="flex-1" size="lg">
                        {isTransferring ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isEIP7702Supported ? "Executing Atomic Bundle..." : "Sending Transactions..."}
                          </>
                        ) : (
                          <>
                            {isEIP7702Supported ? <Zap className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                            {isEIP7702Supported
                              ? `Execute Atomic Bundle (${selectedTokens.length})`
                              : `Send Sequential Transactions (${selectedTokens.length})`}
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => setShowPreview(false)}
                        variant="outline"
                        disabled={isTransferring}
                        size="lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Al final del archivo, después del return statement de TokenViewer, agregar:

// Componente corregido para usar IDs únicos
function SelectableTokenList({
  tokens,
  onTokenSelection,
  networkId,
}: {
  tokens: Token[]
  onTokenSelection: (tokenId: string, selected: boolean) => void
  networkId: string
}) {
  if (tokens.length === 0) {
    return <div className="text-center py-6 text-neutral-500">No tokens found</div>
  }

  return (
    <div className="space-y-3">
      {tokens.map((token) => {
        const tokenId = generateTokenId(token, networkId)
        return (
          <Card key={tokenId} className={`overflow-hidden ${token.isScam ? "border-red-200 bg-red-50" : ""}`}>
            <div className="p-4 flex items-center gap-4">
              <Checkbox
                checked={token.selected}
                onCheckedChange={(checked) => onTokenSelection(tokenId, checked as boolean)}
              />
              <div className="flex items-center justify-between flex-1">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{token.name}</span>
                    <Badge
                      variant={token.type === "NATIVE" ? "default" : token.type === "ERC20" ? "secondary" : "outline"}
                    >
                      {token.type}
                    </Badge>
                    {token.isNative && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Native
                      </Badge>
                    )}
                    {token.isScam && token.scamReason && (
                      <div className="group relative">
                        <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
                          ⚠️ SCAM
                        </Badge>
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64 p-2 bg-red-50 border border-red-200 rounded shadow-lg">
                          <div className="text-xs text-red-800">
                            <strong>Potential scam reasons:</strong>
                            <div className="mt-1">{token.scamReason}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-neutral-500 mt-1">
                    {token.symbol} •{" "}
                    {token.isNative
                      ? "Native Token"
                      : `${token.contractAddress.substring(0, 6)}...${token.contractAddress.substring(38)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {token.type === "ERC721" ? `#${token.tokenId}` : `${token.balance} ${token.symbol}`}
                  </div>
                  {token.type === "ERC20" && (
                    <div className="text-sm text-neutral-500">
                      {token.decimals !== undefined ? `${token.decimals} decimals` : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
