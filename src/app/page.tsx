import { redirect } from "next/navigation";
import HomeApp from "@/components/app/HomeApp";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <HomeApp />;
}
