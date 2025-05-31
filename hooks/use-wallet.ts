"use client"

import { useState, useEffect, useCallback } from "react"

interface WalletState {
  isConnected: boolean
  address: string | null
  isLoading: boolean
  error: string | null
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (accounts: string[]) => void) => void
      removeListener: (event: string, callback: (accounts: string[]) => void) => void
    }
  }
}

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    isLoading: false,
    error: null,
  })

  const checkConnection = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      return
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      })

      if (accounts.length > 0) {
        setWalletState({
          isConnected: true,
          address: accounts[0],
          isLoading: false,
          error: null,
        })
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error)
    }
  }, [])

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setWalletState((prev) => ({
        ...prev,
        error: "MetaMask or compatible wallet not detected. Please install MetaMask.",
      }))
      return
    }

    setWalletState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (accounts.length > 0) {
        setWalletState({
          isConnected: true,
          address: accounts[0],
          isLoading: false,
          error: null,
        })
      }
    } catch (error: any) {
      setWalletState({
        isConnected: false,
        address: null,
        isLoading: false,
        error: error.message || "Failed to connect wallet",
      })
    }
  }

  const disconnectWallet = () => {
    setWalletState({
      isConnected: false,
      address: null,
      isLoading: false,
      error: null,
    })
  }

  useEffect(() => {
    checkConnection()

    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet()
        } else {
          setWalletState((prev) => ({
            ...prev,
            address: accounts[0],
            isConnected: true,
          }))
        }
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        }
      }
    }
  }, [checkConnection])

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    isMetaMaskInstalled: typeof window !== "undefined" && window.ethereum?.isMetaMask,
  }
}
