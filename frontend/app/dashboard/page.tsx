"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Plus,
  BookOpen,
  ArrowRight,
  Check,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { DashboardSummary, Task } from "@/types";
import { formatDateWIB, formatTimeRemaining } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const data = await api.get<DashboardSummary>("/dashboard/summary");
      setSummary(data);
    } catch (err: any) {
      toast.error("Gagal memuat ringkasan dashboard");
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
      fetchDashboardData();
    }
  }, [user, authLoading, router, fetchDashboardData]);

  const handleToggleComplete = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      toast.success("Status tugas diperbarui");
      fetchDashboardData();
    } catch {
      toast.error("Gagal mengubah status tugas");
    }
  };

  if (authLoading || (loading && !summary)) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex justify-center items-center min-h-[50vh] text-sm text-[#9C9C9C]">
        Memuat dashboard...
      </div>
    );
  }

  const hasOverdue = (summary?.overdue_tasks || 0) > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-8">
      {/* Welcome & Quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
            Halo, {user?.name} 👋
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Berikut ringkasan jadwal deadline dan tugas kuliah aktif Anda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/courses">
            <Button variant="secondary" size="sm">
              <BookOpen className="w-4 h-4 mr-1.5 text-[#6366F1]" />
              Mata Kuliah
            </Button>
          </Link>
          <Link href="/dashboard/tasks">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Kelola Tugas
            </Button>
          </Link>
        </div>
      </div>

      {/* Overdue alert banner if any */}
      {hasOverdue ? (
        <div className="mb-6 p-4 rounded-[12px] bg-red-50/80 border border-red-200 text-red-800 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed flex-1">
            <strong className="font-semibold block text-sm text-red-900 mb-0.5">
              Perhatian: Ada {summary?.overdue_tasks} tugas yang melewati deadline!
            </strong>
            Tugas yang terlambat ditandai warna merah. Selesaikan atau perbarui tenggat waktu agar catatan Anda tetap rapi.
          </div>
          <Link href="/dashboard/tasks?status=pending">
            <Button variant="destructive" size="sm" className="shrink-0 text-xs h-7">
              Lihat Tugas
            </Button>
          </Link>
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#6B6B6B]">Tugas Aktif</span>
            <ListTodo className="w-4 h-4 text-[#6366F1]" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A]">{summary?.active_tasks || 0}</div>
          <span className="text-[11px] text-[#9C9C9C] mt-1 block">Perlu diselesaikan</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#6B6B6B]">Mendekati Deadline</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{summary?.nearing_tasks || 0}</div>
          <span className="text-[11px] text-[#9C9C9C] mt-1 block">Dalam 48 jam ke depan</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#6B6B6B]">Terlambat</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className={`text-2xl font-bold ${hasOverdue ? "text-red-600" : "text-[#0A0A0A]"}`}>
            {summary?.overdue_tasks || 0}
          </div>
          <span className="text-[11px] text-[#9C9C9C] mt-1 block">Melewati batas waktu</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#6B6B6B]">Telah Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{summary?.completed_tasks || 0}</div>
          <span className="text-[11px] text-[#9C9C9C] mt-1 block">Tugas terselesaikan</span>
        </Card>
      </div>

      {/* Upcoming tasks section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0A0A0A]">Tugas Terdekat</h2>
            <p className="text-xs text-[#6B6B6B]">Daftar tugas yang deadline-nya paling dekat</p>
          </div>
          <Link href="/dashboard/tasks" className="text-xs font-medium text-[#6366F1] hover:underline flex items-center gap-1">
            Lihat Semua Tugas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!summary?.upcoming_tasks || summary.upcoming_tasks.length === 0 ? (
          <Card className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-[#9C9C9C] mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Tidak Ada Tugas Pending</h3>
            <p className="text-xs text-[#6B6B6B] mt-1 max-w-sm mx-auto">
              Semua tugas telah diselesaikan atau Anda belum menambahkan tugas baru.
            </p>
            <div className="mt-4">
              <Link href="/dashboard/tasks">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah Tugas Sekarang
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {summary.upcoming_tasks.map((task) => {
              const remaining = formatTimeRemaining(task.deadline_at);
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-white rounded-[12px] border border-[#E8E8EC] transition-all hover:border-zinc-300 shadow-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      title="Tandai selesai"
                      className="mt-0.5 w-5 h-5 rounded-[4px] border border-zinc-300 flex items-center justify-center text-transparent hover:text-zinc-400 hover:border-[#6366F1] transition-colors shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-[#0A0A0A] break-words">
                        {task.title}
                      </h3>

                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {task.course_name ? (
                          <span
                            className="px-2 py-0.5 text-[10px] font-medium rounded-[4px] text-white shrink-0"
                            style={{ backgroundColor: task.course_color || "#6366F1" }}
                          >
                            {task.course_name}
                          </span>
                        ) : null}
                        {task.is_overdue ? (
                          <Badge variant="error" className="text-[10px] py-0 px-1.5">Terlambat</Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-[#6B6B6B] flex-wrap">
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-[#9C9C9C]" />
                          {formatDateWIB(task.deadline_at)}
                        </span>
                        <span className={`font-medium whitespace-nowrap ${remaining.isPast ? "text-red-600" : "text-amber-600"}`}>
                          <Clock className="w-3.5 h-3.5 inline mr-1" />
                          {remaining.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleComplete(task.id)}
                      className="text-xs"
                    >
                      Selesai
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
