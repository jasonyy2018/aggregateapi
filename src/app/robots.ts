import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "https://aapi.togomol.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/api/",
        "/admin/",
        "/claude/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
