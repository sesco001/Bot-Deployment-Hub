import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { 
  LayoutDashboard, Wallet, Bot, Server, 
  TrendingUp, Globe, Users, LogOut, Menu, X, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/wallet', label: 'Wallet', icon: Wallet },
  { path: '/bots', label: 'Marketplace', icon: Bot },
  { path: '/my-bots', label: 'Control Panel', icon: Server },
  { path: '/boost', label: 'Boost Services', icon: TrendingUp },
  { path: '/international', label: 'Intl Payments', icon: Globe },
  { path: '/referrals', label: 'Referrals', icon: Users },
];

const ADMIN_NAV = { path: '/admin', label: 'Admin Panel', icon: ShieldCheck };

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdmin = localStorage.getItem("mkm_admin_key") === "makames_admin_2026";
  const allNavItems = isAdmin ? [...NAV_ITEMS, ADMIN_NAV] : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 flex-col bg-card/50 border-r border-white/5 backdrop-blur-xl fixed inset-y-0 z-40">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-white text-lg">MD</span>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">MaKames</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
          {allNavItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              )}>
                {isActive && (
                  <motion.div 
                    layoutId="activeNav" 
                    className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "group-hover:text-white")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Menu */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-16 bg-card/80 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="font-display font-bold text-white text-sm">MD</span>
          </div>
          <span className="font-display font-bold text-lg text-white">MaKames</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-white">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-3xl pt-20 pb-6 px-4 flex flex-col"
          >
            <nav className="flex-1 space-y-2 overflow-y-auto">
              {allNavItems.map((item) => (
                <Link 
                  key={item.path} 
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-4 rounded-2xl text-lg",
                    location === item.path ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <button 
              onClick={logout}
              className="mt-auto w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-destructive/10 text-destructive font-medium"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 min-h-screen flex flex-col pt-16 lg:pt-0">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
