"use client"
import { AlertTriangle, Shield } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface ScamWarningProps {
  scamCount: number
  totalCount: number
  scamPercentage: number
}

export function ScamWarning({ scamCount, totalCount, scamPercentage }: ScamWarningProps) {
  if (scamCount === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <Shield className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Good news!</strong> No potential scam tokens detected in your wallet.
        </AlertDescription>
      </Alert>
    )
  }

  const severity = scamPercentage > 50 ? "high" : scamPercentage > 20 ? "medium" : "low"

  return (
    <Alert
      variant={severity === "high" ? "destructive" : "default"}
      className={severity === "medium" ? "border-orange-200 bg-orange-50" : ""}
    >
      <AlertTriangle
        className={`h-4 w-4 ${
          severity === "high" ? "text-red-600" : severity === "medium" ? "text-orange-600" : "text-yellow-600"
        }`}
      />
      <AlertDescription
        className={severity === "high" ? "text-red-800" : severity === "medium" ? "text-orange-800" : "text-yellow-800"}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <strong>Warning:</strong>
          <Badge variant={severity === "high" ? "destructive" : "secondary"}>
            {scamCount} potential scam token{scamCount > 1 ? "s" : ""}
          </Badge>
          detected out of {totalCount} tokens ({scamPercentage.toFixed(1)}%).
        </div>
        <div className="mt-2 text-sm">
          These tokens may be scams, airdrops, or phishing attempts.
          <strong> Never interact with suspicious tokens</strong> or visit links they contain.
        </div>
      </AlertDescription>
    </Alert>
  )
}

export function ScamTokenBadge({ reasons }: { reasons: string }) {
  return (
    <div className="group relative">
      <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
        ⚠️ SCAM
      </Badge>
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64 p-2 bg-red-50 border border-red-200 rounded shadow-lg">
        <div className="text-xs text-red-800">
          <strong>Potential scam reasons:</strong>
          <div className="mt-1">{reasons}</div>
        </div>
      </div>
    </div>
  )
}
