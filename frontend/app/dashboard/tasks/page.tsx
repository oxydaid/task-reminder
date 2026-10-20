"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Check,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  CheckCircle2,
  Filter,
  SlidersHorizontal,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Task, Course, TaskPriority, TaskStatus } from "@/types";
import { formatDateWIB, formatTimeRemaining } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";

export default function TasksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (statusFilter !== "all") count++;
    if (courseFilter !== "all") count++;
    if (priorityFilter !== "all") count++;
    return count;
  }, [search, statusFilter, courseFilter, priorityFilter]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setCourseFilter("all");
    setPriorityFilter("all");
    setCurrentPage(1);
  }, []);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    course_id: "",
    deadline_at: "",
    priority: "medium" as TaskPriority,
    reminder_enabled: true,
    reminder_offset_minutes: 2880,
  });
  const [submitting, setSubmitting] = useState(false);

  // Parallel fetch to eliminate waterfalls per vercel best practices
  const loadData = useCallback(async () => {
    try {
      const [tasksRes, coursesRes] = await Promise.all([
        api.get<Task[]>("/tasks"),
        api.get<Course[]>("/courses"),
      ]);
      setTasks(tasksRes);
      setCourses(coursesRes);
    } catch {
      toast.error("Gagal memuat data tugas");
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
      loadData();
    }
  }, [user, authLoading, router, loadData]);

  // Derived state: calculate filtered tasks during render
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (courseFilter !== "all" && t.course_id !== courseFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesCourse = t.course_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCourse) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, courseFilter, priorityFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / ITEMS_PER_PAGE));

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Reset to page 1 when search or filters change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };
  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };
  const handleCourseChange = (val: string) => {
    setCourseFilter(val);
    setCurrentPage(1);
  };
  const handlePriorityChange = (val: string) => {
    setPriorityFilter(val);
    setCurrentPage(1);
  };

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTasks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTasks, currentPage, ITEMS_PER_PAGE]);

  const handleOpenCreate = () => {
    // Default deadline: tomorrow at 23:59
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10) + "T23:59";

    setFormData({
      title: "",
      description: "",
      course_id: courses[0]?.id || "",
      deadline_at: dateStr,
      priority: "medium",
      reminder_enabled: true,
      reminder_offset_minutes: 2880,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    // Convert deadline ISO to local format YYYY-MM-DDTHH:mm
    const date = new Date(task.deadline_at);
    const localIso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setFormData({
      title: task.title,
      description: task.description || "",
      course_id: task.course_id || "",
      deadline_at: localIso,
      priority: task.priority,
      reminder_enabled: task.reminder_enabled,
      reminder_offset_minutes: task.reminder_offset_minutes || 2880,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Judul tugas wajib diisi");
      return;
    }
    if (!formData.deadline_at) {
      toast.error("Deadline tugas wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const deadlineUTC = new Date(formData.deadline_at).toISOString();
      await api.post("/tasks", {
        title: formData.title.trim(),
        description: formData.description.trim(),
        course_id: formData.course_id ? formData.course_id : null,
        deadline_at: deadlineUTC,
        priority: formData.priority,
        reminder_enabled: formData.reminder_enabled,
        reminder_offset_minutes: Number(formData.reminder_offset_minutes),
      });

      toast.success("Tugas berhasil ditambahkan!");
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat tugas");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!formData.title.trim()) {
      toast.error("Judul tugas wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const deadlineUTC = new Date(formData.deadline_at).toISOString();
      await api.put(`/tasks/${editingTask.id}`, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        course_id: formData.course_id ? formData.course_id : null,
        deadline_at: deadlineUTC,
        priority: formData.priority,
        reminder_enabled: formData.reminder_enabled,
        reminder_offset_minutes: Number(formData.reminder_offset_minutes),
      });

      toast.success("Tugas berhasil diperbarui!");
      setEditingTask(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui tugas");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTask) return;
    try {
      await api.delete(`/tasks/${deletingTask.id}`);
      toast.success("Tugas berhasil dihapus");
      setDeletingTask(null);
      loadData();
    } catch {
      toast.error("Gagal menghapus tugas");
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      loadData();
    } catch {
      toast.error("Gagal mengubah status tugas");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 flex justify-center text-sm text-[#9C9C9C]">
        Memuat daftar tugas...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">Daftar Tugas</h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Kelola seluruh penugasan kuliah dan pantau sisa waktu penyelesaian.
          </p>
        </div>

        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Tambah Tugas
        </Button>
      </div>

      {/* Desktop Filter and Search Bar */}
      <Card className="mb-6 p-4 hidden md:block">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
            <Input
              type="text"
              placeholder="Cari judul tugas..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-xs"
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

          {/* Status */}
          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Belum Selesai (Pending)</option>
            <option value="completed">Sudah Selesai</option>
          </Select>

          {/* Course */}
          <Select
            value={courseFilter}
            onChange={(e) => handleCourseChange(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="all">Semua Mata Kuliah</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.code ? `(${c.code})` : ""}
              </option>
            ))}
          </Select>

          {/* Priority */}
          <Select
            value={priorityFilter}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="all">Semua Prioritas</option>
            <option value="low">Rendah (Low)</option>
            <option value="medium">Sedang (Medium)</option>
            <option value="high">Tinggi (High)</option>
          </Select>
        </div>
      </Card>

      {/* Mobile Active Filter Bar & Counter */}
      <div className="md:hidden mb-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-[#6B6B6B] font-medium">
            Menampilkan <strong className="text-[#0A0A0A]">{filteredTasks.length}</strong> tugas
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

      {/* Mobile Floating Action Button for Filter & Search (above bottom navbar) */}
      <button
        type="button"
        onClick={() => setIsFilterModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 bg-[#6366F1] text-white px-4 py-3 rounded-full shadow-lg shadow-indigo-500/30 hover:bg-[#4F46E5] active:scale-95 transition-all text-xs font-semibold"
        aria-label="Cari dan Filter Tugas"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span>Filter & Cari</span>
        {activeFilterCount > 0 ? (
          <span className="w-5 h-5 bg-white text-[#6366F1] rounded-full text-[10px] font-bold flex items-center justify-center">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {/* Mobile Filter Modal Dialog */}
      <Dialog
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        title="Cari & Filter Tugas"
        description="Temukan tugas berdasarkan judul, status, mata kuliah, atau prioritas."
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Kata Kunci Judul</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
              <Input
                type="text"
                placeholder="Cari judul tugas..."
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
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Status Pengerjaan</label>
            <Select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Belum Selesai (Pending)</option>
              <option value="completed">Sudah Selesai</option>
            </Select>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Mata Kuliah</label>
            <Select
              value={courseFilter}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="all">Semua Mata Kuliah</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1.5">Tingkat Prioritas</label>
            <Select
              value={priorityFilter}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="all">Semua Prioritas</option>
              <option value="low">Rendah (Low)</option>
              <option value="medium">Sedang (Medium)</option>
              <option value="high">Tinggi (High)</option>
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
              Terapkan ({filteredTasks.length} Hasil)
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-[#9C9C9C] mb-3">
            <CheckCircle2 className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Tidak Ada Tugas Ditemukan</h3>
          <p className="text-xs text-[#6B6B6B] mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "all" || courseFilter !== "all" || priorityFilter !== "all"
              ? "Coba ubah kata kunci pencarian atau filter yang Anda pilih."
              : "Belum ada tugas kuliah yang dicatat. Buat tugas pertama Anda sekarang!"}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {activeFilterCount > 0 ? (
              <Button size="sm" variant="outline" onClick={resetFilters}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset Filter
              </Button>
            ) : null}
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Buat Tugas Baru
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedTasks.map((task) => {
            const isCompleted = task.status === "completed";
            const remaining = formatTimeRemaining(task.deadline_at);

            return (
              <div
                key={task.id}
                className={`p-3.5 sm:p-4 bg-white rounded-[12px] border transition-all ${
                  isCompleted
                    ? "border-zinc-200 bg-zinc-50/50 opacity-75"
                    : task.is_overdue
                    ? "border-red-200 shadow-xs"
                    : "border-[#E8E8EC] shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    {/* Checkbox button */}
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      className={`mt-0.5 w-5 h-5 rounded-[4px] border flex items-center justify-center transition-colors shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-zinc-300 hover:border-[#6366F1] text-transparent hover:text-zinc-300"
                      }`}
                      title={isCompleted ? "Tandai belum selesai" : "Tandai selesai"}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    <div className="min-w-0 flex-1">
                      {/* Title on its own clean line */}
                      <h3
                        className={`font-semibold text-sm leading-snug break-words ${
                          isCompleted ? "line-through text-[#6B6B6B]" : "text-[#0A0A0A]"
                        }`}
                      >
                        {task.title}
                      </h3>

                      {/* Badges in a tidy horizontal tag row */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {task.course_name ? (
                          <span
                            className="px-2 py-0.5 text-[10px] font-medium rounded-[4px] text-white shrink-0"
                            style={{ backgroundColor: task.course_color || "#6366F1" }}
                          >
                            {task.course_name}
                          </span>
                        ) : null}

                        {task.priority === "high" ? (
                          <Badge variant="error" className="text-[10px] py-0 px-1.5">Prioritas Tinggi</Badge>
                        ) : task.priority === "low" ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">Rendah</Badge>
                        ) : null}

                        {task.is_overdue && !isCompleted ? (
                          <Badge variant="error" className="text-[10px] py-0 px-1.5">Terlambat</Badge>
                        ) : null}

                        {isCompleted ? (
                          <Badge variant="success" className="text-[10px] py-0 px-1.5">Selesai</Badge>
                        ) : null}
                      </div>

                      {task.description ? (
                        <p className="text-xs text-[#6B6B6B] mt-1.5 line-clamp-2 break-words">
                          {task.description}
                        </p>
                      ) : null}

                      {/* Date & Deadline info with wrap protection */}
                      <div className="flex items-center gap-x-3 gap-y-1 mt-2 text-xs text-[#6B6B6B] flex-wrap">
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-[#9C9C9C]" />
                          {formatDateWIB(task.deadline_at)}
                        </span>

                        {!isCompleted ? (
                          <span
                            className={`flex items-center gap-1 font-medium whitespace-nowrap ${
                              remaining.isPast ? "text-red-600" : "text-amber-600"
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {remaining.label}
                          </span>
                        ) : null}

                        {task.reminder_enabled ? (
                          <span className="text-[11px] text-[#9C9C9C] whitespace-nowrap">
                            🔔 WA H-{Math.round(task.reminder_offset_minutes / 1440)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => handleOpenEdit(task)}
                      className="p-1.5 rounded-[6px] text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-zinc-100 transition-colors"
                      title="Edit Tugas"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingTask(task)}
                      className="p-1.5 rounded-[6px] text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      title="Hapus Tugas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredTasks.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
        itemName="tugas"
        className="mt-6"
      />

      {/* Create Task Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Tambah Tugas Baru"
        description="Lengkapi detail tugas kuliah dan batas waktu pengerjaan"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Judul Tugas <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: Makalah Sistem Informasi Akuntansi"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Mata Kuliah</label>
            <Select
              value={formData.course_id}
              onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
            >
              <option value="">-- Pilih Mata Kuliah (Opsional) --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Tenggat Waktu (Deadline) <span className="text-red-500">*</span>
            </label>
            <Input
              type="datetime-local"
              value={formData.deadline_at}
              onChange={(e) => setFormData({ ...formData, deadline_at: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Prioritas</label>
              <Select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as TaskPriority })
                }
              >
                <option value="low">Rendah (Low)</option>
                <option value="medium">Sedang (Medium)</option>
                <option value="high">Tinggi (High)</option>
              </Select>
            </div>

            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Jarak Pengingat</label>
              <Select
                value={formData.reminder_offset_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, reminder_offset_minutes: Number(e.target.value) })
                }
              >
                <option value={1440}>1 hari sebelum (H-1)</option>
                <option value={2880}>2 hari sebelum (H-2 / Default)</option>
                <option value={4320}>3 hari sebelum (H-3)</option>
                <option value={720}>12 jam sebelum</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Deskripsi Tambahan</label>
            <Textarea
              placeholder="Catatan pengerjaan, format berkas, atau tautan pengumpulan..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="reminder_enabled"
              checked={formData.reminder_enabled}
              onChange={(e) =>
                setFormData({ ...formData, reminder_enabled: e.target.checked })
              }
              className="w-4 h-4 rounded text-[#6366F1] focus:ring-[#6366F1]"
            />
            <label htmlFor="reminder_enabled" className="text-xs text-[#0A0A0A] cursor-pointer">
              Kirim pengingat otomatis ke WhatsApp
            </label>
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
              Simpan Tugas
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        title="Ubah Tugas"
        description="Perbarui informasi atau tenggat tugas"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Judul Tugas <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Mata Kuliah</label>
            <Select
              value={formData.course_id}
              onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
            >
              <option value="">-- Tanpa Mata Kuliah --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">
              Tenggat Waktu (Deadline) <span className="text-red-500">*</span>
            </label>
            <Input
              type="datetime-local"
              value={formData.deadline_at}
              onChange={(e) => setFormData({ ...formData, deadline_at: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Prioritas</label>
              <Select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as TaskPriority })
                }
              >
                <option value="low">Rendah (Low)</option>
                <option value="medium">Sedang (Medium)</option>
                <option value="high">Tinggi (High)</option>
              </Select>
            </div>

            <div>
              <label className="block font-medium text-[#0A0A0A] mb-1">Jarak Pengingat</label>
              <Select
                value={formData.reminder_offset_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, reminder_offset_minutes: Number(e.target.value) })
                }
              >
                <option value={1440}>1 hari sebelum (H-1)</option>
                <option value={2880}>2 hari sebelum (H-2 / Default)</option>
                <option value={4320}>3 hari sebelum (H-3)</option>
                <option value={720}>12 jam sebelum</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#0A0A0A] mb-1">Deskripsi Tambahan</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="edit_reminder_enabled"
              checked={formData.reminder_enabled}
              onChange={(e) =>
                setFormData({ ...formData, reminder_enabled: e.target.checked })
              }
              className="w-4 h-4 rounded text-[#6366F1]"
            />
            <label htmlFor="edit_reminder_enabled" className="text-xs text-[#0A0A0A] cursor-pointer">
              Aktifkan pengingat WhatsApp
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingTask(null)}
            >
              Batal
            </Button>
            <Button type="submit" isLoading={submitting}>
              Perbarui Tugas
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingTask)}
        onOpenChange={(open) => {
          if (!open) setDeletingTask(null);
        }}
        title="Hapus Tugas"
        description="Apakah Anda yakin ingin menghapus tugas ini?"
      >
        <div className="space-y-4 text-xs text-[#6B6B6B]">
          <p>
            Tugas <strong className="text-[#0A0A0A]">{deletingTask?.title}</strong> dan jadwal
            pengingat terkait akan dibatalkan secara permanen.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8EC]">
            <Button variant="secondary" onClick={() => setDeletingTask(null)}>
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
