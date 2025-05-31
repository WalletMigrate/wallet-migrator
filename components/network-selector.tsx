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
}

const NETWORKS: Network[] = [
  {
    id: "gnosis",
    name: "Gnosis Chain",
    endpoint: "https://gnosis.blockscout.com/api",
    chainId: 100,
  },
  {
    id: "ethereum",
    name: "Ethereum Mainnet",
    endpoint: "https://eth.blockscout.com/api",
    chainId: 1,
  },
  {
    id: "polygon",
    name: "Polygon",
    endpoint: "https://polygon.blockscout.com/api",
    chainId: 137,
  },
  {
    id: "optimism",
    name: "Optimism",
    endpoint: "https://optimism.blockscout.com/api",
    chainId: 10,
  },
]

interface NetworkSelectorProps {
  selectedNetwork: Network
  onNetworkChange: (network: Network) => void
}

export function NetworkSelector({ selectedNetwork, onNetworkChange }: NetworkSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Globe className="mr-2 h-4 w-4" />
          {selectedNetwork.name}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {NETWORKS.map((network) => (
          <DropdownMenuItem
            key={network.id}
            onClick={() => onNetworkChange(network)}
            className="flex items-center justify-between"
          >
            <span>{network.name}</span>
            <Badge variant="secondary" className="text-xs">
              {network.chainId}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { NETWORKS }
export type { Network }
