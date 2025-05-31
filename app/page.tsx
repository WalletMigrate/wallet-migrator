"use client"

import { useState, useEffect } from "react"
import { Wallet, Loader2, AlertCircle, Send, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { WalletConnection } from "@/components/wallet-connection"
import { NetworkSelector, NETWORKS, type Network } from "@/components/network-selector"

interface Token {
  type: "ERC20" | "ERC721"
  name: string
  symbol: string
  balance: string
  decimals?: number
  tokenId?: string
  contractAddress: string
  selected?: boolean
}

interface BlockscoutResponse {
  status: string
  message: string
  result: BlockscoutToken[]
}

interface BlockscoutToken {
  type: string
  name: string
  symbol: string
  balance: string
  decimals: string
  tokenID?: string
  contractAddress: string
}

// Blockscout API endpoints for different networks
const BLOCKSCOUT_ENDPOINTS = {
  gnosis: "https://gnosis.blockscout.com/api",
  ethereum: "https://eth.blockscout.com/api",
  polygon: "https://polygon.blockscout.com/api",
  optimism: "https://optimism.blockscout.com/api",
  // Add more networks as needed
}


// Cache para almacenar resultados de solicitudes
const requestCache = new Map<string, { data: BlockscoutResponse; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos en milisegundos

// Función para hacer solicitudes con reintentos
async function fetchWithRetry(url: string, maxRetries = 3) {
  let retries = 0
  while (retries < maxRetries) {
    try {
      const response = await fetch(url)
      if (response.status === 429) {
        // Esperar con backoff exponencial
        const delay = Math.pow(2, retries) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        retries++
        continue
      }
      return response
    } catch (error) {
      if (retries === maxRetries - 1) throw error
      retries++
      const delay = Math.pow(2, retries) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries reached')
}

export default function TokenViewer() {
  const [connectedAddress, setConnectedAddress] = useState("")
  const [destinationAddress, setDestinationAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(NETWORKS[0])

  const isValidEthereumAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const handleCheckTokens = async (address: string) => {
    if (!isValidEthereumAddress(address)) {
      setError("Invalid wallet address")
      return
    }

    setIsLoading(true)
    setError(null)
    setTokens([]) // Clear previous tokens while loading

    try {
      const blockscoutBaseUrl = selectedNetwork.endpoint

      console.log(`Fetching tokens for ${address} from ${blockscoutBaseUrl}...`)
      const cacheKey = `${blockscoutBaseUrl}-${address}`
      const cachedData = requestCache.get(cacheKey)

      // Verificar si tenemos datos en caché y si no han expirado
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        const formattedTokens = formatTokens(cachedData.data.result)
        setTokens(formattedTokens)
        setIsLoading(false)
        return
      }

      const response = await fetchWithRetry(
        `${blockscoutBaseUrl}?module=account&action=tokenlist&address=${address}`
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("API response:", data)

      if (data.status !== "1" && data.result.length === 0) {
        // Some Blockscout instances return status "0" even when successful but empty
        setTokens([])
        return
      }

      if (data.status !== "1" && !data.result) {
        throw new Error(data.message || "Failed to fetch tokens from Blockscout")
      }
// Transform Blockscout response to our Token interface
const formattedTokens: Token[] = (data.result || []).map((token: any) => {
  // Determine token type based on available fields
  const isERC721 = token.type === "ERC-721" || token.tokenID !== undefined

  return {
    type: isERC721 ? ("ERC721" as const) : ("ERC20" as const),
    name: token.name || "Unknown Token",
    symbol: token.symbol || "???",
    balance: isERC721 ? "1" : formatTokenBalance(token.balance, token.decimals),
    decimals: isERC721 ? undefined : Number.parseInt(token.decimals) || 18,
    tokenId: isERC721 ? token.tokenID : undefined,
    contractAddress: token.contractAddress,
    selected: false,
  }
})

// Guardar en caché
requestCache.set(cacheKey, {
  data,
  timestamp: Date.now()
})


      const formattedTokens = formatTokens(data.result)
      setTokens(formattedTokens)
    } catch (err) {
      console.error("Error fetching tokens:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch tokens")
    } finally {
      setIsLoading(false)
    }
  }
// Función auxiliar para formatear tokens
const formatTokens = (tokens: BlockscoutToken[]): Token[] => {
  return tokens.map((token: BlockscoutToken) => {
    const isERC721 = token.type === "ERC-721" || token.tokenID !== undefined

    return {
      type: isERC721 ? ("ERC721" as const) : ("ERC20" as const),
      name: token.name || "Unknown Token",
      symbol: token.symbol || "???",
      balance: isERC721 ? "1" : formatTokenBalance(token.balance, token.decimals),
      decimals: isERC721 ? undefined : Number.parseInt(token.decimals) || 18,
      tokenId: isERC721 ? token.tokenID : undefined,
      contractAddress: token.contractAddress,
    }
  })
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

  const handleTokenSelection = (index: number, selected: boolean) => {
    setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, selected } : token)))
  }

  const handleSelectAll = (selected: boolean) => {
    setTokens((prev) => prev.map((token) => ({ ...token, selected })))
  }

  const selectedTokens = tokens.filter((token) => token.selected)

  const handleBundledTransfer = async () => {
    if (!isValidEthereumAddress(destinationAddress)) {
      setError("Please enter a valid destination address")
      return
    }

    if (selectedTokens.length === 0) {
      setError("Please select at least one token to transfer")
      return
    }

    setIsTransferring(true)
    setError(null)

    try {
      // EIP-7722 (Pectra) bundled transaction implementation
      // This is a placeholder for the actual implementation

      if (!window.ethereum) {
        throw new Error("No wallet detected")
      }

      // Prepare bundled transaction data
      const bundledTxData = selectedTokens.map((token) => {
        if (token.type === "ERC20") {
          // ERC20 transfer function signature: transfer(address,uint256)
          return {
            to: token.contractAddress,
            data: `0xa9059cbb${destinationAddress.slice(2).padStart(64, "0")}${Number.parseInt(token.balance).toString(16).padStart(64, "0")}`,
            value: "0x0",
          }
        } else {
          // ERC721 transferFrom function signature: transferFrom(address,address,uint256)
          return {
            to: token.contractAddress,
            data: `0x23b872dd${connectedAddress.slice(2).padStart(64, "0")}${destinationAddress.slice(2).padStart(64, "0")}${Number.parseInt(
              token.tokenId || "0",
            )
              .toString(16)
              .padStart(64, "0")}`,
            value: "0x0",
          }
        }
      })

      // For now, we'll simulate the bundled transaction
      // In a real implementation, you would use EIP-7722 specific methods
      console.log("Bundled transaction data:", bundledTxData)

      // Simulate transaction delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      alert(`Successfully prepared bundled transfer of ${selectedTokens.length} tokens to ${destinationAddress}`)

      // Reset selection after successful transfer
      setTokens((prev) => prev.map((token) => ({ ...token, selected: false })))
      setDestinationAddress("")
    } catch (err) {
      console.error("Error executing bundled transfer:", err)
      setError(err instanceof Error ? err.message : "Failed to execute bundled transfer")
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
            Ethereum Token Migration (EIP-7722)
          </CardTitle>
          <CardDescription>
            Connect your wallet to view tokens and migrate them to another address in a single bundled transaction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <WalletConnection onAddressChange={setConnectedAddress} />

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Network</label>
                <NetworkSelector selectedNetwork={selectedNetwork} onNetworkChange={setSelectedNetwork} />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="mt-6 flex flex-col items-center justify-center py-10 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="text-sm text-neutral-600">
                Cargando tokens de {connectedAddress.substring(0, 6)}...{connectedAddress.substring(38)}
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

              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Tokens</TabsTrigger>
                  <TabsTrigger value="erc20">ERC-20</TabsTrigger>
                  <TabsTrigger value="erc721">ERC-721 (NFTs)</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  <SelectableTokenList tokens={tokens} onTokenSelection={handleTokenSelection} />
                </TabsContent>

                <TabsContent value="erc20">
                  <SelectableTokenList
                    tokens={tokens.filter((token) => token.type === "ERC20")}
                    onTokenSelection={handleTokenSelection}
                  />
                </TabsContent>

                <TabsContent value="erc721">
                  <SelectableTokenList
                    tokens={tokens.filter((token) => token.type === "ERC721")}
                    onTokenSelection={handleTokenSelection}
                  />
                </TabsContent>
              </Tabs>

              {selectedTokens.length > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-blue-800">
                          {selectedTokens.length} token{selectedTokens.length > 1 ? "s" : ""} selected for transfer
                        </span>
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
                        onClick={handleBundledTransfer}
                        disabled={isTransferring || !destinationAddress || selectedTokens.length === 0}
                        className="w-full"
                        size="lg"
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Executing Bundled Transfer...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Transfer {selectedTokens.length} Token{selectedTokens.length > 1 ? "s" : ""} (EIP-7722)
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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

function SelectableTokenList({
  tokens,
  onTokenSelection,
}: {
  tokens: Token[]
  onTokenSelection: (index: number, selected: boolean) => void
}) {
  if (tokens.length === 0) {
    return <div className="text-center py-6 text-neutral-500">No tokens found</div>
  }

  return (
    <div className="space-y-3">
      {tokens.map((token, index) => (
        <Card key={index} className="overflow-hidden">
          <div className="p-4 flex items-center gap-4">
            <Checkbox
              checked={token.selected}
              onCheckedChange={(checked) => onTokenSelection(index, checked as boolean)}
            />
            <div className="flex items-center justify-between flex-1">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{token.name}</span>
                  <Badge variant={token.type === "ERC20" ? "default" : "secondary"}>{token.type}</Badge>
                </div>
                <div className="text-sm text-neutral-500 mt-1">
                  {token.symbol} • {token.contractAddress.substring(0, 6)}...{token.contractAddress.substring(38)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{token.type === "ERC20" ? token.balance : `#${token.tokenId}`}</div>
                {token.type === "ERC20" && (
                  <div className="text-sm text-neutral-500">
                    {token.decimals !== undefined ? `${token.decimals} decimals` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
