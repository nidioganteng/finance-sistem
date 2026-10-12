"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, UserCheck, UserX, ShieldCheck, Building2, Clock, Users } from "lucide-react";
import { approveUser, rejectUser, updateUserEntities, deactivateUser, activateUser } from "@/lib/actions/pengguna";
import { roleLabel } from "@/lib/rbac";
import { Role, UserStatus } from "@/types/app-enums";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";

type EntityItem = { id: string; name: string; key: string };
type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  status: string;
  createdAt: Date | string;
  entityAccess: { entity: EntityItem }[];
  entityKeys?: string[];
};

const STATUS_STYLE: Record<UserStatus, { dot: string; text: string; bg: string }> = {
  PENDING: { dot: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/15" },
  ACTIVE:  { dot: "bg-green-400",  text: "text-green-700 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-500/15"   },
  INACTIVE:{ dot: "bg-gray-400",   text: "text-gray-500 dark:text-gray-400",     bg: "bg-gray-100 dark:bg-gray-500/15"    },
};
const STATUS_LABEL: Record<UserStatus, string> = { PENDING: "Menunggu", ACTIVE: "Aktif", INACTIVE: "Nonaktif" };

const ROLE_OPTS_SUPER:   Role[] = ["SUPER_ADMIN","MANAJER_KEUANGAN","STAF_KEUANGAN","MANAGER_ADMIN","ADMIN_SIDAMON"];
const ROLE_OPTS_MANAGER: Role[] = ["MANAJER_KEUANGAN","STAF_KEUANGAN","MANAGER_ADMIN","ADMIN_SIDAMON"];

const FILTER_TABS = [
  { key: "semua",    label: "Semua",             icon: Users },
  { key: "PENDING",  label: "Menunggu Approval",  icon: Clock },
  { key: "ACTIVE",   label: "Aktif",              icon: UserCheck },
  { key: "INACTIVE", label: "Nonaktif",           icon: UserX },
];

function getInitial(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500","bg-purple-500","bg-emerald-500","bg-rose-500",
  "bg-amber-500","bg-cyan-500","bg-indigo-500","bg-pink-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function PenggunaClient({
  users,
  allEntities,
  viewerRole,
}: {
  users: UserItem[];
  allEntities: EntityItem[];
  viewerRole: string;
}) {
  const router = useRouter();
  const roleOpts = viewerRole === "SUPER_ADMIN" ? ROLE_OPTS_SUPER : ROLE_OPTS_MANAGER;
  const [filter, setFilter] = useState("semua");
  const [approvingUser, setApprovingUser] = useState<UserItem | null>(null);
  const [editingUser, setEditingUser]     = useState<UserItem | null>(null);
  const [selectedRole, setSelectedRole]   = useState<Role>("STAF_KEUANGAN");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = {
    semua:    users.length,
    PENDING:  users.filter(u => u.status === "PENDING").length,
    ACTIVE:   users.filter(u => u.status === "ACTIVE").length,
    INACTIVE: users.filter(u => u.status === "INACTIVE").length,
  };
  const filtered = filter === "semua" ? users : users.filter(u => u.status === filter);

  function toggleEntity(id: string) {
    setSelectedEntities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function openApprove(user: UserItem) {
    setApprovingUser(user);
    setEditingUser(null);
    setSelectedRole("STAF_KEUANGAN");
    setSelectedEntities(user.entityAccess.map(a => a.entity.id));
    setError(null);
  }

  function openEdit(user: UserItem) {
    setEditingUser(user);
    setApprovingUser(null);
    setSelectedEntities(user.entityAccess.map(a => a.entity.id));
    setError(null);
  }

  function closeModal() { setApprovingUser(null); setEditingUser(null); setError(null); }

  async function handleApprove(userId: string) {
    startTransition(async () => {
      try {
        await approveUser(userId, selectedRole, selectedEntities);
        router.refresh(); closeModal();
      } catch (e: any) { setError(e.message); }
    });
  }

  async function handleReject(userId: string) {
    if (!confirm("Tolak pendaftaran pengguna ini?")) return;
    startTransition(async () => { await rejectUser(userId); router.refresh(); closeModal(); });
  }

  async function handleUpdateEntities(userId: string) {
    startTransition(async () => {
      try {
        await updateUserEntities(userId, selectedEntities);
        router.refresh(); closeModal();
      } catch (e: any) { setError(e.message); }
    });
  }

  async function handleDeactivate(userId: string) {
    if (!confirm("Nonaktifkan pengguna ini?")) return;
    startTransition(async () => { await deactivateUser(userId); router.refresh(); });
  }

  async function handleActivate(userId: string) {
    startTransition(async () => { await activateUser(userId); router.refresh(); });
  }

  const modalUser = approvingUser ?? editingUser;

  return (
    <div className="flex flex-col gap-5 relative">
      <LoadingOverlay visible={isPending} />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-surface-subtle rounded-[14px] w-fit">
        {FILTER_TABS.map(t => {
          const Icon = t.icon;
          const count = counts[t.key as keyof typeof counts];
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12.5px] font-semibold transition-colors ${
                filter === t.key
                  ? "bg-navy text-white shadow-sm"
                  : "text-muted-stronger hover:bg-surface-hover"
              }`}
            >
              <Icon size={13} className="flex-none" />
              {t.label}
              {count > 0 && (
                <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                  filter === t.key ? "bg-white/20 text-white" : "bg-surface-card text-muted-stronger"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Cards */}
      {filtered.length === 0 ? (
        <div className="bg-surface-card rounded-[20px] border border-border-soft py-16 text-center text-[13px] text-muted-faint">
          Tidak ada pengguna untuk filter ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(user => {
            const st = STATUS_STYLE[user.status as UserStatus];
            return (
              <div key={user.id} className="bg-surface-card border border-border-soft rounded-[20px] p-5 flex flex-col gap-4 hover:border-border transition-colors">
                {/* Top: avatar + name + status */}
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center text-white font-bold text-[13px] flex-none ${avatarColor(user.name)}`}>
                    {getInitial(user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-bold text-navy-text leading-snug truncate">{user.name}</p>
                      {st && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {STATUS_LABEL[user.status as UserStatus] ?? user.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-faint truncate mt-0.5">{user.email}</p>
                  </div>
                </div>

                {/* Role + Entity */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={12} className="text-muted-faint flex-none" />
                    <span className="text-[12px] text-muted-stronger font-semibold">
                      {user.role ? roleLabel(user.role as Role) : <span className="text-muted-faint italic">Belum ditetapkan</span>}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Building2 size={12} className="text-muted-faint flex-none mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {user.entityAccess.length === 0 ? (
                        <span className="text-[11.5px] text-muted-faint italic">Belum ada akses entitas</span>
                      ) : (
                        user.entityAccess.map(a => (
                          <span key={a.entity.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-surface-subtle text-muted-stronger border border-border-soft">
                            {a.entity.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Divider + Actions */}
                <div className="border-t border-border-soft pt-3 flex items-center gap-2 flex-wrap">
                  {user.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => openApprove(user)}
                        className="flex-1 h-8 rounded-[9px] bg-navy text-white text-[12px] font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                      >
                        <UserCheck size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(user.id)}
                        disabled={isPending}
                        className="h-8 px-3 rounded-[9px] border border-border-soft text-[12px] text-status-red font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        Tolak
                      </button>
                    </>
                  )}
                  {user.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() => openEdit(user)}
                        className="flex-1 h-8 rounded-[9px] border border-border-soft text-[12px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors"
                      >
                        Edit Akses
                      </button>
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        disabled={isPending}
                        className="h-8 px-3 rounded-[9px] border border-border-soft text-[12px] text-muted hover:bg-surface-hover transition-colors"
                      >
                        Nonaktifkan
                      </button>
                    </>
                  )}
                  {user.status === "INACTIVE" && (
                    <button
                      onClick={() => handleActivate(user.id)}
                      disabled={isPending}
                      className="flex-1 h-8 rounded-[9px] bg-navy text-white text-[12px] font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <UserCheck size={12} /> Aktifkan
                    </button>
                  )}
                  <p className="w-full text-[10.5px] text-muted-faint text-right">
                    Bergabung {new Date(user.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Approve / Edit Entitas */}
      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-surface-card border border-border-soft rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-bold text-[12px] flex-none ${avatarColor(modalUser.name)}`}>
                  {getInitial(modalUser.name)}
                </div>
                <div>
                  <p className="text-[13.5px] font-bold text-navy-text leading-tight">{modalUser.name}</p>
                  <p className="text-[11px] text-muted-faint">{approvingUser ? "Approve Pengguna" : "Edit Akses Entitas"}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-surface-hover text-muted-stronger">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {error && (
                <div className="px-3.5 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-status-red text-[12px]">
                  {error}
                </div>
              )}

              {/* Role select — hanya saat approve */}
              {approvingUser && (
                <div>
                  <label className="text-[10.5px] font-bold text-muted-faint uppercase tracking-wider block mb-1.5">
                    Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as Role)}
                    className="w-full h-9 px-3 rounded-[10px] border border-border-soft bg-surface-input text-[13px] text-navy-text focus:outline-none focus:border-brand"
                  >
                    {roleOpts.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                </div>
              )}

              {/* Entity checkboxes */}
              <div>
                <label className="text-[10.5px] font-bold text-muted-faint uppercase tracking-wider block mb-2">
                  Akses Entitas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {allEntities.map(e => {
                    const checked = selectedEntities.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleEntity(e.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border text-left transition-colors ${
                          checked
                            ? "border-brand bg-brand/5 text-navy-text"
                            : "border-border-soft bg-surface-subtle text-muted-stronger hover:bg-surface-hover"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-none transition-colors ${
                          checked ? "bg-navy border-navy" : "border-border bg-surface-input"
                        }`}>
                          {checked && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-[12.5px] font-semibold">{e.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 pt-1 border-t border-border-soft">
                <button
                  onClick={closeModal}
                  className="h-9 px-4 rounded-[10px] border border-border-soft text-[12.5px] font-semibold text-muted-stronger hover:bg-surface-hover transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => approvingUser ? handleApprove(approvingUser.id) : handleUpdateEntities(editingUser!.id)}
                  disabled={isPending}
                  className="flex-1 h-9 rounded-[10px] bg-navy text-white text-[12.5px] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Check size={13} />
                  {approvingUser ? "Konfirmasi Approve" : "Simpan Akses"}
                </button>
                {approvingUser && (
                  <button
                    onClick={() => handleReject(approvingUser.id)}
                    disabled={isPending}
                    className="h-9 px-3 rounded-[10px] border border-red-200 dark:border-red-500/30 text-status-red text-[12px] font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    Tolak
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
