"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Fuel, Clock, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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

interface TransactionPreviewProps {
  tokens: Token[]
  fromAddress: string
  toAddress: string
  estimatedGas?: string
  estimatedCost?: string
  onConfirm: () => void
  onCancel: () => void
}

export function TransactionPreview({
  tokens,
  fromAddress,
  toAddress,
  estimatedGas,
  estimatedCost,
}: TransactionPreviewProps) {
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(38)}`
  }

  const getTotalValue = () => {
    const nativeTokens = tokens.filter((t) => t.type === "NATIVE")
    const totalNative = nativeTokens.reduce((sum, token) => sum + Number.parseFloat(token.balance), 0)
    return totalNative > 0 ? `${totalNative.toFixed(6)} ETH` : "0 ETH"
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <ArrowRight className="h-5 w-5" />
          EIP-7702 Bundle Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From/To Addresses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">From:</span>
            <span className="text-sm font-mono text-blue-600">{formatAddress(fromAddress)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">To:</span>
            <span className="text-sm font-mono text-blue-600">{formatAddress(toAddress)}</span>
          </div>
        </div>

        <Separator />

        {/* Tokens to Transfer */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-blue-800">Tokens to Transfer ({tokens.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {tokens.map((token, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                <div className="flex items-center gap-2">
                  <Badge variant={token.type === "NATIVE" ? "default" : "secondary"} className="text-xs">
                    {token.type}
                  </Badge>
                  <span className="text-sm font-medium">{token.name}</span>
                </div>
                <span className="text-sm">
                  {token.type === "ERC721" ? `#${token.tokenId}` : `${token.balance} ${token.symbol}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Gas and Cost Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Estimated Gas:</span>
            </div>
            <span className="text-sm text-blue-600">{estimatedGas || "Calculating..."}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Estimated Cost:</span>
            </div>
            <span className="text-sm text-blue-600">{estimatedCost ? `${estimatedCost} ETH` : "Calculating..."}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">Total Value:</span>
            <span className="text-sm text-blue-600">{getTotalValue()}</span>
          </div>
        </div>

        {/* Warning */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>EIP-7702 Bundle Transaction:</strong> This will send {tokens.length} transactions as a single atomic
            bundle using the Pectra upgrade.
            {tokens.length > 1 && " All transactions will be executed together or fail together."}
            {" On Sepolia, this uses native EIP-7702 support for true bundled execution."}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
