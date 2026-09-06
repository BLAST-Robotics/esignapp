/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.137.1','10.0.0.122','10.0.0.76'],
  experimental: {
    optimizePackageImports: ['react-datepicker', 'react-pdf', 'date-fns-tz'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
