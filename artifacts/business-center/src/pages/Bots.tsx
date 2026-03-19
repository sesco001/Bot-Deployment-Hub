import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useListBots, useDeployBot, useGetWallet } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Bot, Check, Zap, Info, ExternalLink, Shield, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

const deploySchema = z.object({
  botName: z.string().min(3, "Name must be at least 3 characters"),
  apiKey: z.string().optional(),
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

export default function Bots() {
  const { user } = useAuth();
  const userId = user?.id || 0;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: bots, isLoading: botsLoading } = useListBots();
  const { data: wallet } = useGetWallet(userId);

  const displayBots = bots && bots.length > 0 ? bots : [
    { id: "cypher-x", name: "Cypher X", description: "Live WhatsApp bot deployment on VPS.", costMd: 30, features: ["Live VPS deployment", "AI replies", "Group management"], isActive: true, envFields: [] },
    { id: "king-md", name: "King MD Bot", description: "The ultimate premium bot.", costMd: 30, features: ["Auto Reply", "Group Management"], isActive: true, envFields: [] }
  ] as any[];

  const [selectedBot, setSelectedBot] = useState<any>(null);
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<z.infer<typeof deploySchema>>({
    resolver: zodResolver(deploySchema),
  });

  const watchUseFree = watch("useFreeDeployment");
  const canAfford = selectedBot && wallet && wallet.balanceMd >= selectedBot.costMd;
  const hasFreeDays = user && user.freeDeployDaysLeft > 0;

  const deployMutation = useDeployBot({
    mutation: {
      onSuccess: () => {
        toast({ title: "Bot Deployed!", description: "Your bot is now starting up on the server." });
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

    const config = envFields.length > 0 ? JSON.stringify(envValues) : null;

    deployMutation.mutate({
      data: {
        userId,
        botTypeId: selectedBot.id,
        botName: data.botName,
        apiKey: data.apiKey || null,
        config,
        useFreeDeployment: data.useFreeDeployment,
      },
    });
  };

  const isCypherX = selectedBot?.id === "cypher-x";

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
          {displayBots.map((bot: any, i: number) => (
            <motion.div
              key={bot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-3xl p-6 flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bot.id === "cypher-x" ? "bg-gradient-to-br from-secondary/30 to-primary/20 border border-secondary/30 text-secondary" : "bg-gradient-to-br from-primary/20 to-card border border-primary/20 text-primary"}`}>
                  <Bot className="w-7 h-7" />
                </div>
                <div className="text-right">
                  {bot.id === "cypher-x" && (
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-2 py-1 rounded-full block mb-1">Live Deploy</span>
                  )}
                  <span className="text-2xl font-display font-bold text-white">{bot.costMd} <span className="text-sm text-muted-foreground">MD</span></span>
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
                  className={`w-full py-3 rounded-xl font-bold transition-colors ${bot.id === "cypher-x" ? "bg-gradient-to-r from-secondary to-primary text-white hover:opacity-90" : "bg-white text-black hover:bg-gray-200"}`}
                >
                  Deploy Now
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
              {isCypherX && <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />}
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
                {(selectedBot?.envFields as EnvField[]).map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {field.isSecret && <Shield className="w-3.5 h-3.5 text-primary" />}
                        {field.label}
                        {field.required && <span className="text-destructive">*</span>}
                      </span>
                      {field.helpLink && (
                        <a
                          href={field.helpLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-secondary hover:text-white flex items-center gap-1 transition-colors"
                        >
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
                        <button
                          type="button"
                          onClick={() => setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                        >
                          {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isCypherX && (
              <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-sm flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Your bot will be live-deployed on our VPS. Startup may take up to 60 seconds.</span>
              </div>
            )}

            {hasFreeDays && (
              <label className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10 cursor-pointer">
                <input type="checkbox" {...register("useFreeDeployment")} className="w-5 h-5 accent-primary rounded" />
                <div>
                  <p className="text-sm font-bold text-white">Use Free Deploy Days</p>
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
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isCypherX ? "Deploying to VPS..." : "Deploying..."}
                </>
              ) : (
                "Confirm Deployment"
              )}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
