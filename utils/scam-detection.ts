"use client"

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
  isScam?: boolean
  scamReason?: string
}

// Lista de direcciones conocidas de scam tokens
const KNOWN_SCAM_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000", // Ejemplo
  "0x1111111111111111111111111111111111111111", // Ejemplo
  // Agregar más direcciones conocidas de scam
])

// Patrones sospechosos en nombres de tokens
const SUSPICIOUS_NAME_PATTERNS = [
  /claim/i,
  /reward/i,
  /bonus/i,
  /airdrop/i,
  /free/i,
  /gift/i,
  /winner/i,
  /congratulations/i,
  /visit.*to.*claim/i,
  /go.*to.*claim/i,
  /\.com/i,
  /\.org/i,
  /\.net/i,
  /\.io/i,
  /http/i,
  /www\./i,
  /telegram/i,
  /discord/i,
  /twitter/i,
  /facebook/i,
  /instagram/i,
  /youtube/i,
  /tiktok/i,
  /whatsapp/i,
  /\.t\.me/i,
  /t\.me/i,
  /bit\.ly/i,
  /tinyurl/i,
  /shorturl/i,
  /rebrand/i,
  /migration/i,
  /swap.*now/i,
  /urgent/i,
  /limited.*time/i,
  /expires/i,
  /deadline/i,
  /act.*fast/i,
  /hurry/i,
  /last.*chance/i,
  /final.*warning/i,
  /security.*alert/i,
  /verify.*wallet/i,
  /validate.*wallet/i,
  /connect.*wallet/i,
  /sync.*wallet/i,
  /update.*wallet/i,
  /metamask.*support/i,
  /wallet.*connect/i,
  /dapp.*browser/i,
  /uniswap.*v[0-9]/i,
  /pancakeswap/i,
  /sushiswap/i,
  /1inch/i,
  /paraswap/i,
  /0x.*protocol/i,
  /defi.*pulse/i,
  /yield.*farming/i,
  /liquidity.*mining/i,
  /staking.*rewards/i,
  /governance.*token/i,
  /dao.*token/i,
  /nft.*drop/i,
  /mint.*nft/i,
  /opensea/i,
  /rarible/i,
  /foundation/i,
  /superrare/i,
  /async.*art/i,
  /known.*origin/i,
  /makersplace/i,
  /binance.*smart.*chain/i,
  /bsc.*token/i,
  /polygon.*matic/i,
  /avalanche.*avax/i,
  /fantom.*ftm/i,
  /harmony.*one/i,
  /solana.*sol/i,
  /cardano.*ada/i,
  /polkadot.*dot/i,
  /kusama.*ksm/i,
  /chainlink.*link/i,
  /ethereum.*classic/i,
  /litecoin.*ltc/i,
  /bitcoin.*cash/i,
  /bitcoin.*sv/i,
  /dogecoin.*doge/i,
  /shiba.*inu/i,
  /safemoon/i,
  /elongate/i,
  /cumrocket/i,
  /moonshot/i,
  /to.*the.*moon/i,
  /diamond.*hands/i,
  /hodl/i,
  /ape.*together/i,
  /stonks/i,
  /tendies/i,
  /wagmi/i,
  /ngmi/i,
  /fud/i,
  /fomo/i,
  /rekt/i,
  /pump.*dump/i,
  /rug.*pull/i,
  /exit.*scam/i,
  /ponzi/i,
  /pyramid/i,
  /mlm/i,
  /multi.*level/i,
  /get.*rich.*quick/i,
  /easy.*money/i,
  /passive.*income/i,
  /financial.*freedom/i,
  /retire.*early/i,
  /work.*from.*home/i,
  /make.*money.*online/i,
  /crypto.*millionaire/i,
  /bitcoin.*billionaire/i,
  /forex.*trading/i,
  /binary.*options/i,
  /investment.*opportunity/i,
  /guaranteed.*returns/i,
  /risk.*free/i,
  /no.*risk/i,
  /100%.*profit/i,
  /1000%.*gains/i,
  /10x.*returns/i,
  /100x.*potential/i,
  /moon.*mission/i,
  /next.*bitcoin/i,
  /ethereum.*killer/i,
  /doge.*killer/i,
  /shib.*killer/i,
  /bnb.*killer/i,
  /ada.*killer/i,
  /sol.*killer/i,
  /avax.*killer/i,
  /matic.*killer/i,
  /ftm.*killer/i,
  /one.*killer/i,
  /dot.*killer/i,
  /ksm.*killer/i,
  /link.*killer/i,
  /uni.*killer/i,
  /cake.*killer/i,
  /sushi.*killer/i,
  /1inch.*killer/i,
  /aave.*killer/i,
  /comp.*killer/i,
  /mkr.*killer/i,
  /snx.*killer/i,
  /crv.*killer/i,
  /bal.*killer/i,
  /yfi.*killer/i,
  /alpha.*killer/i,
  /beta.*killer/i,
  /gamma.*killer/i,
  /delta.*killer/i,
  /epsilon.*killer/i,
  /zeta.*killer/i,
  /eta.*killer/i,
  /theta.*killer/i,
  /iota.*killer/i,
  /kappa.*killer/i,
  /lambda.*killer/i,
  /mu.*killer/i,
  /nu.*killer/i,
  /xi.*killer/i,
  /omicron.*killer/i,
  /pi.*killer/i,
  /rho.*killer/i,
  /sigma.*killer/i,
  /tau.*killer/i,
  /upsilon.*killer/i,
  /phi.*killer/i,
  /chi.*killer/i,
  /psi.*killer/i,
  /omega.*killer/i,
]

