"use client"

import { createWalletClient, http, createPublicClient, encodeFunctionData } from 'viem'
import { mainnet } from 'viem/chains'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

// Direcciones de contratos en Ethereum mainnet
const MIGRATOR_ADDRESS = "0xf5aF47b26047E3aAc74F39075F4fa9224FC9Ff68" as `0x${string}`

interface Token {
    address: string
    symbol: string
    balance: string
    decimals: number
    isDust?: boolean
    minOut?: string // Para tokens dust
}

interface NFT {
    address: string
    tokenId: string
    name?: string
}

// ABI para el contrato Migrator2
const MIGRATOR_ABI = [
    {
        "inputs": [
            { "name": "recipient", "type": "address" },
            { "name": "erc20s", "type": "address[]" },
            { 
                "name": "nfts", 
                "type": "tuple[]",
                "components": [
                    { "name": "nft", "type": "address" },
                    { "name": "tokenId", "type": "uint256" }
                ]
            },
            {
                "name": "dustTokens",
                "type": "tuple[]",
                "components": [
                    { "name": "token", "type": "address" },
                    { "name": "minOut", "type": "uint256" }
                ]
            }
        ],
        "name": "executeMigration",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

// ABI para tokens ERC20
const ERC20_ABI = [
    {
        "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "owner", "type": "address" },
            { "name": "spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
]

export default function Migration() {
    const [tokens, setTokens] = useState<Token[]>([])
    const [nfts, setNfts] = useState<NFT[]>([])
    const [error, setError] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [newWallet, setNewWallet] = useState<string>('')

    const walletClient = createWalletClient({
        chain: mainnet,
        transport: http(),
    })

    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(),
    })

    useEffect(() => {
        loadAssets()
    }, [])

    const loadAssets = async () => {
        try {
            await walletClient.getAddresses()
            // TODO: Implementar carga real de tokens y NFTs
            const mockTokens: Token[] = [
                {
                    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    symbol: "WETH",
                    balance: "1000000000000000000", // 1 WETH
                    decimals: 18
                },
                {
                    address: "0x...", // Token dust
                    symbol: "DUST",
                    balance: "1000000",
                    decimals: 18,
                    isDust: true,
                    minOut: "1000000" // 1 USDC
                }
            ]
            setTokens(mockTokens)

            const mockNFTs: NFT[] = [
                {
                    address: "0x...",
                    tokenId: "123",
                    name: "NFT #123"
                }
            ]
            setNfts(mockNFTs)
        } catch {
            setError('Error al cargar assets')
        }
    }

    const migrateAssets = async () => {
        if (!newWallet || !/^0x[a-fA-F0-9]{40}$/.test(newWallet)) {
            setError('Por favor ingresa una dirección de wallet válida')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const [account] = await walletClient.getAddresses()
            const accountAddress = account as `0x${string}`
            
            // Separar tokens normales y dust
            const normalTokens = tokens.filter(t => !t.isDust)
            const dustTokens = tokens.filter(t => t.isDust)
            const erc20s = normalTokens.map(t => t.address)
            const nftTransfers = nfts.map(n => ({
                nft: n.address,
                tokenId: n.tokenId
            }))
            const dustSwaps = dustTokens.map(t => ({
                token: t.address,
                minOut: t.minOut || "0"
            }))

            // Crear bundle de transacciones
            const transactions = []

            // 1. Agregar aprobaciones de tokens
            for (const token of tokens) {
                const tokenAddress = token.address as `0x${string}`
                const currentAllowance = await publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [accountAddress, MIGRATOR_ADDRESS]
                })

                if (BigInt(currentAllowance as bigint) < BigInt(token.balance)) {
                    transactions.push({
                        to: tokenAddress,
                        data: encodeFunctionData({
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [MIGRATOR_ADDRESS, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")]
                        })
                    })
                }
            }

            // 2. Agregar transacción de migración
            transactions.push({
                to: MIGRATOR_ADDRESS,
                data: encodeFunctionData({
                    abi: MIGRATOR_ABI,
                    functionName: 'executeMigration',
                    args: [newWallet, erc20s, nftTransfers, dustSwaps]
                })
            })

            // Ejecutar transacciones en secuencia
            for (const tx of transactions) {
                await walletClient.sendTransaction({
                    account: accountAddress,
                    to: tx.to,
                    data: tx.data
                })
            }

            console.log('Migración completada')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error en la migración')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Migración de Assets</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Nueva Wallet
                    </label>
                    <input
                        type="text"
                        value={newWallet}
                        onChange={(e) => setNewWallet(e.target.value)}
                        placeholder="0x..."
                        className="w-full p-2 border rounded"
                    />
                </div>

                {tokens.length > 0 && (
                    <div className="mt-4">
                        <h3 className="font-medium mb-2">Tokens a migrar:</h3>
                        <ul className="space-y-2">
                            {tokens.map((token, index) => (
                                <li key={index} className="flex justify-between">
                                    <span>{token.symbol}</span>
                                    <span>{token.balance}</span>
                                    {token.isDust && (
                                        <span className="text-sm text-gray-500">
                                            (Dust - Min out: {token.minOut} USDC)
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {nfts.length > 0 && (
                    <div className="mt-4">
                        <h3 className="font-medium mb-2">NFTs a migrar:</h3>
                        <ul className="space-y-2">
                            {nfts.map((nft, index) => (
                                <li key={index} className="flex justify-between">
                                    <span>{nft.name || `NFT #${nft.tokenId}`}</span>
                                    <span className="text-sm text-gray-500">
                                        {nft.address.slice(0, 6)}...{nft.address.slice(-4)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Button 
                    onClick={migrateAssets}
                    disabled={isLoading || !newWallet || (tokens.length === 0 && nfts.length === 0)}
                >
                    {isLoading ? 'Procesando...' : 'Migrar Assets'}
                </Button>
            </div>
        </Card>
    )
} 