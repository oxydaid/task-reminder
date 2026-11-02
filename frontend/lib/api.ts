import {
  AdminNotificationSettings,
  PaymentMethod,
  Plan,
  Subscription,
  Transaction,
  User,
  UserUsage,
} from "@/types";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code = "UNKNOWN_ERROR", status = 500, details?: any) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiRequestOptions extends RequestInit {
  cacheTtl?: number;
  skipCache?: boolean;
}

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheItem>();

function invalidateRelatedCache(path: string) {
  if (path.includes("/plans")) {
    api.clearCache("/plans");
  }
  if (path.includes("/tasks")) {
    api.clearCache("/tasks");
    api.clearCache("/dashboard/summary");
    api.clearCache("/subscriptions/current");
  }
  if (path.includes("/courses")) {
    api.clearCache("/courses");
    api.clearCache("/dashboard/summary");
    api.clearCache("/subscriptions/current");
  }
  if (path.includes("/settings")) {
    api.clearCache("/settings");
  }
  if (path.includes("/subscriptions") || path.includes("/transactions")) {
    api.clearCache("/subscriptions");
    api.clearCache("/transactions");
    api.clearCache("/dashboard/summary");
  }
  if (path.includes("/payment-methods")) {
    api.clearCache("/payment-methods");
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, "NETWORK_ERROR", response.status);
    }
    return {} as T;
  }

  if (!response.ok || json.success === false) {
    const errorMsg = json.error?.message || json.message || "Terjadi kesalahan pada server";
    const errorCode = json.error?.code || `HTTP_${response.status}`;
    throw new ApiError(errorMsg, errorCode, response.status, json.error?.details);
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  get: async <T = any>(path: string, options?: ApiRequestOptions): Promise<T> => {
    const ttl = options?.cacheTtl;
    const skipCache = options?.skipCache;

    if (ttl && !skipCache) {
      const cached = memoryCache.get(path);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data as T;
      }
    }

    const res = await request<T>(path, { ...options, method: "GET" });

    if (ttl && !skipCache) {
      memoryCache.set(path, { data: res, timestamp: Date.now() });
    }

    return res;
  },

  getCached: async <T = any>(path: string, ttlMs: number = 5 * 60 * 1000): Promise<T> => {
    return api.get<T>(path, { cacheTtl: ttlMs });
  },

  peekCache: <T = any>(path: string): T | undefined => {
    const cached = memoryCache.get(path);
    return cached?.data as T | undefined;
  },

  setCache: <T = any>(path: string, data: T) => {
    memoryCache.set(path, { data, timestamp: Date.now() });
  },

  clearCache: (pathPrefix?: string) => {
    if (!pathPrefix) {
      memoryCache.clear();
      return;
    }
    for (const key of memoryCache.keys()) {
      if (key.startsWith(pathPrefix)) {
        memoryCache.delete(key);
      }
    }
  },

  post: async <T = any>(path: string, body?: any, options?: RequestInit) => {
    invalidateRelatedCache(path);
    return request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put: async <T = any>(path: string, body?: any, options?: RequestInit) => {
    invalidateRelatedCache(path);
    return request<T>(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  patch: async <T = any>(path: string, body?: any, options?: RequestInit) => {
    invalidateRelatedCache(path);
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  delete: async <T = any>(path: string, options?: RequestInit) => {
    invalidateRelatedCache(path);
    return request<T>(path, { ...options, method: "DELETE" });
  },
};

// Strongly typed domain services
export const subscriptionsApi = {
  getCurrent: () => api.get<UserUsage>("/subscriptions/current"),
  getHistory: () => api.get<any[]>("/subscriptions/history"),
  getDowngradeStatus: () => api.get<{
    plan_name: string;
    notification_limit: number;
    active_reminder_count: number;
    is_over_limit: boolean;
    tasks: { id: string; title: string; reminder_enabled: boolean; deadline_at: string }[];
  }>("/subscriptions/downgrade-status"),
  selectActiveReminders: (taskIds: string[]) =>
    api.post("/subscriptions/select-active", { task_ids: taskIds }),
};

export const transactionsApi = {
  checkout: (data: { plan_id: string; payment_method_id: string; idempotency_key?: string }) =>
    api.post<{ id: string; code: string; total_amount: number; status: string; expires_at: string }>(
      "/transactions/checkout",
      data
    ),
  list: () => api.get<Transaction[]>("/transactions"),
  getById: (id: string) => api.get<Transaction>(`/transactions/${id}`),
  uploadProof: (
    id: string,
    data: { file_path: string; file_name: string; file_size: number; mime_type: string; notes?: string }
  ) => api.post(`/transactions/${id}/proof`, data),
  cancel: (id: string) => api.post(`/transactions/${id}/cancel`),
};

export const paymentMethodsApi = {
  listPublic: () => api.getCached<PaymentMethod[]>("/payment-methods", 60 * 1000),
  listAdmin: () => api.get<PaymentMethod[]>("/admin/payment-methods"),
  create: (data: Partial<PaymentMethod>) => api.post("/admin/payment-methods", data),
  update: (id: string, data: Partial<PaymentMethod>) => api.put(`/admin/payment-methods/${id}`, data),
  delete: (id: string) => api.delete(`/admin/payment-methods/${id}`),
};

export const uploadsApi = {
  uploadProof: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ url: string; file_name: string; file_size: number }>("/uploads/proof", formData);
  },
  uploadQRIS: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<{ url: string; file_name: string; file_size: number }>("/admin/payment-methods/upload-qris", formData);
  },
};

export const adminSubscriptionsApi = {
  list: (params?: { status?: string; plan_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.plan_id) query.set("plan_id", params.plan_id);
    const qs = query.toString();
    return api.get<any[]>(`/admin/subscriptions${qs ? `?${qs}` : ""}`);
  },
  grantTrial: (userId: string, data: { plan_id: string; duration_days?: number; reason?: string }) =>
    api.post(`/admin/users/${userId}/trial`, data),
  activate: (userId: string, data: { plan_id: string; duration_months?: number; reason?: string }) =>
    api.post(`/admin/users/${userId}/subscription/activate`, data),
  cancel: (userId: string, data?: { reason?: string }) =>
    api.post(`/admin/users/${userId}/subscription/cancel`, data),
};

export const adminTransactionsApi = {
  list: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return api.get<Transaction[]>(`/admin/transactions${qs ? `?${qs}` : ""}`);
  },
  getById: (id: string) => api.get<Transaction>(`/admin/transactions/${id}`),
  approve: (id: string, data?: { notes?: string }) => api.post(`/admin/transactions/${id}/approve`, data),
  reject: (id: string, data: { reason: string }) => api.post(`/admin/transactions/${id}/reject`, data),
};

export const adminSettingsApi = {
  getNotifications: () => api.get<AdminNotificationSettings>("/admin/settings/notifications"),
  updateNotifications: (data: { receive_transaction_notification: boolean; receive_payment_proof_notification: boolean }) =>
    api.put("/admin/settings/notifications", data),
};