// Patrones sospechosos en símbolos de tokens
const SUSPICIOUS_SYMBOL_PATTERNS = [
  /^[A-Z]{1,2}$/, // Símbolos muy cortos (1-2 caracteres)
  /^[A-Z]{10,}$/, // Símbolos muy largos (10+ caracteres)
  /[0-9]{3,}/, // Muchos números consecutivos
  /[^A-Z0-9]/, // Caracteres especiales
  /(.)\1{3,}/, // Caracteres repetidos (AAAA, 1111, etc.)
]

// Actualizar la lista de símbolos legítimos para incluir USDC y otros tokens comunes de Polygon
const LEGITIMATE_SYMBOLS = new Set([
  "ETH",
  "BTC",
  "USDT",
  "USDC", // ← Agregar USDC
  "DAI", // ← Agregar DAI
  "WETH", // ← Agregar WETH
  "WBTC", // ← Agregar WBTC
  "BNB",
  "ADA",
  "SOL",
  "XRP",
  "DOT",
  "DOGE",
  "AVAX",
  "SHIB",
  "MATIC",
  "CRO",
  "LTC",
  "NEAR",
  "ATOM",
  "UNI",
  "LINK",
  "BCH",
  "XLM",
  "ALGO",
  "VET",
  "ICP",
  "FIL",
  "TRX",
  "ETC",
  "MANA",
  "SAND",
  "AXS",
  "THETA",
  "HBAR",
  "EGLD",
  "XTZ",
  "FLOW",
  "AAVE",
  "CAKE",
  "GRT",
  "MKR",
  "COMP",
  "SUSHI",
  "YFI",
  "SNX",
  "CRV",
  "BAL",
  "1INCH",
  "ALPHA",
  "RUNE",
  "KSM",
  "ZEC",
  "DASH",
  "DCR",
  "BAT",
  "ENJ",
  "CHZ",
  "HOT",
  "ZIL",
  "QTUM",
  "OMG",
  "LRC",
  "STORJ",
  "REN",
  "KNC",
  "BNT",
  "MLN",
  "NMR",
  "REP",
  "ZRX",
  "OXT",
  "BAND",
  "OCEAN",
  "FET",
  "CTSI",
  "NKN",
  "ANKR",
  "CELR",
  "COTI",
  "DENT",
  "FUN",
  "GNT",
  "IOST",
  "IOTA",
  "KEY",
  "LOOM",
  "MITH",
  "NPXS",
  "ONT",
  "POLY",
  "QKC",
  "RDN",
  "STMX",
  "TFUEL",
  "TNT",
  "WAXP",
  "WTC",
  "XEM",
  "XVS",
  "YFII",
  "ZEN",
  "BZRX",
])

