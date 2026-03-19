import { Link } from "wouter";
import { motion } from "framer-motion";
import { Bot, Rocket, Globe, Zap, Shield, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 glass-panel border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="font-display font-bold text-white text-lg">MD</span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white hidden sm:block">MaKames Center</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-muted-foreground hover:text-white font-medium transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="px-6 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0 opacity-40">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Digital abstract background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              Welcome to the Future of Digital Business
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold text-white leading-[1.1] mb-8">
              Deploy. Boost. <br className="hidden md:block" />
              <span className="text-gradient-primary">Dominate.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              The ultimate command center for managing intelligent bots, amplifying your social presence, and scaling your digital operations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-primary to-secondary text-white font-bold text-lg hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
                Launch Dashboard <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="#features" className="w-full sm:w-auto px-8 py-4 rounded-full glass-panel text-white font-medium hover:bg-white/10 transition-colors text-center">
                Explore Features
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative z-10 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6">Everything you need to <span className="text-gradient-primary">scale</span></h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">One unified platform to manage your entire digital ecosystem with zero friction.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Bot}
              title="1-Click Bot Deployment"
              description="Deploy King MD and other powerful automation bots instantly. Manage APIs and configurations from a sleek control panel."
              color="from-primary to-purple-600"
            />
            <FeatureCard 
              icon={Rocket}
              title="Social Media Boosting"
              description="Skyrocket your engagement. Get real likes, followers, and views through our integrated marketing network."
              color="from-secondary to-blue-600"
            />
            <FeatureCard 
              icon={Zap}
              title="MD Coin Economy"
              description="Frictionless internal wallet system. 1 MD = 1 KES. Top up seamlessly via M-Pesa or Card and deploy instantly."
              color="from-orange-500 to-red-500"
            />
            <FeatureCard 
              icon={Shield}
              title="Secure Infrastructure"
              description="Your API keys and bot configurations are encrypted and stored securely on our enterprise-grade VPS network."
              color="from-emerald-400 to-emerald-600"
            />
            <FeatureCard 
              icon={Globe}
              title="International Ready"
              description="Expanding globally. Upcoming support for international payments, crypto, and multi-currency top-ups."
              color="from-pink-500 to-rose-500"
            />
            <div className="glass-panel rounded-3xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h3 className="text-2xl font-display font-bold text-white mb-4 z-10">Refer & Earn</h3>
              <p className="text-muted-foreground mb-6 z-10">Invite 5 friends and get 3 days of premium bot deployment absolutely free.</p>
              <Link href="/register" className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-colors z-10">
                Get Referral Link
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-muted-foreground">
        <p>© {new Date().getFullYear()} MaKames Digital Solutions. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) {
  return (
    <div className="glass-panel rounded-3xl p-8 hover-lift group">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br", color)}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-xl font-bold text-white mb-3 font-display">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
