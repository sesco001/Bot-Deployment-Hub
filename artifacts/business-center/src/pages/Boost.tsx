import { AppLayout } from "@/components/layout/AppLayout";
import { Heart, Users, Eye, MessageCircle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function Boost() {
  const EXTERNAL_URL = "https://makamescodigitalsolutions.com/signup.php";

  const services = [
    { title: "Likes Boost", icon: Heart, desc: "High-quality likes from real accounts to boost your algorithmic reach.", color: "from-pink-500 to-rose-500" },
    { title: "Followers Boost", icon: Users, desc: "Grow your audience rapidly with targeted follower campaigns.", color: "from-primary to-secondary" },
    { title: "Views Boost", icon: Eye, desc: "Viral velocity for your videos across all major platforms.", color: "from-amber-500 to-orange-500" },
    { title: "Comments Boost", icon: MessageCircle, desc: "Custom relevant comments to increase engagement metrics.", color: "from-emerald-400 to-emerald-600" },
  ];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Boost Services</h1>
        <p className="text-muted-foreground">Supercharge your social media presence across all platforms.</p>
      </div>

      <div className="glass-panel rounded-3xl p-8 mb-8 border border-secondary/20 bg-gradient-to-br from-secondary/10 to-transparent">
        <h2 className="text-2xl font-bold text-white mb-4">The Growth Engine</h2>
        <p className="text-muted-foreground max-w-3xl mb-6">
          Our specialized boost services are handled through our dedicated growth portal. 
          Clicking any service below will securely redirect you to our primary social media marketing panel to configure your campaign.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((svc, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel rounded-3xl p-6 hover:-translate-y-1 transition-transform group flex flex-col"
          >
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${svc.color} flex items-center justify-center mb-6`}>
              <svc.icon className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{svc.title}</h3>
            <p className="text-muted-foreground mb-8 flex-1">{svc.desc}</p>
            
            <a 
              href={EXTERNAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Get Started <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
