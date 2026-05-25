/**
 * Public-facing route paths used across the app.
 */
export const ROUTES = {
  home: "/",
  directory: "/directory",
  merchantDashboard: (handle: string) => `/m/${handle}`,
  merchants: "/merchants",
  dashboard: "/dashboard",
  admin: "/admin",
  login: "/login",
  register: "/register",
  kontak: "/p/kontak",
  privasi: "/p/privasi",
  syarat: "/p/syarat",
  tentang: "/p/tentang",
} as const;
