export interface BotTypeDefinition {
  id: string;
  name: string;
  description: string;
  costMd: number;
  apiEndpoint: string;
  features: string[];
  isActive: boolean;
}

export const BOT_TYPES: BotTypeDefinition[] = [
  {
    id: "king-md",
    name: "King MD Bot",
    description: "The flagship WhatsApp/Telegram bot with advanced automation, AI replies, and multi-platform support. Perfect for businesses and power users.",
    costMd: 30,
    apiEndpoint: "/api/bots/king-md",
    features: [
      "AI-powered auto replies",
      "Multi-platform support",
      "Group management",
      "Media downloads",
      "Custom commands",
      "Admin controls"
    ],
    isActive: true,
  },
  {
    id: "social-bot",
    name: "Social Media Bot",
    description: "Automate your social media presence with scheduled posts, engagement tools, and analytics across multiple platforms.",
    costMd: 50,
    apiEndpoint: "/api/bots/social-bot",
    features: [
      "Scheduled posting",
      "Auto engagement",
      "Cross-platform support",
      "Analytics dashboard",
      "Hashtag automation",
      "DM automation"
    ],
    isActive: true,
  },
  {
    id: "ecommerce-bot",
    name: "E-Commerce Bot",
    description: "Handle customer inquiries, orders, and payments automatically with this powerful e-commerce automation bot.",
    costMd: 50,
    apiEndpoint: "/api/bots/ecommerce-bot",
    features: [
      "Order management",
      "Payment integration",
      "Inventory alerts",
      "Customer support",
      "Product catalog",
      "Auto invoicing"
    ],
    isActive: true,
  },
  {
    id: "crypto-bot",
    name: "Crypto Trading Bot",
    description: "Monitor cryptocurrency markets and automate trading strategies with this advanced crypto bot.",
    costMd: 50,
    apiEndpoint: "/api/bots/crypto-bot",
    features: [
      "Real-time price alerts",
      "Trading signals",
      "Portfolio tracking",
      "Multi-exchange support",
      "Risk management",
      "PnL reports"
    ],
    isActive: false,
  },
];
