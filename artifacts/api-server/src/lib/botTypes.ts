export interface BotTypeDefinition {
  id: string;
  name: string;
  description: string;
  costMd: number;
  deployDays: number;
  apiEndpoint: string;
  features: string[];
  isActive: boolean;
  badge?: string;
  envFields?: { key: string; label: string; placeholder: string; required: boolean; isSecret?: boolean; helpLink?: string }[];
}

export const DEPLOY_DAYS = 36;

export const BOT_TYPES: BotTypeDefinition[] = [
  {
    id: "cypher-x",
    name: "Cypher X",
    description: "The most advanced WhatsApp bot — powered by live VPS deployment. Supports AI replies, group management, media tools, and much more.",
    costMd: 30,
    deployDays: DEPLOY_DAYS,
    apiEndpoint: "/api/bots/cypher-x",
    badge: "Live VPS",
    features: [
      "Live VPS deployment — 36 days nonstop",
      "AI-powered auto replies",
      "Group management & anti-delete",
      "Media downloads & stickers",
      "Custom commands",
      "Multi-owner support",
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
      },
    ],
  },
  {
    id: "king-md",
    name: "King MD Bot",
    description: "Specialized WhatsApp MD bot with country code support. Advanced automation, AI replies, and rock-solid group management for power users.",
    costMd: 30,
    deployDays: DEPLOY_DAYS,
    apiEndpoint: "/api/bots/king-md",
    badge: "Live VPS",
    features: [
      "Live VPS deployment — 36 days nonstop",
      "AI-powered auto replies",
      "Country code support",
      "Group management",
      "Media downloads",
      "Admin controls",
    ],
    isActive: true,
    envFields: [
      {
        key: "OWNER_NUMBER",
        label: "Owner Phone Number (with country code)",
        placeholder: "e.g. 254712345678",
        required: true,
      },
      {
        key: "SESSION_ID",
        label: "King MD Session String",
        placeholder: "KING_SESSION_HERE",
        required: true,
        isSecret: true,
      },
      {
        key: "COUNTRY_CODE",
        label: "Country Code",
        placeholder: "e.g. 254",
        required: true,
      },
    ],
  },
  {
    id: "bwm-xmd-go",
    name: "BWM-XMD-GO",
    description: "High-performance Go-based WhatsApp bot with blazing fast container deployment. Built for reliability and speed on dedicated infrastructure.",
    costMd: 50,
    deployDays: DEPLOY_DAYS,
    apiEndpoint: "/api/bots/bwm-xmd-go",
    badge: "Live VPS",
    features: [
      "Live VPS deployment — 36 days nonstop",
      "Go-powered high performance",
      "Real-time log streaming",
      "Auto media handling",
      "Group & sticker tools",
      "Fast boot time",
    ],
    isActive: true,
    envFields: [
      {
        key: "OWNER_NUMBER",
        label: "Owner Phone Number",
        placeholder: "e.g. 254710000000",
        required: true,
      },
      {
        key: "SESSION_ID",
        label: "BWM Session ID",
        placeholder: "BWM_SESSION_HERE",
        required: true,
        isSecret: true,
      },
    ],
  },
  {
    id: "atassa-cloud",
    name: "Atassa Cloud",
    description: "Secure cloud-hosted WhatsApp bot with automated port allocation and encrypted deployment. Ideal for group admins and business automation.",
    costMd: 50,
    deployDays: DEPLOY_DAYS,
    apiEndpoint: "/api/bots/atassa-cloud",
    badge: "Live VPS",
    features: [
      "Live VPS deployment — 36 days nonstop",
      "Auto port allocation",
      "Encrypted secure containers",
      "Live console log streaming",
      "Group automation",
      "Always-on uptime",
    ],
    isActive: true,
    envFields: [
      {
        key: "SESSION_ID",
        label: "Atassa Session ID",
        placeholder: "Atassa~...",
        required: true,
        isSecret: true,
      },
    ],
  },
];
