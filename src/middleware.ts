// Static export tidak punya server runtime — proteksi route dilakukan
// client-side oleh AuthContext (src/context/AuthContext.tsx).
// File ini tetap ada agar Next.js tidak error, tapi tidak melakukan apapun.
export default function middleware() {}

export const config = { matcher: [] };
