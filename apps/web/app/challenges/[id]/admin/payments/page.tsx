"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Settings,
  TestTube,
  User,
  XCircle,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Tab = "config" | "history";

export default function PaymentsAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>("config");
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    stripeSecretKey: "",
    stripePublishableKey: "",
    stripeTestSecretKey: "",
    stripeTestPublishableKey: "",
    stripeWebhookSecret: "",
    stripeTestWebhookSecret: "",
    testMode: true,
    priceInDollars: "",
  });

  const paymentConfig = useQuery(api.queries.paymentConfig.getPaymentConfig, {
    challengeId: challengeId as Id<"challenges">,
  });

  const paymentStats = useQuery(api.queries.paymentConfig.getPaymentStats, {
    challengeId: challengeId as Id<"challenges">,
  });

  const payments = useQuery(api.queries.paymentConfig.listPayments, {
    challengeId: challengeId as Id<"challenges">,
  });

  const savePaymentConfig = useMutation(api.mutations.paymentConfig.savePaymentConfig);
  const toggleTestMode = useMutation(api.mutations.paymentConfig.toggleTestMode);
  const testConnection = useAction(api.actions.payments.testStripeConnection);

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);
    try {
      const priceInCents = Math.round(parseFloat(formData.priceInDollars || "0") * 100);

      await savePaymentConfig({
        challengeId: challengeId as Id<"challenges">,
        stripeSecretKey: formData.stripeSecretKey || undefined,
        stripePublishableKey: formData.stripePublishableKey || undefined,
        stripeTestSecretKey: formData.stripeTestSecretKey || undefined,
        stripeTestPublishableKey: formData.stripeTestPublishableKey || undefined,
        stripeWebhookSecret: formData.stripeWebhookSecret || undefined,
        stripeTestWebhookSecret: formData.stripeTestWebhookSecret || undefined,
        testMode: formData.testMode,
        priceInCents,
      });

      // Clear sensitive fields after save
      setFormData((prev) => ({
        ...prev,
        stripeSecretKey: "",
        stripeTestSecretKey: "",
        stripeWebhookSecret: "",
        stripeTestWebhookSecret: "",
      }));

      setTestResult({ success: true, message: "Configuration saved successfully" });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to save",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection({
        challengeId: challengeId as Id<"challenges">,
        useTestKeys: paymentConfig?.testMode ?? true,
      });

      if (result.success) {
        setTestResult({
          success: true,
          message: `Connected to ${result.accountName} (${result.accountId})`,
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || "Connection failed",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleTestMode = async () => {
    try {
      await toggleTestMode({
        challengeId: challengeId as Id<"challenges">,
      });
    } catch (error) {
      console.error("Failed to toggle test mode:", error);
    }
  };

  const formatPrice = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  if (paymentConfig === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <DollarSign className="h-3 w-3" />
            Total Revenue
          </div>
          <div className="mt-1 text-lg font-semibold text-emerald-400">
            {paymentStats ? formatPrice(paymentStats.totalRevenueInCents, paymentStats.currency) : "$0.00"}
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <CheckCircle className="h-3 w-3" />
            Completed
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {paymentStats?.completedCount ?? 0}
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            Pending
          </div>
          <div className="mt-1 text-lg font-semibold text-amber-400">
            {paymentStats?.pendingCount ?? 0}
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <XCircle className="h-3 w-3" />
            Failed
          </div>
          <div className="mt-1 text-lg font-semibold text-red-400">
            {paymentStats?.failedCount ?? 0}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("config")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "config"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Settings className="h-3 w-3" />
          Configuration
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "history"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <CreditCard className="h-3 w-3" />
          Payment History
        </button>
      </div>

      {/* Config Tab */}
      {activeTab === "config" && (
        <div className="space-y-4">
          {/* Test Mode Toggle */}
          <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800">
                <TestTube className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-100">Test Mode</div>
                <div className="text-xs text-zinc-500">
                  {paymentConfig?.testMode
                    ? "Using test keys - no real charges"
                    : "Using live keys - real charges will occur"}
                </div>
              </div>
            </div>
            <Switch
              checked={paymentConfig?.testMode ?? true}
              onCheckedChange={handleToggleTestMode}
              disabled={!paymentConfig}
            />
          </div>

          {/* Price Configuration */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-100">Entry Fee</h3>
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-zinc-400">Price (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.priceInDollars}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, priceInDollars: e.target.value }))
                    }
                    placeholder="0.00"
                    className="border-zinc-700 bg-zinc-800 pl-9 text-zinc-200"
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  Set to 0 for free challenges
                </p>
              </div>
              {paymentConfig && (
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Current price</div>
                  <div className="text-lg font-semibold text-zinc-100">
                    {formatPrice(paymentConfig.priceInCents, paymentConfig.currency)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* API Keys */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-100">Stripe API Keys</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSecrets(!showSecrets)}
                className="h-7 px-2 text-xs text-zinc-400"
              >
                {showSecrets ? (
                  <EyeOff className="mr-1 h-3 w-3" />
                ) : (
                  <Eye className="mr-1 h-3 w-3" />
                )}
                {showSecrets ? "Hide" : "Show"} secrets
              </Button>
            </div>

            <div className="space-y-4">
              {/* Test Keys */}
              <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TestTube className="h-3 w-3 text-amber-400" />
                  <span className="text-xs font-medium text-zinc-300">Test Keys</span>
                  {paymentConfig?.hasTestSecretKey && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      Configured
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500">Publishable Key (pk_test_...)</Label>
                    <Input
                      type="text"
                      value={formData.stripeTestPublishableKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripeTestPublishableKey: e.target.value,
                        }))
                      }
                      placeholder="pk_test_..."
                      className="h-8 border-zinc-600 bg-zinc-700 text-xs text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500">Secret Key (sk_test_...)</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={formData.stripeTestSecretKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripeTestSecretKey: e.target.value,
                        }))
                      }
                      placeholder={paymentConfig?.hasTestSecretKey ? "••••••••" : "sk_test_..."}
                      className="h-8 border-zinc-600 bg-zinc-700 text-xs text-zinc-200"
                    />
                  </div>
                </div>
              </div>

              {/* Live Keys */}
              <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Zap className="h-3 w-3 text-emerald-400" />
                  <span className="text-xs font-medium text-zinc-300">Live Keys</span>
                  {paymentConfig?.hasLiveSecretKey && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      Configured
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500">Publishable Key (pk_live_...)</Label>
                    <Input
                      type="text"
                      value={formData.stripePublishableKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripePublishableKey: e.target.value,
                        }))
                      }
                      placeholder="pk_live_..."
                      className="h-8 border-zinc-600 bg-zinc-700 text-xs text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500">Secret Key (sk_live_...)</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={formData.stripeSecretKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripeSecretKey: e.target.value,
                        }))
                      }
                      placeholder={paymentConfig?.hasLiveSecretKey ? "••••••••" : "sk_live_..."}
                      className="h-8 border-zinc-600 bg-zinc-700 text-xs text-zinc-200"
                    />
                  </div>
                </div>
              </div>

              {/* Webhook Secrets */}
              <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Key className="h-3 w-3 text-blue-400" />
                  <span className="text-xs font-medium text-zinc-300">Webhook Secrets (Optional)</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500">Test Webhook Secret (whsec_...)</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={formData.stripeTestWebhookSecret}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripeTestWebhookSecret: e.target.value,
                        }))
                      }
                      placeholder={paymentConfig?.hasTestWebhookSecret ? "••••••••" : "whsec_..."}
                      className="h-8 border-zinc-600 bg-zinc-700 text-xs text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500">Live Webhook Secret (whsec_...)</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={formData.stripeWebhookSecret}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stripeWebhookSecret: e.target.value,
                        }))
                      }
                      placeholder={paymentConfig?.hasWebhookSecret ? "••••••••" : "whsec_..."}
                      className="h-8 border-zinc-600 bg-zinc-700 text-xs text-zinc-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Result Message */}
          {testResult && (
            <div
              className={cn(
                "rounded border p-3 text-sm",
                testResult.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              )}
            >
              {testResult.success ? (
                <CheckCircle className="mr-2 inline h-4 w-4" />
              ) : (
                <XCircle className="mr-2 inline h-4 w-4" />
              )}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !paymentConfig}
              className="border-zinc-700 text-zinc-300"
            >
              {isTesting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Test Connection
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {isSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="rounded border border-zinc-800 bg-zinc-900">
          {payments && payments.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {payments.map((payment: NonNullable<typeof payments>[number]) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800">
                      {payment.user?.avatarUrl ? (
                        <img
                          src={payment.user.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-200">
                        {payment.user?.name || payment.user?.username || "Unknown"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {payment.stripeCustomerEmail || payment.user?.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">
                        {formatPrice(payment.amountInCents, payment.currency)}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          payment.status === "completed" &&
                            "bg-emerald-500/20 text-emerald-400",
                          payment.status === "pending" &&
                            "bg-amber-500/20 text-amber-400",
                          payment.status === "failed" && "bg-red-500/20 text-red-400"
                        )}
                      >
                        {payment.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      {format(new Date(payment.createdAt), "MMM d, yyyy h:mm a")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-zinc-600" />
              <div className="mt-2 text-sm text-zinc-400">No payments yet</div>
              <div className="mt-1 text-xs text-zinc-600">
                Payments will appear here once users join the challenge
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
