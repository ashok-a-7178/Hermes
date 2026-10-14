"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, Check, CircleAlert, Leaf, LockKeyhole } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function LoginForm() {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    if (registering) {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not create account.");
        setBusy(false);
        return;
      }
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError(registering ? "Account created, but sign-in failed. Please try again." : "Email or password didn't match.");
      setBusy(false);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f5]">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-[#183c31] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="soft-grid absolute inset-0 opacity-40" />
          <div className="absolute -right-28 top-24 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative flex items-center gap-3 text-sm font-semibold tracking-wide">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><Leaf size={20} /></span>
            HERMES WORKSPACE
          </div>
          <div className="relative max-w-xl pb-16">
            <div className="mb-7 flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-emerald-200"><span className="h-px w-8 bg-emerald-200/70" /> Work, in good company</div>
            <h1 className="display-font text-5xl font-semibold leading-[1.1] tracking-[-.04em] xl:text-6xl">Make room for the work that matters.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-emerald-50/75">A thoughtful home for your team’s projects, conversations, and progress.</p>
            <div className="mt-12 flex items-center gap-3 text-sm text-emerald-50/75">
              <div className="flex -space-x-2">{["M", "A", "J", "S"].map((letter, index) => <span key={letter} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-[#183c31] text-xs font-bold text-[#193e32] ${["bg-[#edc7a9]", "bg-[#e3e9c8]", "bg-[#c1d9d0]", "bg-[#e2c8da]"][index]}`}>{letter}</span>)}</div>
              <span>Good teams make great things happen.</span>
            </div>
          </div>
          <div className="relative text-xs text-emerald-100/55">A calmer way to move forward, together.</div>
        </section>
        <section className="flex min-h-screen items-center justify-center px-6 py-12">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }} className="w-full max-w-[410px]">
            <div className="mb-12 flex items-center gap-3 text-sm font-bold tracking-wide text-[#244a3d] lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e5ede6]"><Leaf size={20} /></span> HERMES WORKSPACE</div>
            <div className="mb-9">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf0e9] text-[#345e4d]"><LockKeyhole size={21} /></div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#738079]">{registering ? "A fresh start" : "Welcome back"}</p>
              <h2 className="display-font text-3xl font-bold tracking-[-.035em] text-[#17211f]">{registering ? "Create your account" : "Sign in to your space"}</h2>
              <p className="mt-2 text-sm leading-6 text-[#758078]">Your team’s next great thing is waiting.</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <AnimatePresence initial={false}>
                {registering && <motion.label initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="block overflow-hidden text-sm font-semibold text-[#36443c]">Your name<input name="name" required minLength={2} maxLength={80} autoComplete="name" className="mt-2 h-12 w-full rounded-xl border border-[#e0e5df] bg-white px-4 font-normal outline-none transition focus:border-[#688673] focus:ring-4 focus:ring-[#688673]/10" placeholder="Riley Chen" /></motion.label>}
              </AnimatePresence>
              <label className="block text-sm font-semibold text-[#36443c]">Work email<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-[#e0e5df] bg-white px-4 font-normal outline-none transition focus:border-[#688673] focus:ring-4 focus:ring-[#688673]/10" placeholder="you@company.com" /></label>
              <label className="block text-sm font-semibold text-[#36443c]">Password<input name="password" type="password" required minLength={registering ? 10 : 1} maxLength={128} autoComplete={registering ? "new-password" : "current-password"} className="mt-2 h-12 w-full rounded-xl border border-[#e0e5df] bg-white px-4 font-normal outline-none transition focus:border-[#688673] focus:ring-4 focus:ring-[#688673]/10" placeholder={registering ? "At least 10 characters" : "Enter your password"} /></label>
              {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700"><CircleAlert size={16} />{error}</div>}
              <button disabled={busy} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#244a3d] text-sm font-semibold text-white shadow-lg shadow-[#244a3d]/10 transition hover:bg-[#193d31] disabled:opacity-60">{busy ? "One moment…" : registering ? "Create account" : "Sign in"}{!busy && <ArrowRight size={16} className="transition group-hover:translate-x-1" />}</button>
            </form>
            <button type="button" onClick={() => { setRegistering(!registering); setError(""); }} className="mt-6 w-full text-center text-sm text-[#758078] transition hover:text-[#244a3d]">{registering ? "Already have a workspace? " : "New to Hermes? "}<span className="font-semibold text-[#315c49]">{registering ? "Sign in" : "Create an account"}</span></button>
            <p className="mt-12 flex items-center justify-center gap-1.5 text-xs text-[#99a19a]"><Check size={13} /> Your work belongs to your team.</p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
