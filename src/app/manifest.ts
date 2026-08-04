import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Seoneer",
    short_name: "Seoneer",
    description: "Autonomous SEO engineer for GitHub-hosted Next.js projects",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#0f6b5c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
