import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "OMCITE Arena",
    short_name: "OMCITE",
    description: "Турниры, тренировки, команды и чат сообщества OMCITE.",
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#03070a",
    theme_color: "#03070a",
    icons: [
      { src: "/icons/omcite-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/omcite-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/omcite-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
