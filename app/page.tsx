"use client"

import { useState } from "react"
import { Wallet, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
}

// Blockscout API endpoints for different networks
const BLOCKSCOUT_ENDPOINTS = {
  gnosis: "https://gnosis.blockscout.com/api",
  ethereum: "https://eth.blockscout.com/api",
  polygon: "https://polygon.blockscout.com/api",
  optimism: "https://optimism.blockscout.com/api",
  // Add more networks as needed
}

export default function TokenViewer() {
  const [address, setAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(NETWORKS[0]) // Default to Gnosis

  const isValidEthereumAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const handleCheckTokens = async () => {
    if (!isValidEthereumAddress(address)) {
      setError("Please enter a valid Ethereum address")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Using Gnosis Chain Blockscout API as default
      // You can change this to any Blockscout-compatible endpoint
      const blockscoutBaseUrl = selectedNetwork.endpoint

      const response = await fetch(`${blockscoutBaseUrl}?module=account&action=tokenlist&address=${address}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.status !== "1") {
        throw new Error(data.message || "Failed to fetch tokens from Blockscout")
      }

      // Transform Blockscout response to our Token interface
      const formattedTokens: Token[] = data.result.map((token: any) => {
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
        }
      })

      setTokens(formattedTokens)
    } catch (err) {
      console.error("Error fetching tokens:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch tokens")
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to format token balance
  const formatTokenBalance = (balance: string, decimals: string | number) => {
    try {
      const decimalPlaces = Number.parseInt(decimals.toString()) || 18
      const balanceNum = Number.parseFloat(balance)

      if (balanceNum === 0) return "0"

      // Convert from wei to token units
      const formattedBalance = balanceNum / Math.pow(10, decimalPlaces)

      // Format with appropriate decimal places
      if (formattedBalance < 0.001) {
        return formattedBalance.toExponential(2)
      } else if (formattedBalance < 1) {
        return formattedBalance.toFixed(6)
      } else {
        return formattedBalance.toFixed(4)
      }
    } catch (error) {
      return balance // Return original balance if formatting fails
    }
  }

  return (
    <div className="container max-w-3xl py-10 px-4 mx-auto">
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Ethereum Token Viewer
          </CardTitle>
          <CardDescription>View all ERC-20 and ERC-721 tokens owned by an Ethereum wallet address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <WalletConnection onAddressChange={setAddress} />

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Network</label>
                <NetworkSelector selectedNetwork={selectedNetwork} onNetworkChange={setSelectedNetwork} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Enter Ethereum address (0x...)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleCheckTokens} disabled={isLoading || !address} className="whitespace-nowrap">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Check Tokens"
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {tokens.length > 0 && (
            <div className="mt-6">
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Tokens</TabsTrigger>
                  <TabsTrigger value="erc20">ERC-20</TabsTrigger>
                  <TabsTrigger value="erc721">ERC-721 (NFTs)</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  <TokenList tokens={tokens} />
                </TabsContent>

                <TabsContent value="erc20">
                  <TokenList tokens={tokens.filter((token) => token.type === "ERC20")} />
                </TabsContent>

                <TabsContent value="erc721">
                  <TokenList tokens={tokens.filter((token) => token.type === "ERC721")} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {!isLoading && tokens.length === 0 && address && !error && (
            <div className="mt-6 text-center py-10 text-neutral-500">No tokens found for this address</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TokenList({ tokens }: { tokens: Token[] }) {
  if (tokens.length === 0) {
    return <div className="text-center py-6 text-neutral-500">No tokens found</div>
  }

  return (
    <div className="space-y-3">
      {tokens.map((token, index) => (
        <Card key={index} className="overflow-hidden">
          <div className="p-4 flex items-center justify-between">
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
        </Card>
      ))}
    </div>
  )
}
