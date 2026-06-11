import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/superadmin/",
          "/admin/",
          "/dashboard/",
          "/team/",
          "/areas/",
          "/audits/",
          "/builder/",
          "/reports/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: "https://servicecontrol.com/sitemap.xml",
  };
}