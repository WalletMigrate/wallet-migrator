"use client"

import { createWalletClient, http} from 'viem'
import { mainnet } from 'viem/chains'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export default function SignAuthorization() {
    const [auth, setAuth] = useState<string>('')
    const [error, setError] = useState<string>('')
    const walletClient = createWalletClient({
        chain: mainnet,
        transport: http(),
    })

    useEffect(() => {
        if (typeof window === 'undefined' || !window.ethereum) {
            setError('MetaMask no está instalado')
        }
    }, [])

    const signAuth = async () => {
        const [account] = await walletClient.getAddresses()
        const result = await walletClient.signAuthorization({
            account,
            contractAddress: '0xf5aF47b26047E3aAc74F39075F4fa9224FC9Ff68',
            executor: 'self',
        })
        setAuth(JSON.stringify(result))
    }

    if (error) return <div className="text-red-500">{error}</div>
    return <div>
        <div>{auth}</div>
        <Button onClick={() => signAuth()}>Firmar</Button>
    </div>
}