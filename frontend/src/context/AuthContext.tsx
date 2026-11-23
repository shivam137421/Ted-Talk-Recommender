import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase.js";
import { api } from "../services/api.js";
import { UserProfile } from "../types/talk.js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, fullName?: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentSession?: Session | null) => {
    const s = currentSession !== undefined ? currentSession : session;
    if (!s) {
      setProfile(null);
      return;
    }
    try {
      const data = await api.getProfile();
      if (data?.profile) {
        setProfile(data.profile);
      } else {
        const meta = s.user?.user_metadata || {};
        const fallbackUsername = meta.username || meta.user_name || s.user?.email?.split("@")[0] || "";
        setProfile({
          id: s.user.id,
          username: fallbackUsername,
          full_name: meta.full_name || meta.name || "",
          avatar_url: meta.avatar_url || meta.picture || "",
          bio: "",
          created_at: s.user.created_at,
        });
      }
    } catch {
      const meta = s.user?.user_metadata || {};
      const fallbackUsername = meta.username || meta.user_name || s.user?.email?.split("@")[0] || "";
      setProfile({
        id: s.user.id,
        username: fallbackUsername,
        full_name: meta.full_name || meta.name || "",
        avatar_url: meta.avatar_url || meta.picture || "",
        bio: "",
        created_at: s.user.created_at,
      });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      if (session) {
        fetchProfile(session);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        if (window.location.pathname !== "/reset-password") {
          window.location.replace("/reset-password");
        }
      }
      setSession(session);
      setUser(session?.user || null);
      if (session) {
        await fetchProfile(session);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
    } catch (netErr: any) {
      throw new Error(
        "Unable to connect to TalkWise server. Please ensure the backend is running."
      );
    }

    let data: any = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // Non-JSON response (e.g. proxy HTML error)
      }
    }

    if (!res.ok) {
      const errMsg =
        data?.message ||
        data?.error ||
        (res.status === 504 || res.status === 502
          ? "Backend service connection timed out. Please try again."
          : `Login failed (${res.status}: ${res.statusText || "Server error"})`);
      throw new Error(errMsg);
    }

    if (!data?.session?.access_token || !data?.session?.refresh_token) {
      throw new Error("Authentication response was missing session tokens.");
    }

    // Set Supabase session in browser
    const { error: sessionErr } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    if (sessionErr) {
      throw new Error(sessionErr.message || "Failed to initialize user session.");
    }

    if (data.user?.profile) {
      setProfile(data.user.profile);
    } else {
      await fetchProfile();
    }
  };

  const signUp = async (email: string, password: string, username: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase().trim(),
          full_name: fullName?.trim() || "",
        },
      },
    });
    if (error) throw error;
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("An account with this email already exists. Please log in or reset your password.");
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        login,
        signUp,
        verifyOtp,
        signInWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

