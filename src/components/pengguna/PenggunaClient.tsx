"use client";

import { useState, useTransition } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import { approveUser, rejectUser, updateUserEntities, deactivateUser, activateUser } from "@/lib/actions/pengguna";
import { roleLabel } from "@/lib/rbac";
import { Role, UserStatus } from "@prisma/client";

type EntityItem = { id: string; name: string; key: string };
type UserItem = {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  status: UserStatus;
  createdAt: Date;
  entityAccess: { entity: EntityItem }[];
};

const STATUS_BADGE: Record<UserStatus, string> = {
  PENDING: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  ACTIVE: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400",
  INACTIVE: "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400",
};
const STATUS_LABEL: Record<UserStatus, string> = {
  PENDING: "Menunggu",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
};

const ROLE_OPTS_SUPER: Role[] = ["SUPER_ADMIN", "MANAJER_KEUANGAN", "STAF_KEUANGAN", "MANAGER_ADMIN", "ADMIN_SIDAMON"];
const ROLE_OPTS_MANAGER: Role[] = ["MANAJER_KEUANGAN", "STAF_KEUANGAN", "MANAGER_ADMIN", "ADMIN_SIDAMON"];

const FILTER_TABS = [
  { key: "semua", label: "Semua" },
  { key: "PENDING", label: "Menunggu Approval" },
  { key: "ACTIVE", label: "Aktif" },
  { key: "INACTIVE", label: "Nonaktif" },
];

