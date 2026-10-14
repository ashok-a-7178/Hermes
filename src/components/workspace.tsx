"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowUpRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, CircleAlert,
  CircleHelp, Clock3, Command, Filter, Flag, Hash, LayoutDashboard, Leaf, ListTodo, LogOut, MessageCircle,
  Plus, Search, Send,
  Sparkles, Target, Users, X, Zap,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";

type Project = { id: string; name: string; description: string; color: string; _count?: { workItems: number; members: number } };
type Person = { id: string; name: string; email: string };
type WorkItem = {
  id: string; title: string; description: string; type: "TASK" | "BUG"; status: string;
  priority: string; dueDate: string | null; createdAt: string; updatedAt: string; assigneeId?: string | null;
  assignee: Person | null;
};
type Goal = { id: string; title: string; details: string; month: string; complete: boolean };
type Message = { id: string; body: string; createdAt: string; author: { id: string; name: string } };
type Summary = {
  project: { id: string; name: string; description: string; color: string };
  counts: Record<string, number>;
  overdue: number;
  contributors: { userId: string | null; name: string; count: number }[];
  activities: { id: string; action: string; detail: string; createdAt: string; actor: { name: string } | null; workItem: { title: string } | null }[];
  goals: Goal[];
};
type SearchHit = { type: string; id: string; title: string; excerpt: string; score: number; createdAt: string };
type Tab = "overview" | "work" | "timeline" | "chat" | "goals" | "search";

