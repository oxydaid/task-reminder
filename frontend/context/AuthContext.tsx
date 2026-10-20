"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (whatsapp_number: string, password: string) => Promise<User>;
  register: (name: string, whatsapp_number: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const data = await api.get<User>("/auth/me");
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (whatsapp_number: string, password: string): Promise<User> => {
      const res = await api.post<{ user: User; token: string }>("/auth/login", {
        whatsapp_number,
        password,
      });
      setUser(res.user);
      return res.user;
    },
    []
  );

  const register = useCallback(
    async (name: string, whatsapp_number: string, password: string): Promise<User> => {
      const res = await api.post<{ user: User; token: string }>("/auth/register", {
        name,
        whatsapp_number,
        password,
      });
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const isAdmin = useMemo(() => user?.role === "admin", [user?.role]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, isAdmin, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
