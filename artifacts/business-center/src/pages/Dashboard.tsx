import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetWallet, useListDeployments, useGetReferrals } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Server, Users, ArrowUpRight, Plus, Activity } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id || 0;

  const { data: wallet } = useGetWallet(userId);
  const { data: deployments } = useListDeployments({ userId });
  const { data: referrals } = useGetReferrals(userId);

  const activeBots = deployments?.filter(d => d.status === 'running').length || 0;
  const totalBots = deployments?.length || 0;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Welcome back, {user?.username}</h1>
        <p className="text-muted-foreground">Here is what's happening with your account today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Wallet Balance" 
          value={wallet ? formatCurrency(wallet.balanceMd, 'MD') : '...'} 
          subtitle={wallet ? formatCurrency(wallet.balanceKes, 'KES') : ''}
          icon={Wallet} 
          color="primary"
          action={{ label: "Top Up", href: "/wallet" }}
        />
        <StatCard 
          title="Active Bots" 
          value={activeBots.toString()} 
          subtitle={`Out of ${totalBots} total deployments`}
          icon={Activity} 
          color="secondary"
          action={{ label: "Manage", href: "/my-bots" }}
        />
        <StatCard 
          title="Free Days Left" 
          value={user?.freeDeployDaysLeft?.toString() || "0"} 
          subtitle="From referral rewards"
          icon={Server} 
          color="accent"
          action={{ label: "Deploy Bot", href: "/bots" }}
        />
        <StatCard 
          title="Total Referrals" 
          value={referrals?.referralCount?.toString() || "0"} 
          subtitle={`${5 - ((referrals?.referralCount || 0) % 5)} more for next reward`}
          icon={Users} 
          color="success"
          action={{ label: "Invite", href: "/referrals" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="glass-panel rounded-3xl p-6 md:p-8">
          <h2 className="text-xl font-display font-bold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/bots" className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/30 transition-all group">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-medium text-white">Deploy New Bot</span>
            </Link>
            <Link href="/wallet" className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white/5 hover:bg-secondary/10 border border-white/5 hover:border-secondary/30 transition-all group">
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <span className="font-medium text-white">Add Funds</span>
            </Link>
            <Link href="/boost" className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white/5 hover:bg-accent/20 border border-white/5 hover:border-accent/30 transition-all group sm:col-span-2">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span className="font-medium text-white">Boost Social Media</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity Mini */}
        <div className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col">
          <h2 className="text-xl font-display font-bold text-white mb-6 flex justify-between items-center">
            Recent Deployments
            <Link href="/my-bots" className="text-sm font-sans font-medium text-primary hover:text-white transition-colors">View All</Link>
          </h2>
          
          <div className="flex-1">
            {!deployments || deployments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                <Server className="w-12 h-12 mb-4 opacity-20" />
                <p>No bots deployed yet.</p>
                <Link href="/bots" className="text-primary mt-2 hover:underline">Deploy your first bot</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {deployments.slice(0, 4).map(bot => (
                  <div key={bot.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${bot.status === 'running' ? 'bg-success' : 'bg-destructive'}`} />
                      <div>
                        <p className="font-medium text-white text-sm">{bot.botName}</p>
                        <p className="text-xs text-muted-foreground">{bot.botTypeId}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground bg-black/20 px-2 py-1 rounded">
                      {new Date(bot.deployedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, action }: any) {
  const colorMap = {
    primary: "text-primary bg-primary/10",
    secondary: "text-secondary bg-secondary/10",
    accent: "text-accent-foreground bg-accent/20",
    success: "text-success bg-success/10",
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="glass-panel rounded-3xl p-6 relative overflow-hidden group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorMap[color as keyof typeof colorMap]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {action && (
          <Link href={action.href} className="text-xs font-medium text-muted-foreground hover:text-white transition-colors bg-white/5 px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            {action.label}
          </Link>
        )}
      </div>
      <h3 className="text-3xl font-display font-bold text-white mb-1">{value}</h3>
      <p className="text-sm font-medium text-white/80">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
  );
}
