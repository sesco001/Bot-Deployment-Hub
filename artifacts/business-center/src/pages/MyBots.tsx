import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useListDeployments, useStopDeployment, useRestartDeployment, useUpdateDeployment } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListDeploymentsQueryKey } from "@workspace/api-client-react";
import { Play, Square, Settings, RefreshCw, Loader2, Bot, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function MyBots() {
  const { user } = useAuth();
  const userId = user?.id || 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deployments, isLoading } = useListDeployments({ userId });

  const stopMut = useStopDeployment({ onSuccess: () => invalidate() });
  const restartMut = useRestartDeployment({ onSuccess: () => invalidate() });
  const updateMut = useUpdateDeployment({ onSuccess: () => invalidate() });

  const [editBot, setEditBot] = useState<any>(null);
  const [editName, setEditName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey({ userId }) });

  const handleAction = async (action: 'stop' | 'restart', id: number) => {
    try {
      if (action === 'stop') await stopMut.mutateAsync({ deploymentId: id });
      if (action === 'restart') await restartMut.mutateAsync({ deploymentId: id });
      toast({ title: "Action completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMut.mutateAsync({ deploymentId: editBot.id, data: { botName: editName } });
      toast({ title: "Settings updated" });
      setEditBot(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message });
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Control Panel</h1>
        <p className="text-muted-foreground">Manage your deployed bot instances.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : !deployments || deployments.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center">
          <Bot className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Active Bots</h2>
          <p className="text-muted-foreground mb-6">Deploy a bot from the marketplace to get started.</p>
          <a href="/bots" className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors">
            Go to Marketplace
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {deployments.map(bot => (
            <div key={bot.id} className="glass-panel rounded-3xl p-6 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    {bot.botName}
                    <StatusBadge status={bot.status} />
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Type: {bot.botTypeId}</p>
                </div>
                <button onClick={() => { setEditBot(bot); setEditName(bot.botName); }} className="p-2 text-muted-foreground hover:text-white bg-white/5 rounded-lg">
                  <Settings className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div className="bg-background p-3 rounded-xl border border-border">
                  <p className="text-muted-foreground mb-1">Deployed</p>
                  <p className="text-white font-mono">{format(new Date(bot.deployedAt), 'MMM d, yyyy')}</p>
                </div>
                <div className="bg-background p-3 rounded-xl border border-border">
                  <p className="text-muted-foreground mb-1">Expires</p>
                  <p className="text-white font-mono">{bot.expiresAt ? format(new Date(bot.expiresAt), 'MMM d, yyyy') : 'Never'}</p>
                </div>
              </div>

              <div className="mt-auto flex gap-3">
                {bot.status === 'running' ? (
                  <button 
                    onClick={() => handleAction('stop', bot.id)}
                    disabled={stopMut.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-destructive/20 text-white hover:text-destructive border border-white/5 hover:border-destructive/30 transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" /> Stop
                  </button>
                ) : (
                  <button 
                    onClick={() => handleAction('restart', bot.id)}
                    disabled={restartMut.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-success/10 hover:bg-success/20 text-success border border-success/20 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" /> Start
                  </button>
                )}
                
                <button 
                  onClick={() => handleAction('restart', bot.id)}
                  disabled={restartMut.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-colors"
                >
                  <RefreshCw className={cn("w-4 h-4", restartMut.isPending && "animate-spin")} /> Restart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editBot} onOpenChange={(o) => !o && setEditBot(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Configuration</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Bot Name</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 text-white outline-none"
              />
            </div>
            <button type="submit" disabled={updateMut.isPending} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold">
              {updateMut.isPending ? "Saving..." : "Save Changes"}
            </button>
            <div className="pt-4 border-t border-border mt-4">
              <button 
                type="button" 
                onClick={() => { handleAction('stop', editBot.id); setEditBot(null); }}
                className="w-full py-3 rounded-xl bg-destructive/10 text-destructive font-bold flex items-center justify-center gap-2 hover:bg-destructive/20"
              >
                <Trash2 className="w-4 h-4" /> Delete / Force Stop
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    running: "bg-success/20 text-success border-success/30",
    stopped: "bg-muted text-muted-foreground border-border",
    error: "bg-destructive/20 text-destructive border-destructive/30",
    pending: "bg-secondary/20 text-secondary border-secondary/30",
  };
  const c = colors[status as keyof typeof colors] || colors.stopped;
  return (
    <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full border uppercase tracking-wider", c)}>
      {status}
    </span>
  );
}
