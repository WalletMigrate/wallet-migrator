"use client"
import { ChevronDown, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface Network {
  id: string
  name: string
  endpoint: string
  chainId: number
  rpcUrl?: string
  blockExplorer?: string
  eip7702Supported?: boolean
}

// Actualizar la lista de redes para incluir Ethereum Sepolia
const NETWORKS: Network[] = [
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

interface NetworkSelectorProps {
  selectedNetwork: Network
  onNetworkChange: (network: Network) => void
  tokenCounts?: Record<string, number>
  isLoadingTokens?: boolean
}

export function NetworkSelector({
  selectedNetwork,
  onNetworkChange,
  tokenCounts = {},
  isLoadingTokens = false,
}: NetworkSelectorProps) {
  const getTokenCount = (networkId: string) => {
    return tokenCounts[networkId] || 0
  }

  const getCurrentNetworkTokenCount = () => {
    return getTokenCount(selectedNetwork.id)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Globe className="mr-2 h-4 w-4" />
          {selectedNetwork.name}
          {isLoadingTokens ? (
            <Badge variant="secondary" className="ml-2 text-xs">
              ...
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-2 text-xs">
              {getCurrentNetworkTokenCount()} tokens
            </Badge>
          )}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {NETWORKS.map((network) => {
          const tokenCount = getTokenCount(network.id)
          const isSelected = network.id === selectedNetwork.id

          return (
            <DropdownMenuItem
              key={network.id}
              onClick={() => onNetworkChange(network)}
              className={`flex items-center justify-between ${isSelected ? "bg-blue-50" : ""}`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isSelected ? "text-blue-700" : ""}`}>{network.name}</span>
                  {network.eip7702Supported && (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-300 text-xs">
                      EIP-7702
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-neutral-500">Chain ID: {network.chainId}</span>
              </div>
              {isLoadingTokens ? (
                <Badge variant="outline" className="text-xs">
                  ...
                </Badge>
              ) : (
                <Badge variant={tokenCount > 0 ? "default" : "secondary"} className="text-xs">
                  {tokenCount} {tokenCount === 1 ? "token" : "tokens"}
                </Badge>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { NETWORKS }
export type { Network }
