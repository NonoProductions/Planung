import HomeApp from "@/components/app/HomeApp";

// No server-side session lookup here: src/proxy.ts already sends signed-out visitors to
// /login. That keeps this page static, so it comes straight from the CDN on every start
// instead of waiting for a server function.
export default function Home() {
  return <HomeApp />;
}