// Mejorar la detección para ser menos agresiva con tokens legítimos
export class ScamDetector {
  /**
   * Analiza un token para determinar si es potencialmente un scam
   */
  static analyzeToken(token: Token): { isScam: boolean; reasons: string[] } {
    const reasons: string[] = []

    // Skip native tokens
    if (token.isNative) {
      return { isScam: false, reasons: [] }
    }

    // Skip known legitimate tokens
    if (LEGITIMATE_SYMBOLS.has(token.symbol.toUpperCase())) {
      return { isScam: false, reasons: [] }
    }

    // Check known scam addresses
    if (KNOWN_SCAM_ADDRESSES.has(token.contractAddress.toLowerCase())) {
      reasons.push("Known scam contract address")
    }

    // Check suspicious name patterns (but be less aggressive)
    let suspiciousNameCount = 0
    for (const pattern of SUSPICIOUS_NAME_PATTERNS) {
      if (pattern.test(token.name)) {
        suspiciousNameCount++
        if (suspiciousNameCount === 1) {
          // Only report first match
          reasons.push(`Suspicious name pattern detected`)
          break
        }
      }
    }

    // Check suspicious symbol patterns (but skip if it's a known legitimate symbol)
    if (!LEGITIMATE_SYMBOLS.has(token.symbol.toUpperCase())) {
      for (const pattern of SUSPICIOUS_SYMBOL_PATTERNS) {
        if (pattern.test(token.symbol)) {
          reasons.push(`Suspicious symbol pattern: "${token.symbol}"`)
          break
        }
      }
    }

    // Check for zero balance (but be less aggressive - only flag if other red flags exist)
    if (token.type === "ERC20" && Number.parseFloat(token.balance) === 0 && reasons.length > 0) {
      reasons.push("Zero balance combined with other suspicious indicators")
    }

    // Check for very high balance (unrealistic amounts) - but only for unknown tokens
    if (
      token.type === "ERC20" &&
      Number.parseFloat(token.balance) > 1000000000 &&
      !LEGITIMATE_SYMBOLS.has(token.symbol.toUpperCase())
    ) {
      reasons.push("Unrealistically high balance")
    }

    // Check for suspicious decimals
    if (token.type === "ERC20" && token.decimals !== undefined) {
      if (token.decimals > 30 || token.decimals < 0) {
        reasons.push("Unusual decimal places")
      }
    }

    return {
      isScam: reasons.length > 0,
      reasons,
    }
  }

  /**
   * Analiza una lista de tokens y marca los scams
   */
  static analyzeTokenList(tokens: Token[]): Token[] {
    const symbolCounts = new Map<string, number>()

    // Count symbol occurrences
    tokens.forEach((token) => {
      if (!token.isNative) {
        const symbol = token.symbol.toUpperCase()
        symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1)
      }
    })

    return tokens.map((token) => {
      const analysis = this.analyzeToken(token)

      // Check for duplicate symbols
      if (!token.isNative && !LEGITIMATE_SYMBOLS.has(token.symbol.toUpperCase())) {
        const symbolCount = symbolCounts.get(token.symbol.toUpperCase()) || 0
        if (symbolCount > 1) {
          analysis.reasons.push("Duplicate symbol (possible fake token)")
          analysis.isScam = true
        }
      }

      return {
        ...token,
        isScam: analysis.isScam,
        scamReason: analysis.reasons.join("; "),
      }
    })
  }

  /**
   * Obtiene estadísticas de scam tokens
   */
  static getScamStats(tokens: Token[]): {
    total: number
    scam: number
    legitimate: number
    scamPercentage: number
  } {
    const total = tokens.filter((t) => !t.isNative).length
    const scam = tokens.filter((t) => t.isScam).length
    const legitimate = total - scam
    const scamPercentage = total > 0 ? (scam / total) * 100 : 0

    return {
      total,
      scam,
      legitimate,
      scamPercentage,
    }
  }
}

export type { Token }
