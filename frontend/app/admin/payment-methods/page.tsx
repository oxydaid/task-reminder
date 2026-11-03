"use client";

import { useEffect, useState, useRef } from "react";
import {
  CreditCard,
  QrCode,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { paymentMethodsApi, uploadsApi } from "@/lib/api";
import { PaymentMethod, PaymentMethodType, FeeType } from "@/types";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Create / Edit modal state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: PaymentMethodType;
    bank_name: string;
    account_name: string;
    account_number: string;
    qris_image_url: string;
    description: string;
    fee_type: FeeType;
    fee_percentage: number;
    fee_fixed: number;
    is_active: boolean;
    sort_order: number;
  }>({
    name: "",
    type: "bank_transfer",
    bank_name: "",
    account_name: "",
    account_number: "",
    qris_image_url: "",
    description: "",
    fee_type: "fixed",
    fee_percentage: 0,
    fee_fixed: 0,
    is_active: true,
    sort_order: 1,
  });

  const [uploadingQRIS, setUploadingQRIS] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingItem, setDeletingItem] = useState<PaymentMethod | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await paymentMethodsApi.listAdmin();
      setMethods(data || []);
    } catch {
      toast.error("Gagal memuat metode pembayaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      type: "bank_transfer",
      bank_name: "BCA",
      account_name: "",
      account_number: "",
      qris_image_url: "",
      description: "",
      fee_type: "fixed",
      fee_percentage: 0,
      fee_fixed: 0,
      is_active: true,
      sort_order: methods.length + 1,
    });
    setIsOpen(true);
  };

  const openEditModal = (pm: PaymentMethod) => {
    setEditingId(pm.id);
    setFormData({
      name: pm.name,
      type: pm.type,
      bank_name: pm.bank_name || "",
      account_name: pm.account_name || "",
      account_number: pm.account_number || "",
      qris_image_url: pm.qris_image_url || "",
      description: pm.description || "",
      fee_type: pm.fee_type || "fixed",
      fee_percentage: pm.fee_percentage || 0,
      fee_fixed: pm.fee_fixed || 0,
      is_active: pm.is_active,
      sort_order: pm.sort_order || 1,
    });
    setIsOpen(true);
  };

  const handleQRISUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQRIS(true);
    try {
      const res = await uploadsApi.uploadQRIS(file);
      if (res && res.url) {
        setFormData((prev) => ({ ...prev, qris_image_url: res.url }));
        toast.success("Foto QRIS berhasil diunggah!");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah foto QRIS");
    } finally {
      setUploadingQRIS(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama metode pembayaran wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await paymentMethodsApi.update(editingId, formData);
        toast.success("Metode pembayaran berhasil diperbarui");
      } else {
        await paymentMethodsApi.create(formData);
        toast.success("Metode pembayaran berhasil ditambahkan");
      }
      setIsOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan metode pembayaran");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      await paymentMethodsApi.delete(deletingItem.id);
      toast.success("Metode pembayaran berhasil dihapus/dinonaktifkan");
      setDeletingItem(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus metode pembayaran");
    } finally {
      setDeleting(false);
    }
  };

  const getFeeDescription = (pm: PaymentMethod) => {
    if (pm.fee_type === "fixed") {
      return pm.fee_fixed === 0 ? "Bebas Biaya (Rp 0)" : `+${formatRupiah(pm.fee_fixed)}`;
    }
    if (pm.fee_type === "percentage") {
      return `+${pm.fee_percentage}%`;
    }
    return `+${formatRupiah(pm.fee_fixed)} & +${pm.fee_percentage}%`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
            Metode Pembayaran Manual
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
            Konfigurasi nomor rekening bank transfer, gambar barcode QRIS, dan aturan biaya layanan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 font-semibold text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Metode</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Payment Methods Grid */}
      {loading ? (
        <div className="text-center py-16 text-xs text-[#9C9C9C]">
          Memuat data metode pembayaran...
        </div>
      ) : !methods.length ? (
        <div className="p-8 text-center rounded-[12px] bg-white border border-[#E8E8EC] space-y-3">
          <CreditCard className="w-10 h-10 text-zinc-300 mx-auto" />
          <div className="text-xs text-[#6B6B6B]">
            Belum ada metode pembayaran yang dikonfigurasi.
          </div>
          <Button size="sm" variant="primary" onClick={openCreateModal}>
            Tambah Sekarang
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {methods.map((pm) => {
            const isBank = pm.type === "bank_transfer";
            return (
              <Card
                key={pm.id}
                className={`p-0 overflow-hidden flex flex-col justify-between transition-all ${
                  !pm.is_active ? "opacity-60 bg-zinc-50" : ""
                }`}
              >
                <div className="p-4 sm:p-5 space-y-3.5 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${
                          isBank
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : "bg-purple-50 text-purple-600 border border-purple-100"
                        }`}
                      >
                        {isBank ? <CreditCard className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-[#0A0A0A] truncate">{pm.name}</h3>
                        <div className="text-[11px] text-[#6B6B6B]">
                          {isBank ? "Transfer Antar Bank" : "QRIS All Payment"}
                        </div>
                      </div>
                    </div>

                    <Badge variant={pm.is_active ? "success" : "secondary"} className="text-[10px] shrink-0">
                      {pm.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>

                  {/* Details */}
                  {isBank ? (
                    <div className="bg-zinc-50 p-3 rounded-[8px] border border-zinc-200/80 space-y-1 text-xs">
                      <div className="text-[#6B6B6B] flex items-center justify-between">
                        <span>Bank:</span>
                        <strong className="text-[#0A0A0A]">{pm.bank_name || "-"}</strong>
                      </div>
                      <div className="font-mono font-bold text-sm text-[#0A0A0A] tracking-wider py-0.5">
                        {pm.account_number || "-"}
                      </div>
                      <div className="text-[11px] text-[#6B6B6B]">
                        Atas Nama: <strong className="text-[#0A0A0A]">{pm.account_name || "-"}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-50 p-3 rounded-[8px] border border-zinc-200/80 flex items-center gap-3 text-xs">
                      {pm.qris_image_url ? (
                        <a
                          href={pm.qris_image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-14 h-14 rounded bg-white border border-zinc-200 overflow-hidden shrink-0 block hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={pm.qris_image_url}
                            alt="QRIS"
                            className="w-full h-full object-contain"
                          />
                        </a>
                      ) : (
                        <div className="w-14 h-14 rounded bg-zinc-200 text-zinc-400 flex items-center justify-center shrink-0">
                          <QrCode className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-[#0A0A0A] truncate">{pm.account_name || "QRIS Official"}</div>
                        <div className="text-[10px] text-[#6B6B6B] mt-0.5">
                          {pm.qris_image_url ? "Barcode QRIS Terpasang" : "Belum ada barcode QRIS"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fee info */}
                  <div className="pt-2 border-t border-[#E8E8EC] flex items-center justify-between text-xs text-[#6B6B6B]">
                    <span>Biaya Layanan:</span>
                    <span className="font-bold text-[#0A0A0A]">{getFeeDescription(pm)}</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-zinc-50 border-t border-[#E8E8EC] flex items-center justify-between">
                  <span className="text-[11px] text-[#9C9C9C]">Urutan #{pm.sort_order}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => openEditModal(pm)}
                      className="text-xs text-[#6366F1]"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setDeletingItem(pm)}
                      className="text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingId ? "Ubah Metode Pembayaran" : "Tambah Metode Pembayaran Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tentukan detail rekening bank atau gambar barcode QRIS yang akan ditampilkan kepada pengguna saat checkout.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
            {/* Type selector */}
            <div className="space-y-1">
              <label className="font-semibold text-[#0A0A0A]">Tipe Metode Pembayaran:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      type: "bank_transfer",
                      name: prev.name || "Transfer Bank BCA",
                    }))
                  }
                  className={`p-2.5 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    formData.type === "bank_transfer"
                      ? "border-[#6366F1] bg-indigo-50/50 text-[#6366F1]"
                      : "border-[#E8E8EC] text-[#6B6B6B]"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Transfer Bank</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      type: "qris",
                      name: prev.name || "QRIS All Payment",
                    }))
                  }
                  className={`p-2.5 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    formData.type === "qris"
                      ? "border-[#6366F1] bg-indigo-50/50 text-[#6366F1]"
                      : "border-[#E8E8EC] text-[#6B6B6B]"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>QRIS Barcode</span>
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="font-semibold text-[#0A0A0A]">Nama Tampilan:</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Misal: Bank BCA / QRIS GoPay, OVO, Dana"
                className="w-full px-3 py-2 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] text-xs"
              />
            </div>

            {/* Bank Transfer specific fields */}
            {formData.type === "bank_transfer" ? (
              <div className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200/80 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#0A0A0A]">Nama Bank:</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="BCA / Mandiri / BNI"
                      className="w-full px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-[#0A0A0A]">Nomor Rekening:</label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder="1234567890"
                      className="w-full px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#0A0A0A]">Atas Nama Rekening:</label>
                  <input
                    type="text"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="Nama Pemilik Rekening"
                    className="w-full px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs"
                  />
                </div>
              </div>
            ) : (
              /* QRIS specific fields */
              <div className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200/80 space-y-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#0A0A0A]">Nama Merchant / Pemilik QRIS:</label>
                  <input
                    type="text"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="Task Reminder Official / Nama Anda"
                    className="w-full px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#0A0A0A]">Gambar Barcode QRIS:</label>
                  <div className="flex items-center gap-3">
                    {formData.qris_image_url ? (
                      <img
                        src={formData.qris_image_url}
                        alt="Preview QRIS"
                        className="w-16 h-16 object-contain rounded border border-zinc-200 bg-white"
                      />
                    ) : null}
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleQRISUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        isLoading={uploadingQRIS}
                        className="text-xs"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        {formData.qris_image_url ? "Ganti Gambar QRIS" : "Unggah Gambar QRIS"}
                      </Button>
                      <div className="text-[10px] text-[#9C9C9C] mt-1">
                        Format PNG/JPG/WebP, maksimal 5MB.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fee Settings */}
            <div className="space-y-2">
              <label className="font-semibold text-[#0A0A0A]">Aturan Biaya Layanan:</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-[#6B6B6B]">Tipe Biaya:</span>
                  <select
                    value={formData.fee_type}
                    onChange={(e) => setFormData({ ...formData, fee_type: e.target.value as FeeType })}
                    className="w-full px-2 py-1.5 rounded-[6px] border border-[#E8E8EC] bg-white text-xs"
                  >
                    <option value="fixed">Fixed (Nominal Rp)</option>
                    <option value="percentage">Persentase (%)</option>
                    <option value="mixed">Mixed (Rp + %)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-[#6B6B6B]">Biaya Tetap (Rp):</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.fee_fixed}
                    onChange={(e) => setFormData({ ...formData, fee_fixed: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 rounded-[6px] border border-[#E8E8EC] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-[#6B6B6B]">Biaya Persen (%):</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.fee_percentage}
                    onChange={(e) => setFormData({ ...formData, fee_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 rounded-[6px] border border-[#E8E8EC] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Status & Sort Order */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="font-semibold text-[#0A0A0A]">Urutan Tampilan:</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-zinc-300 text-[#6366F1] focus:ring-[#6366F1]"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-semibold text-[#0A0A0A] cursor-pointer">
                  Aktifkan Metode Ini
                </label>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={submitting} className="font-bold text-xs">
                {editingId ? "Simpan Perubahan" : "Tambahkan Metode"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deletingItem)} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Hapus Metode Pembayaran
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin menghapus metode pembayaran <strong>{deletingItem?.name}</strong>? Jika metode sudah pernah digunakan pada transaksi, metode akan dinonaktifkan secara otomatis agar data historis tetap aman.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeletingItem(null)}>
              Batal
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} isLoading={deleting} className="font-bold text-xs">
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
