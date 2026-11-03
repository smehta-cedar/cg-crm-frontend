import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets other devices on the LAN load dev assets via the Network URL.
  // These are DHCP-assigned IPs, so update them if the block warnings show new ones.
  allowedDevOrigins: ["192.168.1.134", "192.168.4.177"],
  experimental: {
    // PDFs go through server actions: a certification's (up to 10 MB), and a
    // sale's, one per product (up to 4 MB each, eight at most). The API
    // rejects a bigger file with a proper field error, so leave room above it.
    serverActions: { bodySizeLimit: "40mb" },
    proxyClientMaxBodySize: "40mb",
  },
};

export default nextConfig;
