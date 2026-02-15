import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Users, DollarSign, FileWarning, Upload } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: recentAnalyses, isLoading } = trpc.fraud.getRecentAnalyses.useQuery({ limit: 5 });
  const latestAnalysis = recentAnalyses?.[0];

  const { data: stats } = trpc.fraud.getDashboardStats.useQuery(
    { analysisId: latestAnalysis?.id || 0 },
    { enabled: !!latestAnalysis?.id && latestAnalysis.status === 'completed' }
  );

  const { data: highRiskProviders } = trpc.fraud.getHighRiskProviders.useQuery(
    { minRiskScore: 75, limit: 10 },
    { enabled: !!latestAnalysis?.id && latestAnalysis.status === 'completed' }
  );

  const { data: alerts } = trpc.fraud.getAlerts.useQuery(
    { analysisId: latestAnalysis?.id || 0 },
    { enabled: !!latestAnalysis?.id && latestAnalysis.status === 'completed' }
  );

  const criticalAlerts = alerts?.filter(a => a.severity === 'critical') || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Medicaid Fraud Detection
              </h1>
              <p className="text-muted-foreground mt-2">
                Advanced analytics platform for identifying unusual billing patterns and potential fraud
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setLocation("/upload")}
            >
              <Upload className="h-5 w-5" />
              Upload Data
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Key Metrics */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Records
                </CardTitle>
                <FileWarning className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalRecords.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.dateRangeStart} to {stats.dateRangeEnd}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-chart-3">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Anomalous Records
                </CardTitle>
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-chart-3">
                  {stats.anomalousRecords.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((stats.anomalousRecords / stats.totalRecords) * 100).toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-chart-5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  High-Risk Providers
                </CardTitle>
                <Users className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-chart-5">
                  {stats.highRiskProviders}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Risk score &gt; 50
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-chart-4">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Spending
                </CardTitle>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ${(parseFloat(stats.totalSpending) / 1000000).toFixed(1)}M
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all providers
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Critical Alerts</CardTitle>
              </div>
              <CardDescription>
                {criticalAlerts.length} critical fraud pattern{criticalAlerts.length !== 1 ? 's' : ''} detected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {criticalAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between p-4 rounded-lg bg-background border"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Critical</Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span>NPI: {alert.providerNpi}</span>
                        <span>Risk Score: {alert.riskScore}</span>
                        <span>Spending: ${parseFloat(alert.totalSpending).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/provider/${alert.providerNpi}`)}
                    >
                      Investigate
                    </Button>
                  </div>
                ))}
              </div>
              {criticalAlerts.length > 3 && (
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => setLocation("/alerts")}
                >
                  View all {criticalAlerts.length} alerts
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* High-Risk Providers */}
        {highRiskProviders && highRiskProviders.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>High-Risk Providers</CardTitle>
                  <CardDescription>
                    Providers with elevated fraud risk scores requiring investigation
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setLocation("/providers")}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {highRiskProviders.slice(0, 5).map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/provider/${provider.npi}`)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium">NPI: {provider.npi}</span>
                        <Badge
                          variant={provider.avgRiskScore > 75 ? "destructive" : "default"}
                          className="gap-1"
                        >
                          <TrendingUp className="h-3 w-3" />
                          Risk: {provider.avgRiskScore}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{provider.totalClaims.toLocaleString()} claims</span>
                        <span>${parseFloat(provider.totalSpending).toLocaleString()} total</span>
                        <span>{provider.uniqueProcedures} procedures</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View Details →
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Analyses */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>Your most recent fraud detection runs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : recentAnalyses && recentAnalyses.length > 0 ? (
              <div className="space-y-3">
                {recentAnalyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{analysis.fileName}</div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                        <span>{analysis.totalRecords.toLocaleString()} records</span>
                        <Badge variant={
                          analysis.status === 'completed' ? 'default' :
                          analysis.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {analysis.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileWarning className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No analyses yet</p>
                <Button onClick={() => setLocation("/upload")}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First Dataset
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
