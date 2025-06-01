"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Fuel, Clock, ArrowRight, Zap } from "lucide-react"
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
  isEIP7702Supported?: boolean
}

export function TransactionPreview({
  tokens,
  fromAddress,
  toAddress,
  estimatedGas,
  estimatedCost,
  isEIP7702Supported = false,
}: TransactionPreviewProps) {
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(38)}`
  }

  const getTotalValue = () => {
    const nativeTokens = tokens.filter((t) => t.type === "NATIVE")
    const totalNative = nativeTokens.reduce((sum, token) => sum + Number.parseFloat(token.balance), 0)
    return totalNative > 0 ? `${totalNative.toFixed(6)} ETH` : "0 ETH"
  }

  const calculateGasSavings = () => {
    if (!isEIP7702Supported) return null

    // Estimación de gas individual vs bundle
    const individualGas = tokens.length * 65000 // Promedio por transacción
    const bundleGas = Number.parseInt(estimatedGas || "0")
    const savings = individualGas - bundleGas
    const savingsPercentage = ((savings / individualGas) * 100).toFixed(1)

    return {
      individual: individualGas,
      bundle: bundleGas,
      savings,
      percentage: savingsPercentage,
    }
  }

  const gasSavings = calculateGasSavings()

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <ArrowRight className="h-5 w-5" />
          {isEIP7702Supported ? "EIP-7702 Atomic Bundle" : "Sequential Transactions"}
          {isEIP7702Supported && <Zap className="h-4 w-4 text-yellow-600" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* EIP-7702 Benefits */}
        {isEIP7702Supported && (
          <Alert className="border-green-200 bg-green-50">
            <Zap className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>EIP-7702 Benefits:</strong> Single signature, atomic execution, and reduced gas costs!
            </AlertDescription>
          </Alert>
        )}

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

        {/* Execution Method */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-blue-800">Execution Method</h4>
          <div className="flex items-center gap-2">
            <Badge variant={isEIP7702Supported ? "default" : "secondary"}>
              {isEIP7702Supported ? "EIP-7702 Atomic Bundle" : "Sequential Transactions"}
            </Badge>
            <span className="text-xs text-blue-600">
              {isEIP7702Supported
                ? `Single transaction with ${tokens.length} operations, all-or-nothing execution`
                : `${tokens.length} separate transactions`}
            </span>
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

          {/* Gas Savings Display */}
          {gasSavings && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-700">Gas Savings:</span>
              <div className="text-right">
                <span className="text-sm text-green-600">
                  -{gasSavings.savings.toLocaleString()} gas ({gasSavings.percentage}%)
                </span>
                <div className="text-xs text-green-500">vs {gasSavings.individual.toLocaleString()} individual</div>
              </div>
            </div>
          )}

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

        {/* Execution Warning/Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {isEIP7702Supported ? (
              <>
                <strong>EIP-7702 Atomic Bundle:</strong> This will execute all {tokens.length} transactions atomically
                with a single signature. All transactions will succeed together or fail together. Your EOA will
                temporarily act as a smart contract to enable this functionality.
              </>
            ) : (
              <>
                <strong>Sequential Execution:</strong> This will send {tokens.length} transactions one by one. You'll
                need to approve each transaction in your wallet. Some transactions may succeed while others fail.
              </>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
