"use client";

import { useEffect, useState, useCallback } from "react";
import { Layers, Plus, Edit2, Trash2, CheckCircle2, XCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Plan } from "@/types";
import { formatRupiah, formatDateWIB } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    price: 0,
    billing_period: "monthly",
    course_limit: 2,
    task_limit: 4,
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const data = await api.get<Plan[]>("/admin/plans");
      setPlans(data);
    } catch {
      toast.error("Gagal memuat daftar paket");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      price: 0,
      billing_period: "monthly",
      course_limit: 2,
      task_limit: 4,
      is_active: true,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price: plan.price,
      billing_period: plan.billing_period || "monthly",
      course_limit: plan.course_limit,
      task_limit: plan.task_limit,
      is_active: plan.is_active,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama paket wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/admin/plans", {
        ...formData,
        price: Number(formData.price),
        course_limit: Number(formData.course_limit),
        task_limit: Number(formData.task_limit),
      });
      toast.success("Paket baru berhasil ditambahkan!");
      setIsCreateOpen(false);
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat paket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    if (!formData.name.trim()) {
      toast.error("Nama paket wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/admin/plans/${editingPlan.id}`, {
        ...formData,
        price: Number(formData.price),
        course_limit: Number(formData.course_limit),
        task_limit: Number(formData.task_limit),
      });
      toast.success("Paket berhasil diperbarui!");
      setEditingPlan(null);
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui paket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    try {
      await api.delete(`/admin/plans/${deletingPlan.id}`);
      toast.success("Paket berhasil dihapus");
      setDeletingPlan(null);
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus paket");
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center text-sm text-[#9C9C9C]">
        Memuat data paket...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
            Manage Plans
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Konfigurasi metadata paket, penetapan harga Rupiah, dan batas kuota tampilan.
          </p>
        </div>

        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Tambah Paket
        </Button>
      </div>

      <div className="p-4 rounded-[12px] bg-white border border-[#E8E8EC] flex items-start gap-3">
        <Info className="w-5 h-5 text-[#6366F1] shrink-0 mt-0.5" />
        <div className="text-xs text-[#6B6B6B] leading-relaxed">
          <strong className="text-[#0A0A0A]">Catatan Arsitektur:</strong> Perubahan data paket di sini akan langsung ditampilkan pada halaman publik <code>/pricing</code> dan landing page. Sesuai PRD, batasan kuota belum di-enforce secara ketat ke akun user sampai sistem langganan resmi diaktifkan.
        </div>
      </div>

      {/* Mobile View: Plans Card List */}
      <div className="block md:hidden space-y-3">
        {plans.map((p) => (
          <Card key={p.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-base text-[#0A0A0A]">{p.name}</h3>
                  <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded-[4px]">
                    {p.slug}
                  </span>
                </div>
                <div className="text-base font-extrabold text-[#6366F1] mt-1">
                  {formatRupiah(p.price)}
                  {p.price > 0 ? <span className="text-xs text-[#9C9C9C] font-normal"> / bulan</span> : null}
                </div>
              </div>

              {p.is_active ? (
                <Badge variant="success" className="text-[10px] py-0 px-1.5">Aktif</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-zinc-400">Nonaktif</Badge>
              )}
            </div>

            {p.description ? (
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                {p.description}
              </p>
            ) : null}

            <div className="pt-2 border-t border-[#E8E8EC] flex items-center justify-between text-xs text-[#6B6B6B] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {p.course_limit} Kuliah
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {p.task_limit} Tugas
                </Badge>
              </div>

              <span className="text-[11px] text-[#9C9C9C]">{formatDateWIB(p.updated_at)}</span>
            </div>

            <div className="pt-2 border-t border-[#E8E8EC] flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEdit(p)}
                className="h-8 text-xs px-2.5"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeletingPlan(p)}
                className="h-8 text-xs px-2.5"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Hapus
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop View: Full Data Table with whitespace-nowrap */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-[#E8E8EC] text-[#6B6B6B] font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
              <tr>
                <th className="py-3 px-4">Nama Paket</th>
                <th className="py-3 px-4">Slug</th>
                <th className="py-3 px-4">Harga Bulanan</th>
                <th className="py-3 px-4">Batas Mata Kuliah</th>
                <th className="py-3 px-4">Batas Tugas</th>
                <th className="py-3 px-4">Status Tampil</th>
                <th className="py-3 px-4">Diperbarui</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8EC] whitespace-nowrap">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-[#0A0A0A]">
                    {p.name}
                    <span className="block text-[11px] font-normal text-[#6B6B6B]">
                      {p.description}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-600">
                    {p.slug}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#0A0A0A]">
                    {formatRupiah(p.price)}
                    {p.price > 0 ? <span className="text-[10px] text-[#9C9C9C] font-normal"> / bln</span> : null}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#0A0A0A]">
                    {p.course_limit} Mata Kuliah
                  </td>
                  <td className="py-3 px-4 font-medium text-[#0A0A0A]">
                    {p.task_limit} Tugas
                  </td>
                  <td className="py-3 px-4">
                    {p.is_active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-zinc-400 font-medium text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[#6B6B6B]">
                    {formatDateWIB(p.updated_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1 rounded-[4px] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-zinc-100"
                        title="Edit Paket"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingPlan(p)}
                        className="p-1 rounded-[4px] text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Hapus Paket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Tambah Paket Baru"
        description="Konfigurasikan informasi paket penawaran"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">
                Nama Paket <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Contoh: Premium Mahasiswa"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Slug</label>
              <Input
                placeholder="Contoh: premium-mahasiswa"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Deskripsi Singkat</label>
            <Textarea
              placeholder="Jelaskan target pengguna paket ini..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Harga (Rupiah)</label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Batas Kuliah</label>
              <Input
                type="number"
                min={1}
                value={formData.course_limit}
                onChange={(e) => setFormData({ ...formData, course_limit: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Batas Tugas</label>
              <Input
                type="number"
                min={1}
                value={formData.task_limit}
                onChange={(e) => setFormData({ ...formData, task_limit: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Status Tampil</label>
            <Select
              value={formData.is_active ? "active" : "inactive"}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.value === "active" })
              }
            >
              <option value="active">Aktif (Tampil di halaman Pricing)</option>
              <option value="inactive">Nonaktif (Disembunyikan)</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Simpan Paket
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={Boolean(editingPlan)}
        onOpenChange={(open) => {
          if (!open) setEditingPlan(null);
        }}
        title="Ubah Paket"
        description="Perbarui informasi paket layanan"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Nama Paket</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Slug</label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Deskripsi Singkat</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Harga (Rupiah)</label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Batas Kuliah</label>
              <Input
                type="number"
                min={1}
                value={formData.course_limit}
                onChange={(e) => setFormData({ ...formData, course_limit: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Batas Tugas</label>
              <Input
                type="number"
                min={1}
                value={formData.task_limit}
                onChange={(e) => setFormData({ ...formData, task_limit: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Status Tampil</label>
            <Select
              value={formData.is_active ? "active" : "inactive"}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.value === "active" })
              }
            >
              <option value="active">Aktif (Tampil di halaman Pricing)</option>
              <option value="inactive">Nonaktif (Disembunyikan)</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
            <Button type="button" variant="secondary" onClick={() => setEditingPlan(null)}>
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Perbarui Paket
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={Boolean(deletingPlan)}
        onOpenChange={(open) => {
          if (!open) setDeletingPlan(null);
        }}
        title="Hapus Paket"
        description="Konfirmasi penghapusan paket"
      >
        <div className="space-y-4 text-xs text-[#6B6B6B]">
          <p>
            Apakah Anda yakin ingin menghapus paket{" "}
            <strong className="text-[#0A0A0A]">{deletingPlan?.name}</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8EC]">
            <Button variant="secondary" onClick={() => setDeletingPlan(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
