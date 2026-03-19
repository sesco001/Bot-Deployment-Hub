import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useListBots, useDeployBot, useGetWallet } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Bot, Check, Zap, Info, ExternalLink, Shield, Eye, EyeOff, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const deploySchema = z.object({
  botName: z.string().min(3, "Name must be at least 3 characters"),
  useFreeDeployment: z.boolean().default(false),
});

type EnvField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  isSecret?: boolean;
  helpLink?: string;
};

const BOT_COLORS: Record<string, string> = {
  "cypher-x":     "from-secondary/30 to-primary/20 border-secondary/30 text-secondary",
  "king-md":      "from-violet-500/20 to-primary/20 border-violet-500/30 text-violet-400",
  "bwm-xmd-go":  "from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400",
  "atassa-cloud": "from-green-500/20 to-emerald-500/10 border-green-500/30 text-green-400",
};

const BTN_COLORS: Record<string, string> = {
  "cypher-x":     "bg-gradient-to-r from-secondary to-primary text-white hover:opacity-90",
  "king-md":      "bg-gradient-to-r from-violet-600 to-purple-500 text-white hover:opacity-90",
  "bwm-xmd-go":  "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90",
  "atassa-cloud": "bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:opacity-90",
};

export default function Bots() {
  const { user } = useAuth();
  const userId = user?.id || 0;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: bots, isLoading: botsLoading } = useListBots();
  const { data: wallet } = useGetWallet(userId);

  const [selectedBot, setSelectedBot] = useState<any>(null);
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<z.infer<typeof deploySchema>>({
    resolver: zodResolver(deploySchema),
  });

  const watchUseFree = watch("useFreeDeployment");
  const canAfford    = selectedBot && wallet && wallet.balanceMd >= selectedBot.costMd;
  const hasFreeDays  = user && user.freeDeployDaysLeft > 0;

  const deployMutation = useDeployBot({
    mutation: {
      onSuccess: () => {
        toast({ title: "Bot Deployed!", description: `Your bot is live for 36 days — check My Bots to manage it.` });
        setIsDeployOpen(false);
        reset();
        setEnvValues({});
        setLocation("/my-bots");
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Deployment Failed", description: err.message });
      },
    },
  });

  const openDeploy = (bot: any) => {
    setSelectedBot(bot);
    setEnvValues({});
    setShowSecrets({});
    reset();
    setIsDeployOpen(true);
  };

  const onDeploy = (data: z.infer<typeof deploySchema>) => {
    const envFields: EnvField[] = selectedBot?.envFields ?? [];
    for (const field of envFields) {
      if (field.required && !envValues[field.key]?.trim()) {
        toast({ variant: "destructive", title: "Missing Field", description: `${field.label} is required.` });
        return;
      }
    }
    deployMutation.mutate({
      data: {
        userId,
        botTypeId:        selectedBot.id,
        botName:          data.botName,
        apiKey:           null,
        config:           envFields.length > 0 ? JSON.stringify(envValues) : null,
        useFreeDeployment: data.useFreeDeployment,
      },
    });
  };

  const colorClass = selectedBot ? (BOT_COLORS[selectedBot.id] ?? BOT_COLORS["cypher-x"]) : "";
  const isLiveDeploy = selectedBot?.badge === "Live VPS";

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Bot Marketplace</h1>
        <p className="text-muted-foreground">Select and deploy live WhatsApp bots — 36 days nonstop, no maintenance needed.</p>
      </div>

      {hasFreeDays && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 flex items-start gap-4">
          <div className="p-2 bg-primary/20 rounded-full text-primary mt-1"><Zap className="w-5 h-5" /></div>
          <div>
            <h3 className="text-white font-bold">You have {user.freeDeployDaysLeft} free deploy days!</h3>
            <p className="text-muted-foreground text-sm">Deploy any bot for free — thanks to your referrals.</p>
          </div>
        </div>
      )}

      {botsLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(bots ?? []).map((bot: any, i: number) => (
            <motion.div
              key={bot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-3xl p-6 flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br border", BOT_COLORS[bot.id] ?? BOT_COLORS["cypher-x"])}>
                  <Bot className="w-7 h-7" />
                </div>
                <div className="text-right space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-2 py-1 rounded-full block">
                    Live VPS
                  </span>
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> 36 Days
                  </div>
                  <span className="text-2xl font-display font-bold text-white block">
                    {bot.costMd} <span className="text-sm text-muted-foreground">MD</span>
                  </span>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">{bot.name}</h3>
              <p className="text-muted-foreground mb-6 flex-1">{bot.description}</p>

              <div className="space-y-2 mb-8">
                {(bot.features ?? []).map((feat: string, j: number) => (
                  <div key={j} className="flex items-center gap-2 text-sm text-white/80">
                    <Check className="w-4 h-4 text-secondary shrink-0" /> {feat}
                  </div>
                ))}
              </div>

              {!bot.isActive ? (
                <div className="w-full py-3 rounded-xl bg-white/5 text-muted-foreground font-medium text-center text-sm">Coming Soon</div>
              ) : (
                <button
                  onClick={() => openDeploy(bot)}
                  className={cn("w-full py-3 rounded-xl font-bold transition-all", BTN_COLORS[bot.id] ?? BTN_COLORS["cypher-x"])}
                >
                  Deploy Now — 36 Days
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={isDeployOpen} onOpenChange={setIsDeployOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              {isLiveDeploy && <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />}
              Deploy {selectedBot?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onDeploy)} className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Instance Name</label>
              <input
                {...register("botName")}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-white"
                placeholder="e.g. My Main Group Bot"
              />
              {errors.botName && <p className="text-destructive text-sm">{errors.botName.message}</p>}
            </div>

            {(selectedBot?.envFields ?? []).length > 0 && (
              <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-xs font-bold uppercase tracking-wider text-secondary">Bot Configuration</p>
                {(selectedBot.envFields as EnvField[]).map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {field.isSecret && <Shield className="w-3.5 h-3.5 text-primary" />}
                        {field.label}
                        {field.required && <span className="text-destructive">*</span>}
                      </span>
                      {field.helpLink && (
                        <a href={field.helpLink} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-secondary hover:text-white flex items-center gap-1 transition-colors">
                          Get Session ID <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={field.isSecret && !showSecrets[field.key] ? "password" : "text"}
                        value={envValues[field.key] ?? ""}
                        onChange={(e) => setEnvValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-white pr-12"
                        placeholder={field.placeholder}
                      />
                      {field.isSecret && (
                        <button type="button"
                          onClick={() => setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                          {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-sm flex gap-2">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Your bot will run <strong>nonstop for 36 days</strong> on a live VPS. Startup takes up to 60 seconds.</span>
            </div>

            {hasFreeDays && (
              <label className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10 cursor-pointer">
                <input type="checkbox" {...register("useFreeDeployment")} className="w-5 h-5 accent-primary rounded" />
                <div>
                  <p className="text-sm font-bold text-white">Use Free Deploy Days ({user.freeDeployDaysLeft} days)</p>
                  <p className="text-xs text-primary">Cost: 0 MD</p>
                </div>
              </label>
            )}

            {!hasFreeDays && !canAfford && selectedBot && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex gap-2">
                <Info className="w-5 h-5 shrink-0" />
                Insufficient balance. You need {selectedBot.costMd} MD to deploy.
              </div>
            )}

            <button
              type="submit"
              disabled={deployMutation.isPending || (!watchUseFree && !canAfford)}
              className="w-full py-3.5 mt-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {deployMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Deploying to VPS...</>
              ) : (
                `Confirm Deploy — ${selectedBot?.costMd ?? 0} MD`
              )}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