const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "work", label: "Tasks & bugs", icon: ListTodo },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "chat", label: "Team chat", icon: MessageCircle },
  { id: "goals", label: "Monthly goals", icon: Target },
  { id: "search", label: "Ask your project", icon: Sparkles },
];
const statusNames: Record<string, string> = { BACKLOG: "Backlog", TODO: "To do", IN_PROGRESS: "In progress", IN_REVIEW: "In review", DONE: "Done" };
const priorityStyle: Record<string, string> = { URGENT: "bg-rose-50 text-rose-700", HIGH: "bg-amber-50 text-amber-700", MEDIUM: "bg-blue-50 text-blue-700", LOW: "bg-slate-100 text-slate-600" };
const avatarColors = ["bg-[#dbe9df] text-[#3b6650]", "bg-[#f5e5d8] text-[#9b603a]", "bg-[#e9e2f2] text-[#715a91]", "bg-[#e4e9c9] text-[#6b733b]"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body as T;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}
function relativeDate(value: string) {
  const day = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (day < 0) return `${Math.abs(day)}d overdue`;
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow";
  return `In ${day} days`;
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function monthValue(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

export function Workspace({ user }: { user: { id: string; name: string } }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [members, setMembers] = useState<Person[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"task" | "goal" | "project" | "member" | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  const loadProjects = useCallback(async () => {
    const next = await api<Project[]>("/api/projects");
    setProjects(next);
    setProjectId((selected) => next.some((project) => project.id === selected) ? selected : next[0]?.id ?? "");
  }, []);

  useEffect(() => {
    loadProjects().catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }, [loadProjects]);

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setSummary(null); setItems([]); setGoals([]); setMessages([]);
      return;
    }
    try {
      const [nextSummary, work, nextGoals, nextMessages] = await Promise.all([
        api<Summary>(`/api/projects/${projectId}/summary`),
        api<{ items: WorkItem[]; members: Person[] }>(`/api/projects/${projectId}/tasks`),
        api<Goal[]>(`/api/projects/${projectId}/goals`),
        api<Message[]>(`/api/projects/${projectId}/chat`),
      ]);
      setSummary(nextSummary); setItems(work.items); setMembers(work.members); setGoals(nextGoals); setMessages(nextMessages);
      setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => {
    if (tab !== "chat" || !projectId) return;
    const timer = window.setInterval(() => {
      api<Message[]>(`/api/projects/${projectId}/chat`).then(setMessages).catch((cause: Error) => setError(cause.message));
    }, 6000);
    return () => window.clearInterval(timer);
  }, [tab, projectId]);
  useEffect(() => {
    if (tab !== "search" || query.trim().length < 2 || !projectId) { setHits([]); return; }
    const timer = window.setTimeout(() => {
      api<SearchHit[]>(`/api/projects/${projectId}/search?q=${encodeURIComponent(query)}`)
        .then(setHits).catch((cause: Error) => setError(cause.message));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, projectId, tab]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await api<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name: form.get("name"), description: form.get("description") }) });
      setProjects((current) => [created, ...current]); setProjectId(created.id); setModal(null);
    } catch (cause) { setError((cause as Error).message); }
  }
  async function createWorkItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    const form = new FormData(event.currentTarget);
    const due = String(form.get("dueDate") ?? "");
    try {
      await api(`/api/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({
        title: form.get("title"), description: form.get("description"), type: form.get("type"), priority: form.get("priority"),
        assigneeId: form.get("assigneeId") || null, dueDate: due ? new Date(`${due}T12:00:00`).toISOString() : null,
      }) });
      setModal(null); await loadProject();
    } catch (cause) { setError((cause as Error).message); }
  }
  async function updateItem(itemId: string, update: Partial<WorkItem>) {
    if (!projectId) return;
    try {
      await api(`/api/projects/${projectId}/tasks/${itemId}`, { method: "PATCH", body: JSON.stringify(update) });
      await loadProject();
    } catch (cause) { setError((cause as Error).message); }
  }
  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/projects/${projectId}/goals`, { method: "POST", body: JSON.stringify({ title: form.get("title"), details: form.get("details"), month: form.get("month") }) });
      setModal(null); await loadProject();
    } catch (cause) { setError((cause as Error).message); }
  }
  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/projects/${projectId}/members`, { method: "POST", body: JSON.stringify({ email: form.get("email") }) });
      setModal(null); await loadProject();
    } catch (cause) { setError((cause as Error).message); }
  }
  async function toggleGoal(goal: Goal) {
    if (!projectId) return;
    try {
      await api(`/api/projects/${projectId}/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ complete: !goal.complete }) });
      await loadProject();
    } catch (cause) { setError((cause as Error).message); }
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !chatDraft.trim()) return;
    const body = chatDraft.trim();
    setChatDraft("");
    try {
      const message = await api<Message>(`/api/projects/${projectId}/chat`, { method: "POST", body: JSON.stringify({ body }) });
      setMessages((current) => [...current, message]);
    } catch (cause) { setChatDraft(body); setError((cause as Error).message); }
  }

  const project = projects.find((item) => item.id === projectId);
  const pageTitle = tabs.find((item) => item.id === tab)?.label ?? "Overview";
  const filteredItems = useMemo(() => filter === "ALL" ? items : items.filter((item) => item.status === filter), [items, filter]);

  return (
    <div className="min-h-screen bg-[#f6f7f4]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#e8ebe6] bg-[#fbfcfa] xl:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-[#eef0eb] px-6">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#244a3d] text-white"><Leaf size={18} /></span>
          <span className="display-font text-[15px] font-extrabold tracking-[.08em] text-[#1c3129]">HERMES<span className="ml-1 font-medium tracking-normal text-[#8b978d]">/ work</span></span>
        </div>
        <div className="px-4 pt-6">
          <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#a0a9a0]">Your workspace <ChevronDown size={12} /></div>
          {projects.length ? <div className="relative">
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#e8ece6] bg-white pl-3 pr-9 text-sm font-semibold text-[#35473c] outline-none focus:border-[#90a495]">
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-[#89958b]" />
          </div> : <button onClick={() => setModal("project")} className="flex h-11 w-full items-center gap-2 rounded-xl border border-dashed border-[#cbd5ca] px-3 text-sm font-medium text-[#47634f]"><Plus size={15} />Create a project</button>}
        </div>
        <div className="px-4 pt-8">
          <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#a0a9a0]">Project space</div>
          <nav className="space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${tab === id ? "bg-[#eaf0e9] text-[#28513f]" : "text-[#737f76] hover:bg-[#f2f4f0] hover:text-[#34443a]"}`}><Icon size={17} strokeWidth={1.8} />{label}{id === "search" && <Command size={12} className="ml-auto opacity-50" />}{id === "chat" && messages.length > 0 && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#6b9877]" />}</button>)}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="mb-3 rounded-2xl border border-[#e9eee7] bg-[#f4f7f2] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#344b3e]"><Sparkles size={14} /> A little more clarity</div>
            <p className="text-[11px] leading-[1.6] text-[#758278]">Keep tasks moving and your team in the loop. The overview updates as your work changes.</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-[#748077] transition hover:bg-[#f3f4f1]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e5e9e3] text-[10px] font-bold text-[#48604e]">{initials(user.name)}</span><span className="min-w-0 flex-1 truncate">{user.name}</span><LogOut size={15} /></button>
        </div>
      </aside>

      <div className="xl:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e9ece7] bg-[#fbfcfa]/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[#99a29b]"><span className="hidden sm:inline">Workspace</span><ChevronRight size={13} className="hidden sm:inline" /><span className="truncate font-semibold text-[#425348]">{project?.name ?? "Your projects"}</span><ChevronRight size={13} /><span className="font-medium text-[#768078]">{pageTitle}</span></div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setTab("search")} className="flex h-9 items-center gap-2 rounded-xl border border-[#e8ebe7] bg-white px-3 text-xs text-[#849087] transition hover:border-[#c5d2c5]"><Search size={14} /><span className="hidden sm:inline">Search anything</span><kbd className="hidden rounded border border-[#e7eae5] bg-[#fafbf9] px-1 py-0.5 text-[10px] sm:inline">⌘ K</kbd></button>
            <button aria-label="Notifications" onClick={() => setTab("overview")} className="relative grid h-9 w-9 place-items-center rounded-xl border border-[#e8ebe7] bg-white text-[#68776c]"><Bell size={16} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#d28c62]" /></button>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#dce9dd] text-[10px] font-bold text-[#3d694f] xl:hidden">{initials(user.name)}</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-10">
          <AnimatePresence>{error && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"><CircleAlert size={16} />{error}<button onClick={() => setError("")} className="ml-auto"><X size={16} /></button></motion.div>}</AnimatePresence>
          {loading ? <PageSkeleton /> : !projects.length ? <EmptyProjects onCreate={() => setModal("project")} /> : !summary ? <PageSkeleton /> :
            <>
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
                {tab === "overview" && <Overview summary={summary} items={items} onNavigate={setTab} />}
                {tab === "work" && <WorkView items={filteredItems} allCount={items.length} filter={filter} setFilter={setFilter} members={members} onAdd={() => setModal("task")} onInvite={() => setModal("member")} onUpdate={updateItem} />}
                {tab === "timeline" && <Timeline items={items} />}
                {tab === "chat" && <Chat messages={messages} userId={user.id} draft={chatDraft} setDraft={setChatDraft} onSend={sendMessage} />}
                {tab === "goals" && <Goals goals={goals} onAdd={() => setModal("goal")} onToggle={toggleGoal} />}
                {tab === "search" && <SearchView query={query} setQuery={setQuery} hits={hits} />}
              </motion.div>
            </>
          }
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-[#e7ebe5] bg-[#fbfcfa]/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl xl:hidden">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-1.5 text-[9px] font-medium ${tab === id ? "text-[#315d49]" : "text-[#879188]"}`}><Icon size={18} strokeWidth={1.9} />{label.split(" ")[0]}</button>)}
      </nav>

      <AnimatePresence>
        {modal && <Modal title={modal === "task" ? "Add to the board" : modal === "goal" ? "Set a monthly goal" : modal === "member" ? "Bring someone in" : "Start a project"} onClose={() => setModal(null)}>
          {modal === "task" && <form onSubmit={createWorkItem} className="space-y-4">
            <label className="block text-xs font-semibold text-[#526056]">What needs doing?<input name="title" required minLength={2} maxLength={160} autoFocus placeholder="e.g. Review the onboarding flow" className="form-input" /></label>
            <label className="block text-xs font-semibold text-[#526056]">A few more details<textarea name="description" rows={3} maxLength={4000} placeholder="Add context for your teammates…" className="form-input h-auto py-3" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-[#526056]">Type<select name="type" className="form-input"><option value="TASK">Task</option><option value="BUG">Bug</option></select></label>
              <label className="block text-xs font-semibold text-[#526056]">Priority<select name="priority" className="form-input"><option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
              <label className="block text-xs font-semibold text-[#526056]">Assignee<select name="assigneeId" className="form-input"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              <label className="block text-xs font-semibold text-[#526056]">Due date<input type="date" name="dueDate" className="form-input" /></label>
            </div><ModalActions onCancel={() => setModal(null)} submit="Create work item" />
          </form>}
          {modal === "goal" && <form onSubmit={createGoal} className="space-y-4">
            <label className="block text-xs font-semibold text-[#526056]">What are we aiming for?<input name="title" required minLength={2} maxLength={160} autoFocus placeholder="e.g. Ship the new team workspace" className="form-input" /></label>
            <label className="block text-xs font-semibold text-[#526056]">How will we get there?<textarea name="details" rows={3} maxLength={2000} placeholder="Add a little context…" className="form-input h-auto py-3" /></label>
            <label className="block text-xs font-semibold text-[#526056]">Month<input type="month" name="month" defaultValue={monthValue()} required className="form-input" /></label>
            <ModalActions onCancel={() => setModal(null)} submit="Save goal" />
          </form>}
          {modal === "project" && <form onSubmit={createProject} className="space-y-4">
            <label className="block text-xs font-semibold text-[#526056]">Project name<input name="name" required minLength={2} maxLength={80} autoFocus placeholder="e.g. Website refresh" className="form-input" /></label>
            <label className="block text-xs font-semibold text-[#526056]">What’s it about?<textarea name="description" rows={3} maxLength={500} placeholder="Give your team a little context…" className="form-input h-auto py-3" /></label>
            <ModalActions onCancel={() => setModal(null)} submit="Create project" />
          </form>}
          {modal === "member" && <form onSubmit={inviteMember} className="space-y-4">
            <p className="text-xs leading-5 text-[#7d897f]">Add a teammate who already has a Hermes account. They’ll be able to see this project, its tasks, and the team conversation.</p>
            <label className="block text-xs font-semibold text-[#526056]">Teammate’s email<input name="email" type="email" required autoFocus placeholder="teammate@company.com" className="form-input" /></label>
            <ModalActions onCancel={() => setModal(null)} submit="Add teammate" />
          </form>}
        </Modal>}
      </AnimatePresence>
    </div>
  );
}

function PageSkeleton() {
  return <div className="space-y-6"><div className="skeleton h-8 w-64 rounded-lg" /><div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="skeleton h-32 rounded-2xl" />)}</div><div className="grid gap-4 lg:grid-cols-3"><div className="skeleton h-72 rounded-2xl lg:col-span-2" /><div className="skeleton h-72 rounded-2xl" /></div></div>;
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center"><span className="mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-[#e7efe7] text-[#4c7458]"><Leaf size={27} /></span><h1 className="display-font text-2xl font-bold tracking-tight">A good project starts here.</h1><p className="mt-2 text-sm leading-6 text-[#7b877e]">Create your first shared space for the work, ideas, and people that make it happen.</p><button onClick={onCreate} className="mt-6 flex items-center gap-2 rounded-xl bg-[#244a3d] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />Create your first project</button></div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#819184]">{eyebrow}</div><h1 className="display-font text-2xl font-bold tracking-[-.04em] text-[#20312a] sm:text-[28px]">{title}</h1>{description && <p className="mt-1.5 text-sm text-[#849087]">{description}</p>}</div>{action}</div>;
}

function Overview({ summary, items, onNavigate }: { summary: Summary; items: WorkItem[]; onNavigate: (tab: Tab) => void }) {
  const total = items.length;
  const done = summary.counts.DONE ?? 0;
  const open = total - done;
  const topGoal = summary.goals[0];
  return <div>
    <SectionHeading eyebrow="Your project, at a glance" title={`Good morning, ${summary.project.name}`} description="A clear view of what’s moving, what needs a hand, and what’s next." action={<button onClick={() => onNavigate("work")} className="flex items-center gap-2 rounded-xl bg-[#244a3d] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#244a3d]/10 transition hover:bg-[#193d31]"><Plus size={15} />New work item</button>} />
    <div className="relative mb-5 overflow-hidden rounded-[22px] bg-[#244a3d] p-6 text-white shadow-panel sm:p-8">
      <div className="soft-grid absolute inset-0 opacity-20" /><div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#98b89e]/15 blur-2xl" />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-lg"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.19em] text-[#c2d4c3]"><span className="h-1.5 w-1.5 rounded-full bg-[#a5cca5]" />Project pulse</div><h2 className="display-font text-[25px] font-semibold leading-tight tracking-[-.035em] sm:text-[30px]">{summary.project.description || "Every small step adds up."}</h2><p className="mt-2.5 text-xs text-[#d6e1d6]/70">{summary.project.name} <span className="mx-1">·</span> Updated just now</p></div>
        <div className="flex min-w-[215px] flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[.08] p-4 backdrop-blur">
          <div className="flex items-center justify-between text-xs"><span className="text-[#d7e4d8]/80">Project progress</span><span className="font-semibold">{total ? `${Math.round(done / total * 100)}%` : "—"}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20"><motion.div initial={{ width: 0 }} animate={{ width: `${total ? done / total * 100 : 0}%` }} transition={{ duration: .8 }} className="h-full rounded-full bg-[#b9d3b8]" /></div>
          <div className="flex items-center justify-between text-[10px] text-[#d7e4d8]/65"><span>{done} done</span><span>{open} still in motion</span></div>
        </div>
      </div>
    </div>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="In motion" value={summary.counts.IN_PROGRESS ?? 0} detail="Being worked on now" icon={Zap} tint="green" />
      <StatCard label="Ready for review" value={summary.counts.IN_REVIEW ?? 0} detail="A fresh pair of eyes" icon={CheckCheck} tint="blue" />
      <StatCard label="Needs a nudge" value={summary.overdue} detail="Past their due date" icon={Clock3} tint={summary.overdue ? "rose" : "sand"} />
      <StatCard label="On the board" value={total} detail={`${summary.counts.DONE ?? 0} wrapped up`} icon={ListTodo} tint="lilac" />
    </div>
    <div className="grid gap-5 lg:grid-cols-[1.35fr_.85fr]">
      <section className="rounded-[20px] border border-[#e9ece7] bg-white p-5 shadow-panel sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="display-font text-[15px] font-bold text-[#26382e]">Recent activity</h2><p className="mt-1 text-[11px] text-[#929b92]">Little signs of progress</p></div><button onClick={() => onNavigate("timeline")} className="flex items-center gap-1 text-[11px] font-semibold text-[#527460] hover:text-[#244a3d]">See timeline<ArrowUpRight size={13} /></button></div>
        <div className="space-y-4">{summary.activities.length ? summary.activities.slice(0, 5).map((event, index) => <div key={event.id} className="flex items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${avatarColors[index % avatarColors.length]}`}>{event.actor ? initials(event.actor.name) : <Activity size={14} />}</span><div className="min-w-0 flex-1"><p className="text-xs leading-5 text-[#5d6a60]"><span className="font-semibold text-[#34473b]">{event.actor?.name ?? "Someone"}</span> {event.action}{event.workItem && <> <span className="font-semibold text-[#34473b]">{event.workItem.title}</span></>}</p><p className="mt-0.5 text-[10px] text-[#9aa39b]">{formatDate(event.createdAt)}{event.detail && ` · ${event.detail}`}</p></div></div>) : <EmptyHint text="Your team’s activity will show up here." />}</div>
      </section>
      <section className="rounded-[20px] border border-[#e9ece7] bg-white p-5 shadow-panel sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="display-font text-[15px] font-bold text-[#26382e]">A little focus</h2><p className="mt-1 text-[11px] text-[#929b92]">The goal you’re working toward</p></div><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f2f4e8] text-[#8c864a]"><Target size={16} /></span></div>
        {topGoal ? <div className="rounded-2xl bg-[#f7f8f2] p-4"><div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.15em] text-[#8a8a64]"><Flag size={12} />{new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(topGoal.month))}</div><h3 className="text-sm font-semibold text-[#33453a]">{topGoal.title}</h3><p className="mt-1.5 text-xs leading-5 text-[#7e887e]">{topGoal.details || "A goal the team is working on together."}</p><button onClick={() => onNavigate("goals")} className="mt-4 text-[11px] font-semibold text-[#527460]">View all goals →</button></div> : <EmptyHint text="Add a monthly goal to give your team a shared direction." action={<button onClick={() => onNavigate("goals")} className="mt-3 text-[11px] font-semibold text-[#527460]">Set a goal →</button>} />}
        <div className="mt-5 border-t border-[#eff1ec] pt-4"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-semibold text-[#67756a]">Who’s been active</span><span className="flex items-center gap-1 text-[10px] text-[#9aa29a]"><Users size={12} />this month</span></div>{summary.contributors.length ? summary.contributors.slice(0, 3).map((person, index) => <div key={person.userId ?? index} className="mb-2.5 flex items-center gap-2.5"><span className={`grid h-7 w-7 place-items-center rounded-full text-[8px] font-bold ${avatarColors[index % avatarColors.length]}`}>{initials(person.name)}</span><span className="flex-1 text-[11px] font-medium text-[#526056]">{person.name}</span><span className="text-[10px] text-[#8e998f]">{person.count} updates</span></div>) : <p className="text-[11px] text-[#99a199]">Work gets recorded here as it moves.</p>}</div>
      </section>
      <section className="rounded-[20px] border border-[#e9ece7] bg-white p-5 shadow-panel lg:col-span-2 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="display-font text-[15px] font-bold text-[#26382e]">Up next</h2><p className="mt-1 text-[11px] text-[#929b92]">A few things worth keeping in view</p></div><button onClick={() => onNavigate("work")} className="text-[11px] font-semibold text-[#527460]">Open board →</button></div>
        {items.filter((item) => item.status !== "DONE").slice(0, 4).length ? <div className="grid gap-2 md:grid-cols-2">{items.filter((item) => item.status !== "DONE").slice(0, 4).map((item) => <WorkCard key={item.id} item={item} compact />)}</div> : <EmptyHint text="Nothing waiting—nice work. Create a task whenever something new comes up." />}
      </section>
    </div>
  </div>;
}

function StatCard({ label, value, detail, icon: Icon, tint }: { label: string; value: number; detail: string; icon: typeof Zap; tint: string }) {
  const colors: Record<string, string> = { green: "bg-[#e7f0e8] text-[#4d7959]", blue: "bg-[#e9eff7] text-[#647d9a]", rose: "bg-[#fae9e5] text-[#ad6d5b]", sand: "bg-[#f3efe1] text-[#9a8651]", lilac: "bg-[#eee9f5] text-[#76698d]" };
  return <div className="rounded-[18px] border border-[#e9ece7] bg-white p-4 shadow-panel sm:p-5"><div className="mb-4 flex items-center justify-between"><span className="text-[10px] font-semibold text-[#879187] sm:text-[11px]">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-xl ${colors[tint]}`}><Icon size={15} /></span></div><div className="display-font text-[28px] font-bold tracking-[-.05em] text-[#293d32]">{value}</div><div className="mt-1 text-[10px] text-[#9ba49a]">{detail}</div></div>;
}

function WorkView({ items, allCount, filter, setFilter, members, onAdd, onInvite, onUpdate }: { items: WorkItem[]; allCount: number; filter: string; setFilter: (value: string) => void; members: Person[]; onAdd: () => void; onInvite: () => void; onUpdate: (id: string, update: Partial<WorkItem>) => void }) {
  const filterOptions = ["ALL", "BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  return <div>
    <SectionHeading eyebrow="Keep the good work moving" title="Tasks & bugs" description={`${allCount} things on the board, big and small.`} action={<div className="flex gap-2"><button onClick={onInvite} className="flex items-center gap-2 rounded-xl border border-[#dfe6dd] bg-white px-3 py-2.5 text-xs font-semibold text-[#55705a]"><Users size={14} />Invite teammate</button><button onClick={onAdd} className="flex items-center gap-2 rounded-xl bg-[#244a3d] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15} />Add work item</button></div>} />
    <div className="mb-5 flex flex-wrap items-center gap-2">{filterOptions.map((option) => <button key={option} onClick={() => setFilter(option)} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${filter === option ? "bg-[#315b48] text-white" : "border border-[#e7ebe5] bg-white text-[#758178] hover:border-[#b7c8b8]"}`}>{option === "ALL" ? `Everything · ${allCount}` : statusNames[option]}</button>)}<span className="ml-auto hidden items-center gap-1.5 text-[10px] text-[#97a098] sm:flex"><Filter size={12} />Sorted by due date</span></div>
    {items.length ? <div className="grid gap-3 xl:grid-cols-2">{items.map((item) => <WorkCard key={item.id} item={item} members={members} onUpdate={onUpdate} />)}</div> : <div className="rounded-2xl border border-dashed border-[#d9e0d8] bg-white py-16 text-center"><ListTodo size={26} className="mx-auto text-[#93a492]" /><p className="mt-3 text-sm font-semibold text-[#526056]">Nothing in this view just yet.</p><p className="mt-1 text-xs text-[#929c93]">Add a task or choose another status filter.</p><button onClick={onAdd} className="mt-4 text-xs font-semibold text-[#527460]">Create a work item →</button></div>}
  </div>;
}

function WorkCard({ item, compact, members, onUpdate }: { item: WorkItem; compact?: boolean; members?: Person[]; onUpdate?: (id: string, update: Partial<WorkItem>) => void }) {
  const bug = item.type === "BUG";
  const due = item.dueDate ? new Date(item.dueDate) : null;
  const isLate = due && due.getTime() < Date.now() && item.status !== "DONE";
  return <article className={`group rounded-[17px] border border-[#e9ece7] bg-white shadow-panel transition hover:border-[#d2ddd1] ${compact ? "p-4" : "p-4 sm:p-5"}`}>
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${bug ? "bg-[#faeae5] text-[#b86650]" : "bg-[#eaf0e9] text-[#53775c]"}`}>{bug ? <CircleAlert size={15} /> : <ListTodo size={15} />}</span>
      <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-1.5"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#9aa39a]">{bug ? "Bug" : "Task"}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${priorityStyle[item.priority]}`}>{item.priority.toLowerCase()}</span></div><h3 className="text-[13px] font-semibold leading-5 text-[#314238]">{item.title}</h3>{!compact && item.description && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#879187]">{item.description}</p>}</div>
      <select aria-label="Update status" value={item.status} onChange={(event) => onUpdate?.(item.id, { status: event.target.value })} className="max-w-[112px] rounded-lg border border-[#edf0eb] bg-[#fbfcfa] px-2 py-1.5 text-[9px] font-semibold text-[#6c7b6f] outline-none focus:border-[#aabca9]">{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-[#f0f2ee] pt-3">
      <div className="flex items-center gap-2.5">{members && onUpdate ? <select aria-label={`Assignee for ${item.title}`} value={item.assignee?.id ?? ""} onChange={(event) => onUpdate(item.id, { assigneeId: event.target.value || null })} className="max-w-[140px] rounded-full bg-[#f5f7f3] px-2.5 py-1.5 text-[9px] font-medium text-[#69766b] outline-none"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select> : item.assignee ? <div className="flex items-center gap-1.5"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#e5ede5] text-[8px] font-bold text-[#527159]">{initials(item.assignee.name)}</span><span className="text-[10px] text-[#758077]">{item.assignee.name}</span></div> : <span className="text-[10px] text-[#a0a89f]">Unassigned</span>}
      </div>
      {due ? <span className={`flex items-center gap-1 text-[10px] ${isLate ? "font-semibold text-rose-600" : "text-[#929b92]"}`}><CalendarDays size={12} />{compact ? formatDate(item.dueDate!) : relativeDate(item.dueDate!)}</span> : <span className="text-[10px] text-[#a0a89f]">No due date</span>}
    </div>
  </article>;
}

function Timeline({ items }: { items: WorkItem[] }) {
  const sorted = [...items].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  return <div><SectionHeading eyebrow="A steady pace" title="Project timeline" description="See what’s coming up and how the work is flowing." />
    <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
      <section className="rounded-[20px] border border-[#e9ece7] bg-white p-5 shadow-panel sm:p-6"><h2 className="display-font text-sm font-bold text-[#34463a]">Milestone snapshot</h2><p className="mt-1 text-[11px] text-[#98a098]">Progress across the project</p><div className="mt-6 space-y-5">{Object.entries(statusNames).map(([key, label], index) => {
        const count = items.filter((item) => item.status === key).length; const percent = items.length ? count / items.length * 100 : 0;
        return <div key={key}><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-[#69766d]">{label}</span><span className="font-semibold text-[#596a5e]">{count}</span></div><div className="h-1.5 rounded-full bg-[#eff2ed]"><div style={{ width: `${percent}%` }} className={`h-full rounded-full ${["bg-[#b9c3b5]", "bg-[#9eaf9a]", "bg-[#6f9679]", "bg-[#9daec0]", "bg-[#4e795b]"][index]}`} /></div></div>;
      })}</div></section>
      <section className="rounded-[20px] border border-[#e9ece7] bg-white p-5 shadow-panel sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="display-font text-sm font-bold text-[#34463a]">The road ahead</h2><p className="mt-1 text-[11px] text-[#98a098]">Ordered by due date</p></div><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f3f5ef] text-[#708172]"><CalendarDays size={15} /></span></div>
        {sorted.length ? <div className="relative space-y-0 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-[#e6ebe4]">{sorted.map((item) => <div key={item.id} className="relative flex gap-4 pb-5 last:pb-0"><span className={`relative z-10 mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full ring-4 ring-white ${item.status === "DONE" ? "bg-[#6e9775]" : item.type === "BUG" ? "bg-[#cf896f]" : "bg-[#a4b39f]"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-[#38493e]">{item.title}</h3><span className="text-[10px] text-[#8b968d]">{item.dueDate ? formatDate(item.dueDate) : "No date"}</span></div><div className="mt-1 flex items-center gap-2 text-[10px] text-[#929b92]"><span>{statusNames[item.status]}</span><span>·</span><span>{item.assignee?.name ?? "Unassigned"}</span></div></div></div> )}</div> : <EmptyHint text="Add due dates to work items to shape the timeline." />}
      </section>
    </div>
  </div>;
}

function Chat({ messages, userId, draft, setDraft, onSend }: { messages: Message[]; userId: string; draft: string; setDraft: (value: string) => void; onSend: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div><SectionHeading eyebrow="Better, together" title="Team chat" description="A shared conversation for the project, right alongside the work." />
    <section className="mx-auto flex h-[min(68vh,720px)] max-w-[900px] flex-col overflow-hidden rounded-[22px] border border-[#e7ece6] bg-white shadow-panel">
      <div className="flex items-center gap-3 border-b border-[#edf0ec] px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9f0e9] text-[#52735a]"><Hash size={17} /></span><div className="flex-1"><h2 className="text-sm font-semibold text-[#34463a]">Project room</h2><p className="mt-0.5 text-[10px] text-[#9aa39a]">Team conversation · updates every few seconds</p></div><span className="flex items-center gap-1.5 text-[10px] text-[#66866c]"><span className="h-1.5 w-1.5 rounded-full bg-[#76a37c]" />Here together</span></div>
      <div className="scrollbar-hide flex-1 space-y-4 overflow-y-auto bg-[#fbfcfa] p-5">{messages.length ? messages.map((message, index) => <div key={message.id} className={`flex gap-2.5 ${message.author.id === userId ? "flex-row-reverse" : ""}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${avatarColors[index % avatarColors.length]}`}>{initials(message.author.name)}</span><div className={`max-w-[78%] ${message.author.id === userId ? "text-right" : ""}`}><div className={`mb-1 flex items-center gap-2 text-[9px] text-[#9aa39a] ${message.author.id === userId ? "flex-row-reverse" : ""}`}><span className="font-semibold text-[#67746a]">{message.author.id === userId ? "You" : message.author.name}</span><span>{new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt))}</span></div><p className={`rounded-2xl px-3.5 py-2.5 text-left text-xs leading-5 ${message.author.id === userId ? "rounded-tr-sm bg-[#e7efe8] text-[#35513e]" : "rounded-tl-sm border border-[#edf0ec] bg-white text-[#526056]"}`}>{message.body}</p></div></div>) : <div className="grid h-full place-items-center"><EmptyHint text="Say hello, share a win, or ask your team a question." /></div>}</div>
      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-[#edf0ec] bg-white p-3 sm:p-4"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder="Write a message to your team…" className="h-11 min-w-0 flex-1 rounded-xl border border-[#e9ede7] bg-[#fbfcfa] px-4 text-xs text-[#445248] outline-none placeholder:text-[#a0a9a1] focus:border-[#a6bca9]" /><button disabled={!draft.trim()} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#244a3d] text-white transition hover:bg-[#193d31] disabled:opacity-40"><Send size={15} /></button></form>
    </section>
  </div>;
}

function Goals({ goals, onAdd, onToggle }: { goals: Goal[]; onAdd: () => void; onToggle: (goal: Goal) => void }) {
  const grouped = goals.reduce<Record<string, Goal[]>>((result, goal) => {
    const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(goal.month));
    result[label] = [...(result[label] ?? []), goal]; return result;
  }, {});
  return <div><SectionHeading eyebrow="Small steps, shared direction" title="Monthly goals" description="Make the bigger picture feel a little closer." action={<button onClick={onAdd} className="flex items-center gap-2 rounded-xl bg-[#244a3d] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15} />Add a goal</button>} />
    {goals.length ? <div className="space-y-7">{Object.entries(grouped).map(([month, monthGoals]) => <section key={month}><h2 className="mb-3 flex items-center gap-2 text-xs font-bold text-[#526056]"><CalendarDays size={14} className="text-[#829182]" />{month}</h2><div className="grid gap-3 lg:grid-cols-2">{monthGoals.map((goal) => <article key={goal.id} className={`flex gap-3 rounded-[18px] border bg-white p-5 shadow-panel transition ${goal.complete ? "border-[#e8eee6] opacity-75" : "border-[#e8ece7]"}`}><button onClick={() => onToggle(goal)} aria-label={goal.complete ? "Mark goal incomplete" : "Mark goal complete"} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${goal.complete ? "border-[#7c9b7c] bg-[#7c9b7c] text-white" : "border-[#c9d4c8] text-transparent hover:border-[#719279] hover:text-[#719279]"}`}><Check size={13} /></button><div><div className="flex items-center gap-2"><h3 className={`text-sm font-semibold ${goal.complete ? "text-[#879288] line-through" : "text-[#34463a]"}`}>{goal.title}</h3>{goal.complete && <span className="rounded-full bg-[#e9f2e8] px-2 py-0.5 text-[8px] font-bold text-[#638068]">DONE</span>}</div><p className="mt-1.5 text-xs leading-5 text-[#849087]">{goal.details || "A goal the team is working toward."}</p></div></article>)}</div></section>)}</div> : <div className="rounded-2xl border border-dashed border-[#d9e0d8] bg-white py-16 text-center"><Target size={28} className="mx-auto text-[#8ba08d]" /><h3 className="mt-3 text-sm font-semibold text-[#526056]">A little direction goes a long way.</h3><p className="mt-1 text-xs text-[#929c93]">Set a monthly goal and keep the whole team moving together.</p><button onClick={onAdd} className="mt-4 text-xs font-semibold text-[#527460]">Set your first goal →</button></div>}
  </div>;
}

function SearchView({ query, setQuery, hits }: { query: string; setQuery: (value: string) => void; hits: SearchHit[] }) {
  return <div><SectionHeading eyebrow="Find the thread" title="Ask your project" description="Search tasks, conversations, and goals in plain language." />
    <div className="mx-auto max-w-[900px]">
      <div className="relative mb-5"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a998d]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “what’s blocking launch?” or “onboarding bugs”" className="h-14 w-full rounded-2xl border border-[#dfe7df] bg-white pl-12 pr-12 text-sm text-[#33443a] shadow-panel outline-none placeholder:text-[#a3aca4] focus:border-[#96af9b]" />{query && <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#98a198]"><X size={16} /></button>}</div>
      <div className="mb-4 flex items-center gap-2 text-[10px] text-[#98a098]"><Sparkles size={13} className="text-[#8c9662]" />Ranked matches from your project’s tasks, chat, and goals.</div>
      {query.trim().length < 2 ? <div className="rounded-2xl border border-dashed border-[#dbe2da] bg-white py-14 text-center"><Sparkles size={23} className="mx-auto text-[#91a393]" /><p className="mt-3 text-sm font-medium text-[#67766a]">What are you looking for?</p><p className="mt-1 text-xs text-[#99a39a]">Ask in your own words. Hermes will find the relevant project records.</p></div> : hits.length ? <div className="space-y-2.5">{hits.map((hit) => <article key={`${hit.type}-${hit.id}`} className="rounded-[17px] border border-[#e8ece7] bg-white p-4 shadow-panel transition hover:border-[#cdd9cc]"><div className="mb-2 flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[8px] font-bold tracking-[.08em] ${hit.type === "TASK" ? "bg-[#eaf0e9] text-[#527258]" : hit.type === "CHAT" ? "bg-[#f2eefa] text-[#786392]" : "bg-[#f4f0e1] text-[#8b814d]"}`}>{hit.type === "TASK" ? "TASK / BUG" : hit.type}</span><span className="text-[9px] text-[#9aa39a]">{formatDate(hit.createdAt)}</span><ArrowUpRight size={12} className="ml-auto text-[#a3aca2]" /></div><h3 className="text-sm font-semibold text-[#34463a]">{hit.title}</h3>{hit.excerpt && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#818c83]">{hit.excerpt}</p>}</article>)}</div> : <div className="rounded-2xl border border-dashed border-[#dbe2da] bg-white py-12 text-center"><CircleHelp size={22} className="mx-auto text-[#9ba69c]" /><p className="mt-3 text-sm font-medium text-[#67766a]">No matches just yet.</p><p className="mt-1 text-xs text-[#99a39a]">Try a different phrase or a couple of key words.</p></div>}
    </div>
  </div>;
}

function EmptyHint({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="py-7 text-center"><p className="text-xs text-[#8a958c]">{text}</p>{action}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#14221b]/35 p-4 backdrop-blur-[3px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div role="dialog" aria-modal="true" aria-labelledby="modal-title" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className="max-h-[90vh] w-full max-w-[480px] overflow-auto rounded-[22px] border border-white/80 bg-[#fbfcfa] p-5 shadow-2xl sm:p-6">
      <div className="mb-5 flex items-start justify-between"><div><p className="mb-1 text-[9px] font-bold uppercase tracking-[.18em] text-[#879587]">HERMES WORKSPACE</p><h2 id="modal-title" className="display-font text-xl font-bold tracking-[-.03em] text-[#293c31]">{title}</h2></div><button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[#89958b] transition hover:bg-[#edf1eb]"><X size={16} /></button></div>
      {children}
    </motion.div>
  </motion.div>;
}

function ModalActions({ onCancel, submit }: { onCancel: () => void; submit: string }) {
  return <div className="flex justify-end gap-2 border-t border-[#edf0eb] pt-4"><button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-xs font-semibold text-[#778279] hover:bg-[#eef1eb]">Cancel</button><button className="rounded-xl bg-[#244a3d] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#193d31]">{submit}</button></div>;
}
