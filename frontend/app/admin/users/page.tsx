"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  ListTodo,
  SlidersHorizontal,
  X,
  RotateCcw,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { AdminUserItem } from "@/types";
import { formatDateWIB } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (roleFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [search, roleFilter, statusFilter]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
  }, []);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    whatsapp_number: "",
    password: "",
    role: "user",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get<AdminUserItem[]>("/admin/users");
      setUsers(data);
    } catch {
      toast.error("Gagal memuat daftar pengguna");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Derived filtered users during render per vercel best practices
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          u.name.toLowerCase().includes(q) ||
          u.whatsapp_number.includes(q) ||
          u.role.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }
      if (statusFilter === "active" && !u.is_active) {
        return false;
      }
      if (statusFilter === "inactive" && u.is_active) {
        return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };
  const handleRoleChange = (val: string) => {
    setRoleFilter(val);
    setCurrentPage(1);
  };
  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage, ITEMS_PER_PAGE]);

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      whatsapp_number: "",
      password: "",
      role: "user",
      is_active: true,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (target: AdminUserItem) => {
    setEditingUser(target);
    setFormData({
      name: target.name,
      whatsapp_number: target.whatsapp_number,
      password: "",
      role: target.role,
      is_active: target.is_active,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama pengguna wajib diisi");
      return;
    }
    if (!formData.whatsapp_number.trim()) {
      toast.error("Nomor WhatsApp wajib diisi");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/admin/users", formData);
      toast.success("Pengguna baru berhasil ditambahkan!");
      setIsCreateOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat pengguna");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!formData.name.trim()) {
      toast.error("Nama pengguna wajib diisi");
      return;
    }
    if (!formData.whatsapp_number.trim()) {
      toast.error("Nomor WhatsApp wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        whatsapp_number: formData.whatsapp_number.trim(),
        role: formData.role,
        is_active: formData.is_active,
      };
      if (formData.password && formData.password.length >= 6) {
        payload.password = formData.password;
      }

      await api.put(`/admin/users/${editingUser.id}`, payload);
      toast.success("Data pengguna berhasil diperbarui!");
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui pengguna");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    if (currentUser?.id === deletingUser.id) {
      toast.error("Anda tidak dapat menghapus akun Anda sendiri");
      return;
    }

    try {
      await api.delete(`/admin/users/${deletingUser.id}`);
      toast.success("Pengguna berhasil dihapus");
      setDeletingUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus pengguna");
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center text-sm text-[#9C9C9C]">
        Memuat daftar pengguna...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
            Manajemen Pengguna
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Lihat daftar akun mahasiswa, tambah manual, ubah role, dan kelola status akses.
          </p>
        </div>

        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Tambah Pengguna
        </Button>
      </div>

      {/* Desktop Search & Filters */}
      <Card className="p-3 hidden md:block">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
            <Input
              placeholder="Cari nama atau nomor WhatsApp..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-9 h-9 text-xs"
            />
            {search ? (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-2.5 text-[#9C9C9C] hover:text-[#0A0A0A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <Select
            value={roleFilter}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="all">Semua Role</option>
            <option value="admin">Administrator (Admin)</option>
            <option value="user">Pengguna (User)</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="all">Semua Status Akun</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        </div>
      </Card>

      {/* Mobile Active Filter Bar & Counter */}
      <div className="md:hidden flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-[#6B6B6B] font-medium">
            Total <strong className="text-[#0A0A0A]">{filteredUsers.length}</strong> pengguna
          </span>

          {activeFilterCount > 0 ? (
            <Badge variant="default" className="text-[10px] bg-indigo-50 text-[#6366F1] border-indigo-200">
              {activeFilterCount} filter aktif
            </Badge>
          ) : null}
        </div>

        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        ) : null}
      </div>

      {/* Mobile Floating Action Button (above bottom navbar) */}
      <button
        type="button"
        onClick={() => setIsFilterModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 bg-[#6366F1] text-white px-4 py-3 rounded-full shadow-lg shadow-indigo-500/30 hover:bg-[#4F46E5] active:scale-95 transition-all text-xs font-semibold"
        aria-label="Filter & Cari Pengguna"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span>Filter & Cari</span>
        {activeFilterCount > 0 ? (
          <span className="w-5 h-5 bg-white text-[#6366F1] rounded-full text-[10px] font-bold flex items-center justify-center">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {/* Mobile Search & Filter Modal Dialog */}
      <Dialog
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        title="Cari & Filter Pengguna"
        description="Filter akun berdasarkan nama, nomor WhatsApp, hak akses, atau status."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Pencarian</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
              <Input
                placeholder="Cari nama atau nomor WhatsApp..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="absolute right-3 top-2.5 text-[#9C9C9C] hover:text-[#0A0A0A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Hak Akses (Role)</label>
            <Select
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="all">Semua Role</option>
              <option value="admin">Administrator (Admin)</option>
              <option value="user">Pengguna (User)</option>
            </Select>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Status Akun</label>
            <Select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="all">Semua Status Akun</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>

          <div className="pt-3 border-t border-[#E8E8EC] flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="text-xs text-[#6B6B6B]"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Filter
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsFilterModalOpen(false)}
              className="text-xs"
            >
              Terapkan ({filteredUsers.length} Hasil)
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Mobile View: Clean Card List */}
      <div className="block md:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-xs text-[#9C9C9C]">Tidak ada pengguna yang cocok dengan filter.</p>
          </Card>
        ) : (
          paginatedUsers.map((u) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <Card key={u.id} className="p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-[#0A0A0A] truncate">{u.name}</span>
                      {isSelf ? (
                        <span className="text-[10px] text-[#6366F1] font-semibold bg-indigo-50 px-1.5 py-0.5 rounded-[4px]">
                          Anda
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-[#6B6B6B] mt-1 font-mono">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>+{u.whatsapp_number}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.role === "admin" ? (
                      <Badge variant="default" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 px-1.5">
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">User</Badge>
                    )}

                    {u.is_active ? (
                      <Badge variant="success" className="text-[10px] py-0 px-1.5">Aktif</Badge>
                    ) : (
                      <Badge variant="error" className="text-[10px] py-0 px-1.5">Nonaktif</Badge>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E8E8EC] flex items-center justify-between text-[11px] text-[#6B6B6B]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-[#9C9C9C]" />
                      {u.course_count} Kuliah
                    </span>
                    <span className="flex items-center gap-1">
                      <ListTodo className="w-3 h-3 text-[#9C9C9C]" />
                      {u.task_count} Tugas
                    </span>
                  </div>

                  <span className="text-[#9C9C9C]">{formatDateWIB(u.created_at)}</span>
                </div>

                <div className="pt-2 border-t border-[#E8E8EC] flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(u)}
                    className="h-8 text-xs px-2.5"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeletingUser(u)}
                    disabled={isSelf}
                    className="h-8 text-xs px-2.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Hapus
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop View: Full Data Table with whitespace-nowrap */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-[#E8E8EC] text-[#6B6B6B] font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
              <tr>
                <th className="py-3 px-4">Nama Pengguna</th>
                <th className="py-3 px-4">Nomor WhatsApp</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Data Tugas / Kuliah</th>
                <th className="py-3 px-4">Terdaftar</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8EC] whitespace-nowrap">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9C9C9C]">
                    Tidak ada pengguna yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#0A0A0A]">
                        {u.name}
                        {isSelf ? (
                          <span className="ml-2 text-[10px] text-[#6366F1] font-normal bg-indigo-50 px-1.5 py-0.5 rounded-[4px]">
                            Anda
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-[#0A0A0A] font-mono">
                        +{u.whatsapp_number}
                      </td>
                      <td className="py-3 px-4">
                        {u.role === "admin" ? (
                          <Badge variant="default" className="bg-amber-50 text-amber-700 border-amber-200">
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#6B6B6B]">
                        <span className="inline-flex items-center gap-1 mr-3">
                          <BookOpen className="w-3 h-3 text-[#9C9C9C]" />
                          {u.course_count} kuliah
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ListTodo className="w-3 h-3 text-[#9C9C9C]" />
                          {u.task_count} tugas
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#6B6B6B]">
                        {formatDateWIB(u.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1 rounded-[4px] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-zinc-100"
                            title="Edit Pengguna"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingUser(u)}
                            disabled={isSelf}
                            className={`p-1 rounded-[4px] transition-colors ${
                              isSelf
                                ? "text-zinc-300 cursor-not-allowed"
                                : "text-red-500 hover:text-red-700 hover:bg-red-50"
                            }`}
                            title={isSelf ? "Tidak dapat menghapus akun sendiri" : "Hapus Pengguna"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredUsers.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
        itemName="pengguna"
        className="mt-6"
      />

      {/* Create User Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Tambah Pengguna Baru"
        description="Buat akun pengguna atau admin secara manual"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: Rian Anggara"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Nomor WhatsApp <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: 08123456789"
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Password Awal <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              placeholder="Minimal 6 karakter"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Role</label>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="user">User (Mahasiswa)</option>
                <option value="admin">Administrator</option>
              </Select>
            </div>

            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Status Akun</label>
              <Select
                value={formData.is_active ? "active" : "inactive"}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.value === "active" })
                }
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Simpan Pengguna
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
        title="Ubah Pengguna"
        description="Perbarui informasi data pengguna"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Nama Lengkap</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Nomor WhatsApp</label>
            <Input
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Reset Password (Opsional)
            </label>
            <Input
              type="password"
              placeholder="Kosongkan jika tidak ingin mengubah password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Role</label>
              <Select
                value={formData.role}
                disabled={currentUser?.id === editingUser?.id}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="user">User (Mahasiswa)</option>
                <option value="admin">Administrator</option>
              </Select>
              {currentUser?.id === editingUser?.id ? (
                <span className="text-[10px] text-[#9C9C9C] block mt-1">
                  Tidak dapat mengubah role sendiri
                </span>
              ) : null}
            </div>

            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Status Akun</label>
              <Select
                value={formData.is_active ? "active" : "inactive"}
                disabled={currentUser?.id === editingUser?.id}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.value === "active" })
                }
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
            <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Perbarui Data
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null);
        }}
        title="Hapus Pengguna"
        description="Konfirmasi penghapusan akun pengguna"
      >
        <div className="space-y-4 text-xs text-[#6B6B6B]">
          <p>
            Apakah Anda yakin ingin menghapus pengguna{" "}
            <strong className="text-[#0A0A0A]">{deletingUser?.name}</strong> (+
            {deletingUser?.whatsapp_number})?
          </p>
          <p className="text-red-600">
            Perhatian: Seluruh mata kuliah, tugas, dan riwayat pengingat pengguna ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8EC]">
            <Button variant="secondary" onClick={() => setDeletingUser(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Ya, Hapus Pengguna
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
