import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // exceljs tiene dependencias transitivas de Node.js (fstream → rimraf) que
    // Turbopack no puede resolver en el bundle SSR de los Client Components.
    // Al marcarlo como externo, Next.js lo requiere en runtime (Node.js) en lugar
    // de intentar bundlearlo, y los dynamic imports en el browser siguen funcionando
    // usando el build de browser que exceljs expone en su campo "browser" del package.json.
    serverExternalPackages: ['exceljs'],
};

export default nextConfig;
