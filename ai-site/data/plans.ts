export interface Plan {
  id: "starter" | "pro" | "business";
  name: string;
  priceMonthly: number;
  priceYearly: number;
  tagline: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 0,
    priceYearly: 0,
    tagline: "Try Pagewright with a single site, free forever.",
    features: [
      "1 AI-generated site",
      "Pagewright subdomain (yoursite.pagewright.app)",
      "10 AI edits per month",
      "Mobile-friendly templates",
      "Community support",
    ],
    cta: "Start for free",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    priceYearly: 15,
    tagline: "For creators and small businesses ready to go live.",
    features: [
      "5 AI-generated sites",
      "Custom domain with free SSL",
      "Unlimited AI edits",
      "Remove Pagewright branding",
      "Built-in analytics",
      "Priority email support",
    ],
    cta: "Get Pro",
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 49,
    priceYearly: 39,
    tagline: "Collaboration and scale for teams and agencies.",
    features: [
      "Unlimited sites",
      "Up to 10 team members",
      "Brand kit and shared components",
      "Advanced SEO tools",
      "Form submissions and integrations",
      "Dedicated support with 4-hour response",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];
