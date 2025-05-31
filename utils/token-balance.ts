"\"use client"

// Function to get token balance using RPC
export const getTokenBalance = async (address: string, tokenAddress: string, network: any): Promise<string> => {
  try {
    if (typeof window === "undefined" || !window.ethereum) {
      return "0"
    }

    // ERC20 balanceOf function selector + address (padded to 32 bytes)
    const data = "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0")

    console.log(`🔍 Calling balanceOf for ${tokenAddress} with data: ${data}`)

    const result = await window.ethereum.request({
      method: "eth_call",
      params: [
        {
          to: tokenAddress,
          data: data,
        },
        "latest",
      ],
    })

    console.log(`📊 Raw balance result for ${tokenAddress}: ${result}`)

    if (result && result !== "0x" && result !== "0x0") {
      const balance = BigInt(result)
      console.log(`💰 Parsed balance for ${tokenAddress}: ${balance.toString()}`)
      return balance.toString()
    }

    return "0"
  } catch (error) {
    console.error(`❌ Error getting token balance for ${tokenAddress}:`, error)
    return "0"
  }
}