export function PenggunaClient({
  users,
  allEntities,
  viewerRole,
}: {
  users: UserItem[];
  allEntities: EntityItem[];
  viewerRole: string;
}) {
  const roleOpts = viewerRole === "SUPER_ADMIN" ? ROLE_OPTS_SUPER : ROLE_OPTS_MANAGER;
  const [filter, setFilter] = useState("semua");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editEntityId, setEditEntityId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("STAF_KEUANGAN");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = filter === "semua" ? users : users.filter((u) => u.status === filter);

  function toggleEntity(id: string) {
    setSelectedEntities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function startApprove(user: UserItem) {
    setApprovingId(user.id);
    setEditEntityId(null);
    setSelectedRole("STAF_KEUANGAN");
    setSelectedEntities(user.entityAccess.map((a) => a.entity.id));
    setError(null);
  }

  function startEditEntities(user: UserItem) {
    setEditEntityId(user.id);
    setApprovingId(null);
    setSelectedEntities(user.entityAccess.map((a) => a.entity.id));
    setError(null);
  }

  async function handleApprove(userId: string) {
    startTransition(async () => {
      try {
        await approveUser(userId, selectedRole, selectedEntities);
        setApprovingId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function handleReject(userId: string) {
    if (!confirm("Tolak pendaftaran pengguna ini?")) return;
    startTransition(async () => {
      await rejectUser(userId);
      setApprovingId(null);
    });
  }

  async function handleUpdateEntities(userId: string) {
    startTransition(async () => {
      try {
        await updateUserEntities(userId, selectedEntities);
        setEditEntityId(null);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  async function handleDeactivate(userId: string) {
    if (!confirm("Nonaktifkan pengguna ini?")) return;
    startTransition(() => { deactivateUser(userId); });
  }

  async function handleActivate(userId: string) {
    startTransition(() => { activateUser(userId); });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-status-red text-sm">{error}</div>
      )}

      <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl w-fit">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors ${
              filter === t.key ? "bg-navy text-white" : "text-muted-stronger hover:bg-surface-hover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-card rounded-[20px] border border-border-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-hover text-left">
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase">Nama</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Email</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Role</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Akses Entitas</th>
              <th className="py-3 px-3 text-[11px] font-bold text-muted-faint uppercase">Status</th>
              <th className="py-3 px-6 text-[11px] font-bold text-muted-faint uppercase text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-muted">
                  Tidak ada pengguna untuk filter ini.
                </td>
              </tr>
            )}
            {filtered.map((user) => (
              <>
                <tr key={user.id} className="border-b border-surface-subtle hover:bg-surface-hover/30 transition-colors">
                  <td className="py-3 px-6">
                    <div className="font-semibold text-navy-text">{user.name}</div>
                    <div className="text-[11.5px] text-muted">
                      Bergabung {new Date(user.createdAt).toLocaleDateString("id-ID")}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[12.5px] text-muted-stronger">{user.email}</td>
                  <td className="py-3 px-3 text-[12.5px] text-muted">
                    {user.role ? roleLabel(user.role) : "-"}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {user.entityAccess.length === 0 ? (
                        <span className="text-[12px] text-muted">-</span>
                      ) : (
                        user.entityAccess.map((a) => (
                          <span key={a.entity.id} className="text-[10.5px] font-semibold px-2 py-0.5 rounded bg-surface-hover text-muted-stronger">
                            {a.entity.name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${STATUS_BADGE[user.status]}`}>
                      {STATUS_LABEL[user.status]}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-right">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      {user.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => startApprove(user)}
                            className="px-3 py-1.5 rounded-lg bg-navy text-white text-[12px] font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-stronger"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      {user.status === "ACTIVE" && (
                        <>
                          <button
                            onClick={() => startEditEntities(user)}
                            className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-muted-stronger"
                          >
                            Edit Akses
                          </button>
                          <button
                            onClick={() => handleDeactivate(user.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted"
                          >
                            Nonaktifkan
                          </button>
                        </>
                      )}
                      {user.status === "INACTIVE" && (
                        <button
                          onClick={() => handleActivate(user.id)}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-muted-stronger"
                        >
                          Aktifkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {approvingId === user.id && (
                  <tr key={`approve-${user.id}`} className="border-b border-border bg-surface-subtle">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="flex flex-col gap-3">
                        <div className="text-sm font-bold text-navy-text">Approve: {user.name}</div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div>
                            <label className="text-[12px] font-semibold text-muted-stronger block mb-1">Role</label>
                            <select
                              value={selectedRole}
                              onChange={(e) => setSelectedRole(e.target.value as Role)}
                              className="px-3 py-2 rounded-xl border border-border text-sm bg-surface-card"
                            >
                              {roleOpts.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[12px] font-semibold text-muted-stronger block mb-1">Akses Entitas</label>
                            <div className="flex flex-wrap gap-2">
                              {allEntities.map((e) => (
                                <label key={e.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedEntities.includes(e.id)}
                                    onChange={() => toggleEntity(e.id)}
                                    className="rounded"
                                  />
                                  {e.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={isPending}
                            className="px-4 py-2 rounded-[10px] bg-navy text-white text-sm font-semibold flex items-center gap-1"
                          >
                            <Check size={14} /> Konfirmasi Approve
                          </button>
                          <button
                            onClick={() => setApprovingId(null)}
                            className="px-4 py-2 rounded-[10px] border border-border text-sm"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {editEntityId === user.id && (
                  <tr key={`edit-${user.id}`} className="border-b border-border bg-surface-subtle">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="flex flex-col gap-3">
                        <div className="text-sm font-bold text-navy-text">Edit Akses Entitas: {user.name}</div>
                        <div className="flex flex-wrap gap-3">
                          {allEntities.map((e) => (
                            <label key={e.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedEntities.includes(e.id)}
                                onChange={() => toggleEntity(e.id)}
                                className="rounded"
                              />
                              {e.name}
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateEntities(user.id)}
                            disabled={isPending}
                            className="px-4 py-2 rounded-[10px] bg-navy text-white text-sm font-semibold flex items-center gap-1"
                          >
                            <Check size={14} /> Simpan
                          </button>
                          <button
                            onClick={() => setEditEntityId(null)}
                            className="px-4 py-2 rounded-[10px] border border-border text-sm"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
