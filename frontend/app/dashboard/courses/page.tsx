"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, User, Hash, Edit2, Trash2, CheckCircle2, Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Course } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";

const COLOR_PRESETS = [
  "#6366F1", // Indigo
  "#3B82F6", // Blue
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#84CC16", // Lime
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#64748B", // Slate
];

export default function CoursesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courses;
    const q = search.toLowerCase();
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.lecturer && c.lecturer.toLowerCase().includes(q))
    );
  }, [courses, search]);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    lecturer: "",
    color: "#6366F1",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadCourses = useCallback(async () => {
    try {
      const data = await api.get<Course[]>("/courses");
      setCourses(data);
    } catch {
      toast.error("Gagal memuat mata kuliah");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      loadCourses();
    }
  }, [user, authLoading, router, loadCourses]);

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      code: "",
      lecturer: "",
      color: "#6366F1",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (c: Course) => {
    setEditingCourse(c);
    setFormData({
      name: c.name,
      code: c.code || "",
      lecturer: c.lecturer || "",
      color: c.color || "#6366F1",
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama mata kuliah wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/courses", formData);
      toast.success("Mata kuliah berhasil ditambahkan!");
      setIsCreateOpen(false);
      loadCourses();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat mata kuliah");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (!formData.name.trim()) {
      toast.error("Nama mata kuliah wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/courses/${editingCourse.id}`, formData);
      toast.success("Mata kuliah berhasil diperbarui!");
      setEditingCourse(null);
      loadCourses();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui mata kuliah");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (force = false) => {
    if (!deletingCourse) return;
    try {
      await api.delete(`/courses/${deletingCourse.id}${force ? "?force=true" : ""}`);
      toast.success("Mata kuliah berhasil dihapus");
      setDeletingCourse(null);
      setDeleteWarning(null);
      loadCourses();
    } catch (err: any) {
      if (err.code === "HAS_ATTACHED_TASKS") {
        setDeleteWarning(err.message);
      } else {
        toast.error(err.message || "Gagal menghapus mata kuliah");
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 flex justify-center text-sm text-[#9C9C9C]">
        Memuat mata kuliah...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">Daftar Mata Kuliah</h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Organisir penugasan Anda berdasarkan mata kuliah dan nama dosen.
          </p>
        </div>

        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Tambah Mata Kuliah
        </Button>
      </div>

      {/* Desktop Search Card */}
      <Card className="mb-6 p-3 hidden md:block">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
          <Input
            placeholder="Cari nama mata kuliah, kode, atau nama dosen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-9 text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-[#9C9C9C] hover:text-[#0A0A0A]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </Card>

      {/* Mobile Active Search Chip */}
      {search ? (
        <div className="md:hidden flex items-center justify-between gap-2 mb-4">
          <Badge variant="default" className="text-[10px] bg-indigo-50 text-[#6366F1] border-indigo-200">
            Pencarian: "{search}" ({filteredCourses.length})
          </Badge>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-[11px] font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      ) : null}

      {/* Mobile Floating Action Button (above bottom navbar) */}
      <button
        type="button"
        onClick={() => setIsFilterModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 bg-[#6366F1] text-white px-4 py-3 rounded-full shadow-lg shadow-indigo-500/30 hover:bg-[#4F46E5] active:scale-95 transition-all text-xs font-semibold"
        aria-label="Cari Mata Kuliah"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span>Cari Kuliah</span>
        {search ? (
          <span className="w-5 h-5 bg-white text-[#6366F1] rounded-full text-[10px] font-bold flex items-center justify-center">
            1
          </span>
        ) : null}
      </button>

      {/* Mobile Search Modal Dialog */}
      <Dialog
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        title="Cari Mata Kuliah"
        description="Temukan mata kuliah berdasarkan nama, kode, atau nama dosen."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Kata Kunci Pencarian</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
              <Input
                placeholder="Nama mata kuliah, kode, atau dosen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-2.5 text-[#9C9C9C] hover:text-[#0A0A0A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E8E8EC] flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearch("")}
              disabled={!search}
              className="text-xs text-[#6B6B6B]"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsFilterModalOpen(false)}
              className="text-xs"
            >
              Terapkan ({filteredCourses.length} Hasil)
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-[#9C9C9C] mb-3">
            <BookOpen className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Tidak Ada Mata Kuliah Ditemukan</h3>
          <p className="text-xs text-[#6B6B6B] mt-1 max-w-sm mx-auto">
            {search
              ? "Coba kata kunci pencarian lain atau klik reset."
              : "Tambahkan mata kuliah yang Anda ambil semester ini untuk memudahkan kategorisasi tugas."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {search ? (
              <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset Pencarian
              </Button>
            ) : null}
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Sekarang
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((c) => (
            <Card key={c.id} className="relative overflow-hidden card-hover flex flex-col justify-between">
              {/* Color bar top */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: c.color || "#6366F1" }}
              />

              <div className="pt-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-[#0A0A0A] truncate">{c.name}</h3>
                    {c.code ? (
                      <div className="flex items-center gap-1 text-xs text-[#6B6B6B] mt-1">
                        <Hash className="w-3.5 h-3.5 text-[#9C9C9C]" />
                        <span>{c.code}</span>
                      </div>
                    ) : null}
                  </div>

                  <span
                    className="w-4 h-4 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: c.color || "#6366F1" }}
                    title={c.color}
                  />
                </div>

                {c.lecturer ? (
                  <div className="flex items-center gap-1.5 text-xs text-[#6B6B6B] mt-3">
                    <User className="w-3.5 h-3.5 text-[#9C9C9C]" />
                    <span className="truncate">Dosen: {c.lecturer}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 pt-3 border-t border-[#E8E8EC] flex items-center justify-between">
                <Badge variant="outline" className="text-[11px]">
                  {c.task_count || 0} Tugas Terhubung
                </Badge>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="p-1.5 rounded-[6px] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-zinc-100 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setDeletingCourse(c);
                      setDeleteWarning(null);
                    }}
                    className="p-1.5 rounded-[6px] text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Tambah Mata Kuliah"
        description="Masukkan identitas mata kuliah semester ini"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Nama Mata Kuliah <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: Pemrograman Web Lanjut"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Kode Kuliah</label>
              <Input
                placeholder="Contoh: IF-301"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Dosen Pengampu</label>
              <Input
                placeholder="Contoh: Dr. Ir. Anton"
                value={formData.lecturer}
                onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Warna Identitas</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    formData.color === color
                      ? "ring-2 ring-offset-2 ring-[#6366F1] scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={Boolean(editingCourse)}
        onOpenChange={(open) => {
          if (!open) setEditingCourse(null);
        }}
        title="Ubah Mata Kuliah"
        description="Perbarui informasi mata kuliah"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Nama Mata Kuliah <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Kode Kuliah</label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Dosen Pengampu</label>
              <Input
                value={formData.lecturer}
                onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Warna Identitas</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    formData.color === color
                      ? "ring-2 ring-offset-2 ring-[#6366F1] scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingCourse(null)}
            >
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Perbarui
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={Boolean(deletingCourse)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingCourse(null);
            setDeleteWarning(null);
          }
        }}
        title="Hapus Mata Kuliah"
        description="Konfirmasi penghapusan data mata kuliah"
      >
        <div className="space-y-4 text-xs text-[#6B6B6B]">
          <p>
            Apakah Anda yakin ingin menghapus mata kuliah{" "}
            <strong className="text-[#0A0A0A]">{deletingCourse?.name}</strong>?
          </p>

          {deleteWarning ? (
            <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-800 space-y-2">
              <p className="font-semibold text-amber-900">Perhatian:</p>
              <p>{deleteWarning}</p>
              <p>
                Jika Anda memilih lanjutkan, relasi tugas terkait akan dilepaskan (menjadi tanpa mata kuliah) tanpa menghapus isi tugas tersebut.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8EC]">
            <Button
              variant="secondary"
              onClick={() => {
                setDeletingCourse(null);
                setDeleteWarning(null);
              }}
            >
              Batal
            </Button>
            {deleteWarning ? (
              <Button variant="destructive" onClick={() => handleDelete(true)}>
                Tetap Hapus & Lepas Relasi Tugas
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => handleDelete(false)}>
                Hapus
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
