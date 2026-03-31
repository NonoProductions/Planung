import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Noes Planer",
    short_name: "Planer",
    description: "A calm, focused daily planner for mindful productivity",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4efe8",
    theme_color: "#f4efe8",
    lang: "de-DE",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
