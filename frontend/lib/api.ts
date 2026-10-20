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

class ApiError extends Error {
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
  cacheTtl?: number; // Cache validity duration in milliseconds
  skipCache?: boolean;
}

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
}

// In-memory client cache for lightning-fast page transitions without repeated fetching
const memoryCache = new Map<string, CacheItem>();

function invalidateRelatedCache(path: string) {
  if (path.includes("/plans")) {
    api.clearCache("/plans");
  }
  if (path.includes("/tasks")) {
    api.clearCache("/tasks");
    api.clearCache("/dashboard/summary");
  }
  if (path.includes("/courses")) {
    api.clearCache("/courses");
    api.clearCache("/dashboard/summary");
  }
  if (path.includes("/settings")) {
    api.clearCache("/settings");
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
