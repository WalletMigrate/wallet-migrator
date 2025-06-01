"use client"

import Image from "next/image"
import { Zap } from "lucide-react"

export function AppHeader() {
  return (
    <header className="py-4 mb-6">
      <div className="container max-w-3xl mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/images/migrator-logo.png" alt="Migrator Wallet" width={60} height={60} className="h-12 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-navy-800">Migrator Wallet</h1>
            <p className="text-sm text-gray-600 flex items-center">
              <Zap className="h-3 w-3 text-yellow-500 mr-1" />
              EIP-7702 Atomic Bundle Transfer
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
