export interface Example {
  id: string;
  title: string;
  category: "Restaurant" | "Portfolio" | "Shop" | "Fitness" | "Agency" | "Event";
  prompt: string;
  description: string;
  accent: string;
  sections: string[];
}

export const examples: Example[] = [
  {
    id: "bloom-bakery",
    title: "Bloom Bakery",
    category: "Restaurant",
    prompt: "A cozy neighborhood bakery that sells sourdough, pastries and custom celebration cakes.",
    description: "A warm, photo-led site with a daily menu, opening hours and a cake order inquiry form.",
    accent: "#e07a5f",
    sections: ["Hero", "Menu", "Custom Cakes", "Hours", "Contact"],
  },
  {
    id: "maya-lin-studio",
    title: "Maya Lin Studio",
    category: "Portfolio",
    prompt: "Portfolio for a freelance illustrator who makes children's book art and editorial work.",
    description: "A minimal gallery with case studies, client logos and a commission booking section.",
    accent: "#6d597a",
    sections: ["Hero", "Selected Work", "Case Studies", "About", "Commissions"],
  },
  {
    id: "juniper-goods",
    title: "Juniper Goods",
    category: "Shop",
    prompt: "An online shop selling handmade soy candles and ceramic home goods.",
    description: "A product-first storefront with collections, reviews and a simple checkout flow.",
    accent: "#2a9d8f",
    sections: ["Hero", "Featured Products", "Collections", "Reviews", "Shipping & Returns"],
  },
  {
    id: "ironroot-fitness",
    title: "Ironroot Fitness",
    category: "Fitness",
    prompt: "A strength training gym with small-group classes, personal coaching and a free first week.",
    description: "A high-energy site with class schedule, coach profiles, membership tiers and trial signup.",
    accent: "#e63946",
    sections: ["Hero", "Classes", "Coaches", "Membership", "Free Trial"],
  },
  {
    id: "northlight-creative",
    title: "Northlight Creative",
    category: "Agency",
    prompt: "A boutique branding and web design agency helping startups launch with confidence.",
    description: "A confident agency site with services, selected projects, process and a contact brief form.",
    accent: "#3d5a80",
    sections: ["Hero", "Services", "Projects", "Process", "Testimonials", "Contact"],
  },
  {
    id: "harvest-night-market",
    title: "Harvest Night Market",
    category: "Event",
    prompt: "A fall night market with local food vendors, live music and a lantern parade, tickets on sale now.",
    description: "An event landing page with a countdown, lineup, venue map and ticket purchase.",
    accent: "#f4a261",
    sections: ["Hero", "Lineup", "Schedule", "Venue & Map", "Tickets", "FAQ"],
  },
];
