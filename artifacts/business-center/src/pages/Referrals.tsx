import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useGetReferrals } from "@workspace/api-client-react";
import { Copy, CheckCircle2, Users, Gift, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function Referrals() {
  const { user } = useAuth();
  const { data: refData, isLoading } = useGetReferrals(user?.id || 0);
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${refData?.referralCode || user?.referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = Math.min(((refData?.referralCount || 0) % 5) / 5 * 100, 100);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Referral Program</h1>
        <p className="text-muted-foreground">Invite friends. Earn free bot deployments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Main Invite Card */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-8 bg-gradient-to-br from-primary/10 to-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Give 0, Get 3 Days Free</h2>
              <p className="text-primary font-medium">Invite 5 friends to unlock premium access.</p>
            </div>
          </div>
          
          <div className="mb-8">
            <p className="text-sm font-medium text-white mb-3">Your Unique Link</p>
            <div className="flex items-center gap-2 bg-background border border-border rounded-xl p-2 pl-4">
              <code className="flex-1 text-muted-foreground truncate">{referralLink}</code>
              <button 
                onClick={handleCopy}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 flex items-center gap-2 shrink-0"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress to next reward</span>
              <span className="text-white font-bold">{(refData?.referralCount || 0) % 5} / 5 Joined</span>
            </div>
            <div className="h-3 w-full bg-background rounded-full overflow-hidden border border-border">
              <div 
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="glass-panel rounded-3xl p-8 flex flex-col justify-center">
          <Users className="w-10 h-10 text-secondary mb-4" />
          <h3 className="text-4xl font-display font-bold text-white mb-1">{refData?.referralCount || 0}</h3>
          <p className="text-muted-foreground mb-6">Total friends invited</p>
          
          <div className="border-t border-border pt-6">
            <h3 className="text-3xl font-display font-bold text-primary mb-1">{refData?.freeDeployDaysLeft || 0}</h3>
            <p className="text-muted-foreground">Free deploy days available</p>
          </div>
        </div>
      </div>

      {/* Referrals List */}
      <div className="glass-panel rounded-3xl p-8">
        <h3 className="text-xl font-bold text-white mb-6">Your Network</h3>
        
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !refData?.referrals || refData.referrals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No one has joined using your link yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {refData.referrals.map(ref => (
              <div key={ref.id} className="p-4 rounded-2xl bg-background border border-border flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center font-bold text-white">
                  {ref.referredUsername.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{ref.referredUsername}</p>
                  <p className="text-xs text-muted-foreground">Joined {format(new Date(ref.joinedAt), 'MMM d, yyyy')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
