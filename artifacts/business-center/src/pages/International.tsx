import { AppLayout } from "@/components/layout/AppLayout";
import { Globe, CreditCard, Bitcoin, ShieldCheck, Mail } from "lucide-react";

export default function International() {
  return (
    <AppLayout>
      <div className="mb-8 text-center max-w-2xl mx-auto pt-10">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Globe className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-4">Global Payments</h1>
        <p className="text-xl text-muted-foreground">
          We're expanding our infrastructure to support seamless international transactions.
        </p>
        <div className="inline-block mt-6 px-4 py-1.5 rounded-full bg-secondary/20 text-secondary font-medium text-sm border border-secondary/30 uppercase tracking-widest">
          Coming Soon
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
        <div className="glass-panel rounded-3xl p-8 text-center">
          <CreditCard className="w-8 h-8 text-white mx-auto mb-4" />
          <h3 className="font-bold text-white mb-2">Cards</h3>
          <p className="text-sm text-muted-foreground">Visa, Mastercard, and Amex support via Stripe integration.</p>
        </div>
        <div className="glass-panel rounded-3xl p-8 text-center border-primary/20">
          <Bitcoin className="w-8 h-8 text-primary mx-auto mb-4" />
          <h3 className="font-bold text-white mb-2">Crypto</h3>
          <p className="text-sm text-muted-foreground">USDT, BTC, and ETH deposits directly to your MD Wallet.</p>
        </div>
        <div className="glass-panel rounded-3xl p-8 text-center">
          <ShieldCheck className="w-8 h-8 text-white mx-auto mb-4" />
          <h3 className="font-bold text-white mb-2">Secure</h3>
          <p className="text-sm text-muted-foreground">Bank-level encryption and real-time conversion rates.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mt-16 glass-panel rounded-3xl p-8 text-center">
        <h3 className="text-xl font-bold text-white mb-4">Need manual processing?</h3>
        <p className="text-muted-foreground mb-6">
          If you are an international client and need to top up your wallet immediately, our support team can process payments manually.
        </p>
        <a href="mailto:support@makamescodigitalsolutions.com" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-colors">
          <Mail className="w-5 h-5" /> Contact Support
        </a>
      </div>
    </AppLayout>
  );
}
