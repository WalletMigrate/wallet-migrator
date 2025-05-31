"use client"

import { useState, useEffect } from "react"
import { Wallet, Loader2, AlertCircle, Send, CheckCircle2, Eye, X, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { WalletConnection } from "@/components/wallet-connection"
import { NetworkSelector, type Network } from "@/components/network-selector"
import { TransactionPreview } from "@/components/transaction-preview"
import { ScamWarning, ScamTokenBadge } from "@/components/scam-warning"
import type { PectraBundle } from "@/utils/pectra-bundle"
import { ScamDetector, type Token } from "@/utils/scam-detection"
import { getTokenBalance } from "@/utils/token-balance" // Import getTokenBalance
import { EIP7702BundleManager, type EIP7702Bundle } from "@/utils/eip7702-bundle"

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

  const isValidEthereumAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Function to get native token balance using RPC
  const getNativeTokenBalance = async (address: string, network: Network): Promise<string> => {
    try {
      console.log(`🔍 Getting native balance for ${network.name}...`)

      if (network.id === "flow") {
        // For Flow EVM, use direct RPC call
        try {
          const response = await fetch(network.rpcUrl || "https://mainnet.evm.nodes.onflow.org", {
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
          })

          if (response.ok) {
            const data = await response.json()
            if (data.result) {
              const balanceInEther = Number.parseInt(data.result, 16) / Math.pow(10, 18)
              console.log(`✅ Flow native balance: ${balanceInEther} FLOW`)
              return balanceInEther.toFixed(6)
            }
          }
        } catch (flowError) {
          console.log("⚠️ Flow RPC call failed:", flowError)
        }
        return "0"
      } else {
        // For other networks, use MetaMask
        if (typeof window === "undefined" || !window.ethereum) {
          return "0"
        }

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

        const balance = await window.ethereum.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        })

        const balanceInEther = Number.parseInt(balance, 16) / Math.pow(10, 18)
        console.log(`✅ ${network.name} balance: ${balanceInEther} ${NATIVE_TOKENS[network.id]?.symbol}`)
        return balanceInEther.toFixed(6)
      }
    } catch (error) {
      console.error(`❌ Error fetching native balance for ${network.name}:`, error)
      return "0"
    }
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

      // Preparar las transacciones bundled
      const transactions = bundleManager.prepareBundledTransactions(
        selectedTokens,
        connectedAddress,
        destinationAddress,
      )

      // Estimar gas
      const totalGas = await bundleManager.estimateGasForBundle(transactions)
      const estimatedCost = await bundleManager.calculateEstimatedCost(totalGas)

      const bundle: PectraBundle = {
        transactions,
        totalGasEstimate: totalGas.toString(),
        estimatedCost,
      }

      setBundlePreview(bundle)
      setShowPreview(true)
    } catch (err) {
      console.error("Error preparing bundle:", err)
      setError(err instanceof Error ? err.message : "Failed to prepare bundle")
    }
  }

  const handleExecuteBundle = async () => {
    if (!bundlePreview) return

    // Verificar soporte EIP-7702
    const eip7702Supported = await bundleManager.checkEIP7702Support()

    const confirmMessage = eip7702Supported
      ? `You are about to send ${selectedTokens.length} transactions as an EIP-7702 atomic bundle.\n\n` +
        `This will be executed as a single transaction on Sepolia using native Pectra support.\n\n` +
        `Do you want to continue?`
      : `EIP-7702 not available. You are about to send ${selectedTokens.length} transactions sequentially.\n\n` +
        `Your wallet will ask you to sign each transaction individually.\n\n` +
        `Do you want to continue?`

    const confirmBatch = confirm(confirmMessage)

    if (!confirmBatch) {
      return
    }

    setIsTransferring(true)
    setError(null)

    try {
      console.log("🚀 Executing EIP-7702 bundle...")

      const txHash = await bundleManager.executeEIP7702Bundle(bundlePreview)

      console.log("✅ EIP-7702 bundle executed successfully:", txHash)

      const successMessage = eip7702Supported
        ? `EIP-7702 bundle executed successfully!\n\nBundle hash: ${txHash}\n\nAll transactions were executed atomically.`
        : `Transactions sent successfully!\n\nFirst transaction hash: ${txHash}\n\nCheck your wallet for all transaction confirmations.`

      alert(successMessage)

      // Reset selection after successful transfer
      setTokens((prev) => prev.map((token) => ({ ...token, selected: false })))
      setDestinationAddress("")
      setShowPreview(false)
      setBundlePreview(null)
    } catch (err) {
      console.error("❌ EIP-7702 bundle execution failed:", err)
      setError(err instanceof Error ? err.message : "Failed to execute EIP-7702 bundle")
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <div className="container max-w-3xl py-10 px-4 mx-auto">
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Ethereum Token Migration (EIP-7702 Pectra)
          </CardTitle>
          <CardDescription>
            Connect your wallet to view tokens and migrate them to another address using EIP-7702 bundled transactions
            (Pectra upgrade)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <WalletConnection onAddressChange={setConnectedAddress} />

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
                        <strong>⚠️ DANGER ZONE:</strong> These tokens are flagged as potential scams. Never interact with
                        them or visit any links they contain. Transferring these tokens is not recommended.
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
                  />

                  <div className="flex gap-3">
                    <Button onClick={handleExecuteBundle} disabled={isTransferring} className="flex-1" size="lg">
                      {isTransferring ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Executing EIP-7702 Bundle...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Execute EIP-7702 Bundle ({selectedTokens.length})
                        </>
                      )}
                    </Button>

                    <Button onClick={() => setShowPreview(false)} variant="outline" disabled={isTransferring} size="lg">
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isLoading && tokens.length === 0 && connectedAddress && !error && (
            <div className="mt-6 text-center py-10 text-neutral-500">No tokens found for this wallet</div>
          )}

          {!connectedAddress && (
            <div className="mt-6 text-center py-10 text-neutral-500">
              Connect your wallet to view and transfer tokens
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

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
                    {token.isScam && token.scamReason && <ScamTokenBadge reasons={token.scamReason} />}
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

const NETWORKS = [
  {
    id: "sepolia",
    name: "Ethereum Sepolia (EIP-7702 Ready)",
    endpoint: "https://eth-sepolia.blockscout.com/api",
    chainId: 11155111,
    rpcUrl: "https://sepolia.infura.io/v3/",
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
