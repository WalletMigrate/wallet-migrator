"use client"

import { Wallet, ExternalLink, Copy, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useWallet } from "@/hooks/use-wallet"

interface WalletConnectionProps {
  onAddressChange: (address: string) => void
}

export function WalletConnection({ onAddressChange }: WalletConnectionProps) {
  const { isConnected, address, isLoading, error, connectWallet, disconnectWallet, isMetaMaskInstalled } = useWallet()
  const [copied, setCopied] = useState(false)

  const handleConnect = async () => {
    await connectWallet()
    if (address) {
      onAddressChange(address)
    }
  }

  const handleDisconnect = () => {
    disconnectWallet()
    onAddressChange("")
  }

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(38)}`
  }

  useEffect(() => {
    if (isConnected && address) {
      onAddressChange(address)
    }
  }, [isConnected, address, onAddressChange])

  if (!isMetaMaskInstalled && typeof window !== "undefined") {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">MetaMask Not Detected</p>
              <p className="text-sm text-orange-600">Install MetaMask to connect your wallet automatically.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://metamask.io/download/", "_blank")}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              Install MetaMask
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isConnected && address) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-800">Wallet Connected</span>
                  <Badge variant="secondary" className="text-xs">
                    MetaMask
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-green-600 font-mono">{formatAddress(address)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAddress}
                    className="h-6 w-6 p-0 text-green-600 hover:text-green-800 hover:bg-green-100"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="border-green-300 text-green-700 hover:bg-green-100"
            >
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-neutral-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-neutral-600" />
            <div>
              <p className="text-sm font-medium">Connect Your Wallet</p>
              <p className="text-sm text-neutral-500">Connect to automatically load your wallet address</p>
            </div>
          </div>
          <Button onClick={handleConnect} disabled={isLoading}>
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
