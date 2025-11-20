import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  RefreshCw,
  ShoppingCart,
  CreditCard,
  Package,
  GitCompare,
  Calendar,
  Loader2
} from "lucide-react"

interface Stats {
  shopify: number
  razorpay: number
  easyecom: number
  reconciliations: number
}

interface ReconciliationResult {
  id: string
  shopifyOrderId?: string
  razorpayPaymentId?: string
  easyecomOrderId?: string
  status: string
  matchConfidence: number
  createdAt: string
}

interface ReconciliationRun {
  id: string
  status: string
  summary: {
    matched: number
    partialMatch: number
    unmatched: number
    discrepancies: number
  }
  createdAt: string
}

const API_BASE_URL = "http://localhost:3000/api"

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({ shopify: 0, razorpay: 0, easyecom: 0, reconciliations: 0 })
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [reconciliationResults, setReconciliationResults] = useState<ReconciliationResult[]>([])
  const [recentRuns, setRecentRuns] = useState<ReconciliationRun[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [lookbackDays, setLookbackDays] = useState(7)

  // Fetch stats on mount and periodically
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Initialize dates
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - lookbackDays)

    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [lookbackDays])

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health/status`)
      if (response.ok) {
        const data = await response.json()
        setStats({
          shopify: data.database?.shopifyOrders || 0,
          razorpay: data.database?.razorpayPayments || 0,
          easyecom: data.database?.easyecomOrders || 0,
          reconciliations: data.database?.reconciliations || 0,
        })
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    }
  }

  const syncPlatform = async (platform: string) => {
    setLoading({ ...loading, [platform]: true })
    try {
      const response = await fetch(`${API_BASE_URL}/sync/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ Synced ${data.count} ${platform} records`)
        await fetchStats()
      } else {
        const error = await response.json()
        alert(`❌ Sync failed: ${error.message}`)
      }
    } catch (error) {
      alert(`❌ Network error: ${error}`)
    } finally {
      setLoading({ ...loading, [platform]: false })
    }
  }

  const runReconciliation = async () => {
    setLoading({ ...loading, reconciliation: true })
    try {
      const response = await fetch(`${API_BASE_URL}/reconciliation/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      })

      if (response.ok) {
        const data = await response.json()
        setReconciliationResults(data.results)
        await fetchStats()
        await fetchRecentRuns()
        alert(`✅ Reconciliation completed!\nMatched: ${data.summary.matched}\nUnmatched: ${data.summary.unmatched}`)
      } else {
        const error = await response.json()
        alert(`❌ Reconciliation failed: ${error.message}`)
      }
    } catch (error) {
      alert(`❌ Network error: ${error}`)
    } finally {
      setLoading({ ...loading, reconciliation: false })
    }
  }

  const fetchRecentRuns = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reconciliation/logs?limit=5`)
      if (response.ok) {
        const data = await response.json()
        setRecentRuns(data.logs || [])
      }
    } catch (error) {
      console.error("Failed to fetch recent runs:", error)
    }
  }

  useEffect(() => {
    fetchRecentRuns()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "MATCHED":
        return "success"
      case "PARTIAL_MATCH":
        return "warning"
      case "UNMATCHED":
      case "DISCREPANCY":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">CPReconcile Dashboard</h1>
              <p className="text-muted-foreground">Shopify, Razorpay & Easyecom Reconciliation System</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shopify Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.shopify.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Razorpay Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.razorpay.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Easyecom Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.easyecom.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reconciliations</CardTitle>
              <GitCompare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.reconciliations.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Control Panel</CardTitle>
            <CardDescription>Sync platforms and run reconciliation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range Selector */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-semibold mb-2 block text-foreground">Lookback Days</label>
                <select
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(Number(e.target.value))}
                  className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-semibold mb-2 block text-foreground">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-semibold mb-2 block text-foreground">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => syncPlatform("shopify")}
                disabled={loading.shopify}
              >
                {loading.shopify && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync Shopify
              </Button>

              <Button
                variant="secondary"
                onClick={() => syncPlatform("razorpay")}
                disabled={loading.razorpay}
              >
                {loading.razorpay && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync Razorpay
              </Button>

              <Button
                variant="secondary"
                onClick={() => syncPlatform("easyecom")}
                disabled={loading.easyecom}
              >
                {loading.easyecom && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync Easyecom
              </Button>

              <Button
                onClick={() => {
                  syncPlatform("shopify")
                  syncPlatform("razorpay")
                  syncPlatform("easyecom")
                }}
                disabled={loading.shopify || loading.razorpay || loading.easyecom}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All Platforms
              </Button>

              <Button
                onClick={runReconciliation}
                disabled={loading.reconciliation}
                className="ml-auto"
              >
                {loading.reconciliation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <GitCompare className="mr-2 h-4 w-4" />
                Run Reconciliation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation Results */}
        {reconciliationResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Latest Reconciliation Results</CardTitle>
              <CardDescription>{reconciliationResults.length} records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 text-sm font-semibold">Shopify Order</th>
                      <th className="text-left p-3 text-sm font-semibold">Razorpay Payment</th>
                      <th className="text-left p-3 text-sm font-semibold">Easyecom Order</th>
                      <th className="text-left p-3 text-sm font-semibold">Status</th>
                      <th className="text-left p-3 text-sm font-semibold">Confidence</th>
                      <th className="text-left p-3 text-sm font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationResults.slice(0, 10).map((result) => (
                      <tr key={result.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-sm font-medium">{result.shopifyOrderId || "-"}</td>
                        <td className="p-3 text-sm font-medium">{result.razorpayPaymentId || "-"}</td>
                        <td className="p-3 text-sm font-medium">{result.easyecomOrderId || "-"}</td>
                        <td className="p-3">
                          <Badge variant={getStatusColor(result.status) as any}>
                            {result.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm font-medium">{(result.matchConfidence * 100).toFixed(0)}%</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {new Date(result.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Reconciliation Runs</CardTitle>
            <CardDescription>Last 5 reconciliation jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent runs found. Run your first reconciliation above.</p>
              ) : (
                recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{new Date(run.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-2 text-sm">
                        <Badge variant="success">{run.summary.matched} Matched</Badge>
                        <Badge variant="warning">{run.summary.partialMatch} Partial</Badge>
                        <Badge variant="destructive">{run.summary.unmatched} Unmatched</Badge>
                        {run.summary.discrepancies > 0 && (
                          <Badge variant="destructive">{run.summary.discrepancies} Discrepancies</Badge>
                        )}
                      </div>
                    </div>
                    <Badge>{run.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
