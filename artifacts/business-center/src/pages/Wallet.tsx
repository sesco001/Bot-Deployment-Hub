import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useGetWallet, useGetTransactions, useTopUpWallet } from "@workspace/api-client-react";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Gift, RefreshCcw, Loader2, Smartphone, CreditCard, Globe, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";

type PayMethod = "mpesa" | "card" | "international";

const METHOD_INFO: Record<PayMethod, { icon: typeof Smartphone; label: string; color: string }> = {
  mpesa: { icon: Smartphone, label: "M-Pesa", color: "text-green-400" },
  card: { icon: CreditCard, label: "Card", color: "text-primary" },
  international: { icon: Globe, label: "International", color: "text-secondary" },
};

export default function WalletPage() {
  const { user } = useAuth();
  const userId = user?.id || 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet, isLoading: walletLoading } = useGetWallet(userId);
  const { data: transactions, isLoading: txLoading } = useGetTransactions(userId);

  const [isOpen, setIsOpen] = useState(false);
  const [method, setMethod] = useState<PayMethod>("mpesa");
  const [amount, setAmount] = useState(100);
  const [phone, setPhone] = useState("");
  const [stkPending, setStkPending] = useState(false);
  const [stkSent, setStkSent] = useState(false);
  const [payRef, setPayRef] = useState("");

  const topupMutation = useTopUpWallet({
    mutation: {
      onSuccess: () => {
        toast({ title: "Top-up Successful", description: "Your wallet has been credited." });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey(userId) });
        setIsOpen(false);
        resetDialog();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Top-up Failed", description: err.message });
      },
    },
  });

  const resetDialog = () => {
    setAmount(100);
    setPhone("");
    setStkPending(false);
    setStkSent(false);
    setPayRef("");
    setMethod("mpesa");
  };

  const handleMpesaSTK = async () => {
    if (!phone.trim()) {
      toast({ variant: "destructive", title: "Phone required", description: "Enter your M-Pesa phone number." });
      return;
    }
    if (amount < 10) {
      toast({ variant: "destructive", title: "Minimum 10 KES", description: "Amount must be at least 10 KES." });
      return;
    }

    setStkPending(true);
    try {
      const res = await fetch(`/api/wallet/${userId}/stk-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "STK push failed");

      setPayRef(data.reference ?? "");
      setStkSent(true);
      toast({ title: "STK Push Sent!", description: "Check your phone and enter your M-Pesa PIN." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "M-Pesa Error", description: err.message });
    } finally {
      setStkPending(false);
    }
  };

  const handleManualTopUp = () => {
    topupMutation.mutate({ userId, data: { amountKes: amount, paymentMethod: method, paymentReference: undefined } });
  };

  const handlePaidConfirm = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey(userId) });
    toast({ title: "Payment Check", description: "Your wallet will update automatically once M-Pesa confirms." });
    setIsOpen(false);
    resetDialog();
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">My Wallet</h1>
          <p className="text-muted-foreground">Manage your MD coins and payment history.</p>
        </div>
        <button
          onClick={() => { resetDialog(); setIsOpen(true); }}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <ArrowDownLeft className="w-5 h-5" /> Add Funds
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glass-panel rounded-3xl p-8 bg-gradient-to-br from-primary/20 to-card relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <WalletIcon className="w-32 h-32" />
          </div>
          <p className="text-primary font-medium mb-2">Available Balance</p>
          <h2 className="text-5xl font-display font-bold text-white mb-2">
            {walletLoading ? "..." : wallet?.balanceMd.toLocaleString()} <span className="text-2xl text-white/50">MD</span>
          </h2>
          <p className="text-muted-foreground">≈ KES {walletLoading ? "..." : wallet?.balanceKes.toLocaleString()}</p>
        </div>

        <div className="glass-panel rounded-3xl p-8 flex flex-col justify-center">
          <h3 className="text-lg font-medium text-white mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <span className="text-muted-foreground">Total Spent</span>
              <span className="font-bold text-white">
                {transactions?.filter((t) => t.type === "deduction").reduce((a, b) => a + Math.abs(b.amountMd), 0) || 0} MD
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Conversion Rate</span>
              <span className="font-mono text-secondary bg-secondary/10 px-2 py-1 rounded">1 MD = 1 KES</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 md:p-8">
        <h2 className="text-xl font-display font-bold text-white mb-6">Transaction History</h2>
        {txLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No transactions found.</div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:border-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <TxIcon type={tx.type} />
                  <div>
                    <p className="font-medium text-white">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), "MMM d, yyyy • h:mm a")}</p>
                  </div>
                </div>
                <div className={cn("font-mono font-bold", tx.type === "topup" || tx.type === "bonus" || tx.type === "refund" ? "text-success" : "text-white")}>
                  {tx.type === "deduction" ? "" : "+"}{tx.amountMd} MD
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetDialog(); }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Add Funds</DialogTitle>
          </DialogHeader>

          {!stkSent ? (
            <div className="space-y-6 mt-4">
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-muted-foreground font-mono">KES</span>
                  <input
                    type="number"
                    min={10}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full pl-14 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-white font-mono text-lg"
                  />
                </div>
                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
                  <span className="text-sm text-primary">You will receive:</span>
                  <span className="font-bold text-primary">{amount} MD Coins</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["mpesa", "card", "international"] as PayMethod[]).map((m) => {
                    const info = METHOD_INFO[m];
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all text-sm font-medium",
                          method === m
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-white/20"
                        )}
                      >
                        <info.icon className={cn("w-5 h-5", method === m ? "text-primary" : info.color)} />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {method === "mpesa" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-green-400" /> M-Pesa Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-white font-mono"
                    placeholder="07XXXXXXXX or 254XXXXXXXXX"
                  />
                  <p className="text-xs text-muted-foreground">An STK push will be sent to this number to confirm payment.</p>
                </div>
              )}

              <button
                onClick={method === "mpesa" ? handleMpesaSTK : handleManualTopUp}
                disabled={stkPending || topupMutation.isPending}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {(stkPending || topupMutation.isPending) ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : method === "mpesa" ? (
                  "Send M-Pesa Prompt"
                ) : (
                  "Process Payment"
                )}
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Smartphone className="w-10 h-10 text-green-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Check Your Phone!</h3>
                <p className="text-muted-foreground">An M-Pesa payment prompt has been sent to <span className="text-white font-mono">{phone}</span>.</p>
                <p className="text-muted-foreground mt-2 text-sm">Enter your M-Pesa PIN to complete the payment of <span className="text-primary font-bold">KES {amount}</span>.</p>
              </div>
              {payRef && (
                <p className="text-xs text-muted-foreground font-mono bg-white/5 px-3 py-2 rounded-lg w-full text-center">
                  Ref: {payRef}
                </p>
              )}
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handlePaidConfirm}
                  className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> I've Completed Payment
                </button>
                <button
                  onClick={resetDialog}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground font-medium text-sm"
                >
                  Cancel / Try Again
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function TxIcon({ type }: { type: string }) {
  switch (type) {
    case "topup": return <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center"><ArrowDownLeft className="w-5 h-5" /></div>;
    case "deduction": return <div className="w-10 h-10 rounded-full bg-white/5 text-white flex items-center justify-center"><ArrowUpRight className="w-5 h-5" /></div>;
    case "bonus": return <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Gift className="w-5 h-5" /></div>;
    case "refund": return <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center"><RefreshCcw className="w-5 h-5" /></div>;
    default: return <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><WalletIcon className="w-5 h-5" /></div>;
  }
}
