import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await auth()) redirect("/");
  return <LoginForm />;
}
