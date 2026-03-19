export interface BotTypeDefinition {
  id: string;
  name: string;
  description: string;
  costMd: number;
  apiEndpoint: string;
  features: string[];
  isActive: boolean;
  envFields?: { key: string; label: string; placeholder: string; required: boolean; isSecret?: boolean; helpLink?: string }[];
}

export const BOT_TYPES: BotTypeDefinition[] = [
  {
    id: "cypher-x",
    name: "Cypher X",
    description: "The most advanced WhatsApp bot — powered by live VPS deployment. Supports AI replies, group management, media tools, and much more. Built for real deployment.",
    costMd: 30,
    apiEndpoint: "/api/bots/cypher-x",
    features: [
      "Live VPS deployment",
      "AI-powered auto replies",
      "Group management & anti-delete",
      "Media downloads & stickers",
      "Custom commands",
      "Multi-owner support"
    ],
    isActive: true,
    envFields: [
      {
        key: "SESSION_ID",
        label: "WhatsApp Session ID",
        placeholder: "Paste your session string here...",
        required: true,
        isSecret: true,
        helpLink: "https://xdigitex.space",
      },
      {
        key: "OWNER_NUMBER",
        label: "Owner Phone Number",
        placeholder: "e.g. 254712345678",
        required: true,
        isSecret: false,
      },
    ],
  },
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
