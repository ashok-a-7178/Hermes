import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Workspace } from "@/components/workspace";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <Workspace user={{ id: session.user.id, name: session.user.name ?? "Teammate" }} />;
}
