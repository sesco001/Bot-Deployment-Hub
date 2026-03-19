import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { Bot, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: (data) => {
        login(data.user, data.token);
        toast({ title: "Welcome back!", description: "Successfully logged in." });
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({ 
          variant: "destructive", 
          title: "Login Failed", 
          description: err.message || "Invalid credentials. Please try again." 
        });
      }
    }
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate({ data });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Image/Branding */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Background" 
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/50 to-background" />
        </div>
        <div className="relative z-10 max-w-md p-12 text-center">
          <img 
            src={`${import.meta.env.BASE_URL}images/bot-abstract.png`}
            alt="Bot"
            className="w-64 h-64 mx-auto mb-8 drop-shadow-[0_0_30px_rgba(139,92,246,0.5)] animate-float"
          />
          <h2 className="text-4xl font-display font-bold text-white mb-4">Command Center</h2>
          <p className="text-muted-foreground text-lg">Manage your bots, boost your socials, and scale your digital empire from one dashboard.</p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="font-display font-bold text-white text-xs">MD</span>
          </div>
          <span className="font-display font-bold text-white">MaKames</span>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-display font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to access your dashboard.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  {...register("email")}
                  type="email"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary text-white placeholder:text-muted-foreground/50 transition-all outline-none"
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="text-destructive text-sm ml-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  {...register("password")}
                  type="password"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary text-white placeholder:text-muted-foreground/50 transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="text-destructive text-sm ml-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:text-white transition-colors font-medium">
              Create one now
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
