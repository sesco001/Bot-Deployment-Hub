import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useGetWallet, useGetTransactions, useTopUpWallet, TopUpBodyPaymentMethod } from "@workspace/api-client-react";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Gift, RefreshCcw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";

const topupSchema = z.object({
  amountKes: z.coerce.number().min(10, "Minimum top-up is 10 KES"),
  paymentMethod: z.enum(["mpesa", "card", "international"]),
  paymentReference: z.string().optional()
});

export default function WalletPage() {
  const { user } = useAuth();
  const userId = user?.id || 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet, isLoading: walletLoading } = useGetWallet(userId);
  const { data: transactions, isLoading: txLoading } = useGetTransactions(userId);
  
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<z.infer<typeof topupSchema>>({
    resolver: zodResolver(topupSchema),
    defaultValues: { paymentMethod: "mpesa", amountKes: 100 }
  });

  const watchAmount = watch("amountKes") || 0;

  const topupMutation = useTopUpWallet({
    mutation: {
      onSuccess: () => {
        toast({ title: "Top-up Successful", description: "Your wallet has been credited." });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey(userId) });
        setIsTopUpOpen(false);
        reset();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Top-up Failed", description: err.message });
      }
    }
  });

  const onTopUp = (data: z.infer<typeof topupSchema>) => {
    topupMutation.mutate({ userId, data: data as any });
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">My Wallet</h1>
          <p className="text-muted-foreground">Manage your MD coins and payment history.</p>
        </div>

        <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
          <DialogTrigger asChild>
            <button className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5" /> Add Funds
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Top Up Wallet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onTopUp)} className="space-y-6 mt-4">
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-muted-foreground font-mono">KES</span>
                  <input
                    {...register("amountKes")}
                    type="number"
                    className="w-full pl-14 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-white font-mono text-lg"
                  />
                </div>
                {errors.amountKes && <p className="text-destructive text-sm">{errors.amountKes.message}</p>}
                
                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
                  <span className="text-sm text-primary">You will receive:</span>
                  <span className="font-bold text-primary">{watchAmount} MD Coins</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {['mpesa', 'card', 'international'].map(method => (
                    <label key={method} className="cursor-pointer">
                      <input type="radio" value={method} {...register("paymentMethod")} className="peer sr-only" />
                      <div className="text-center py-3 rounded-xl border border-border bg-background peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary transition-all text-sm font-medium text-muted-foreground capitalize">
                        {method}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={topupMutation.isPending}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {topupMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Process Payment"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glass-panel rounded-3xl p-8 bg-gradient-to-br from-primary/20 to-card relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <WalletIcon className="w-32 h-32" />
          </div>
          <p className="text-primary font-medium mb-2">Available Balance</p>
          <h2 className="text-5xl font-display font-bold text-white mb-2">
            {walletLoading ? "..." : wallet?.balanceMd.toLocaleString()} <span className="text-2xl text-white/50">MD</span>
          </h2>
          <p className="text-muted-foreground">
            ≈ KES {walletLoading ? "..." : wallet?.balanceKes.toLocaleString()}
          </p>
        </div>
        
        <div className="glass-panel rounded-3xl p-8 flex flex-col justify-center">
          <h3 className="text-lg font-medium text-white mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <span className="text-muted-foreground">Total Spent</span>
              <span className="font-bold text-white">
                {transactions?.filter(t => t.type === 'deduction').reduce((a, b) => a + b.amountMd, 0) || 0} MD
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Conversion Rate</span>
              <span className="font-mono text-secondary bg-secondary/10 px-2 py-1 rounded">1 MD = 1 KES</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="glass-panel rounded-3xl p-6 md:p-8">
        <h2 className="text-xl font-display font-bold text-white mb-6">Transaction History</h2>
        
        {txLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No transactions found.</div>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:border-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <TxIcon type={tx.type} />
                  <div>
                    <p className="font-medium text-white">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'MMM d, yyyy • h:mm a')}</p>
                  </div>
                </div>
                <div className={cn(
                  "font-mono font-bold",
                  tx.type === 'topup' || tx.type === 'bonus' || tx.type === 'refund' ? "text-success" : "text-white"
                )}>
                  {tx.type === 'deduction' ? '-' : '+'}{tx.amountMd} MD
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function TxIcon({ type }: { type: string }) {
  switch (type) {
    case 'topup': return <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center"><ArrowDownLeft className="w-5 h-5" /></div>;
    case 'deduction': return <div className="w-10 h-10 rounded-full bg-white/5 text-white flex items-center justify-center"><ArrowUpRight className="w-5 h-5" /></div>;
    case 'bonus': return <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Gift className="w-5 h-5" /></div>;
    case 'refund': return <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center"><RefreshCcw className="w-5 h-5" /></div>;
    default: return <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><WalletIcon className="w-5 h-5" /></div>;
  }
}
