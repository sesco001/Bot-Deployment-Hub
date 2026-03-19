import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useListBots, useDeployBot, useGetWallet, useGetReferrals } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Bot, Check, Zap, Info } from "lucide-react";
import { motion } from "framer-motion";

const deploySchema = z.object({
  botName: z.string().min(3, "Name must be at least 3 characters"),
  apiKey: z.string().optional(),
  config: z.string().optional(),
  useFreeDeployment: z.boolean().default(false)
});

export default function Bots() {
  const { user } = useAuth();
  const userId = user?.id || 0;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: bots, isLoading: botsLoading } = useListBots();
  const { data: wallet } = useGetWallet(userId);
  
  // Safe fallback if API is not fully seeded yet
  const displayBots = bots && bots.length > 0 ? bots : [
    { id: "king-md", name: "King MD Bot", description: "The ultimate premium bot for full automation.", costMd: 30, apiEndpoint: "/api/king", features: ["Auto Reply", "Group Management", "Anti-delete"], isActive: true },
    { id: "pro-bot", name: "Pro Auto Bot", description: "Standard bot for everyday group management.", costMd: 50, apiEndpoint: "/api/pro", features: ["Basic Replies", "Welcome Messages"], isActive: true }
  ];

  const [selectedBot, setSelectedBot] = useState<any>(null);
  const [isDeployOpen, setIsDeployOpen] = useState(false);

  const { register, handleSubmit, watch, reset } = useForm<z.infer<typeof deploySchema>>({
    resolver: zodResolver(deploySchema)
  });

  const watchUseFree = watch("useFreeDeployment");
  const canAfford = selectedBot && wallet && wallet.balanceMd >= selectedBot.costMd;
  const hasFreeDays = user && user.freeDeployDaysLeft > 0;

  const deployMutation = useDeployBot({
    mutation: {
      onSuccess: () => {
        toast({ title: "Bot Deployed!", description: "Your bot is now starting up." });
        setIsDeployOpen(false);
        reset();
        setLocation("/my-bots");
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Deployment Failed", description: err.message });
      }
    }
  });

  const onDeploy = (data: z.infer<typeof deploySchema>) => {
    deployMutation.mutate({
      data: {
        userId,
        botTypeId: selectedBot.id,
        botName: data.botName,
        apiKey: data.apiKey || null,
        config: data.config || null,
        useFreeDeployment: data.useFreeDeployment
      }
    });
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Bot Marketplace</h1>
        <p className="text-muted-foreground">Select and deploy intelligent bots to automate your tasks.</p>
      </div>

      {hasFreeDays && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 flex items-start gap-4">
          <div className="p-2 bg-primary/20 rounded-full text-primary mt-1"><Zap className="w-5 h-5" /></div>
          <div>
            <h3 className="text-white font-bold">You have {user.freeDeployDaysLeft} free deploy days!</h3>
            <p className="text-muted-foreground text-sm">Thanks to your referrals, you can deploy any bot for free.</p>
          </div>
        </div>
      )}

      {botsLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayBots.map((bot, i) => (
            <motion.div 
              key={bot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-3xl p-6 flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-card border border-primary/20 flex items-center justify-center text-primary">
                  <Bot className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <span className="text-2xl font-display font-bold text-white">{bot.costMd} <span className="text-sm text-muted-foreground">MD</span></span>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">{bot.name}</h3>
              <p className="text-muted-foreground mb-6 flex-1">{bot.description}</p>
              
              <div className="space-y-2 mb-8">
                {bot.features.map((feat: string, j: number) => (
                  <div key={j} className="flex items-center gap-2 text-sm text-white/80">
                    <Check className="w-4 h-4 text-secondary" /> {feat}
                  </div>
                ))}
              </div>

              <Dialog open={isDeployOpen && selectedBot?.id === bot.id} onOpenChange={(open) => {
                setIsDeployOpen(open);
                if(open) setSelectedBot(bot);
              }}>
                <DialogTrigger asChild>
                  <button className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors">
                    Deploy Now
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Deploy {bot.name}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onDeploy)} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Instance Name</label>
                      <input
                        {...register("botName")}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-white"
                        placeholder="e.g. My Main Group Bot"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white flex justify-between">
                        API Key <span className="text-xs text-muted-foreground">Optional</span>
                      </label>
                      <input
                        {...register("apiKey")}
                        type="password"
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-white"
                        placeholder="Leave blank for default"
                      />
                    </div>

                    {hasFreeDays && (
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10 cursor-pointer">
                        <input type="checkbox" {...register("useFreeDeployment")} className="w-5 h-5 accent-primary rounded" />
                        <div>
                          <p className="text-sm font-bold text-white">Use Free Deploy Days</p>
                          <p className="text-xs text-primary">Cost: 0 MD</p>
                        </div>
                      </label>
                    )}

                    {!hasFreeDays && !canAfford && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex gap-2">
                        <Info className="w-5 h-5 shrink-0" />
                        Insufficient balance. You need {bot.costMd} MD to deploy.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={deployMutation.isPending || (!watchUseFree && !canAfford)}
                      className="w-full py-3.5 mt-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      {deployMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Deployment"}
                    </button>
                  </form>
                </DialogContent>
              </Dialog>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
