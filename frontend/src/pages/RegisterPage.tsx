import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../services/api.js";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

export const RegisterPage: React.FC = () => {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"available" | "taken" | null>(null);

  const handleUsernameBlur = async () => {
    const usernameClean = username.trim().toLowerCase();
    if (!usernameClean || !/^[a-z0-9_]{3,30}$/.test(usernameClean)) {
      setUsernameStatus(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await api.checkUsername(usernameClean);
      if (res.available) {
        setUsernameStatus("available");
      } else {
        setUsernameStatus("taken");
        setError("This username is already taken. Please choose another username.");
      }
    } catch {
      setUsernameStatus(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || "Google sign-up failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Mandatory Full Name validation
    const fullNameClean = fullName.trim();
    if (!fullNameClean || fullNameClean.length < 2) {
      setError("Full name is required (minimum 2 characters).");
      return;
    }

    // 2. Validate username format
    const usernameClean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(usernameClean)) {
      setError("Username must be 3-30 characters with lowercase letters, numbers, or underscores only.");
      return;
    }

    // 3. Password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      // 4. Verify username availability before signup
      const checkRes = await api.checkUsername(usernameClean);
      if (!checkRes.available) {
        setError("This username is already taken. Please choose another username.");
        setUsernameStatus("taken");
        setLoading(false);
        return;
      }

      await signUp(email.trim(), password, usernameClean, fullNameClean);
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      const msg = (err.message || "").toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("user_already_exists") ||
        msg.includes("an account with this email")
      ) {
        setError("An account with this email already exists. Please log in or reset your password.");
      } else if (
        msg.includes("username") ||
        msg.includes("unique") ||
        msg.includes("profiles_username_key")
      ) {
        setError("This username is already taken. Please choose another username.");
        setUsernameStatus("taken");
      } else {
        setError(err.message || "Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-[#E5E2DC] rounded-2xl p-8 space-y-6 shadow-sm">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block font-serif text-3xl font-bold text-[#1A1A1A]">
            TalkWise<span className="text-[#C8102E]">.</span>
          </Link>
          <h2 className="text-sm text-[#6B6860]">
            Create your account to unlock personalized recommendations
          </h2>
        </div>

        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#1A1A1A]">
                Username
              </label>
              {checkingUsername ? (
                <span className="text-[10px] text-[#6B6860]">Checking availability...</span>
              ) : usernameStatus === "available" ? (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Username available</span>
                </span>
              ) : usernameStatus === "taken" ? (
                <span className="text-[10px] text-red-600 font-semibold">Username taken</span>
              ) : null}
            </div>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameStatus(null);
              }}
              onBlur={handleUsernameBlur}
              placeholder="e.g. shivam_yadav"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors ${
                usernameStatus === "taken"
                  ? "border-red-400 focus:border-red-500"
                  : usernameStatus === "available"
                  ? "border-emerald-400 focus:border-emerald-500"
                  : "border-[#E5E2DC] focus:border-[#1A1A1A]"
              }`}
            />
            <span className="text-[10px] text-[#6B6860]">3-30 chars, lowercase letters, numbers, underscores</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Shivam Yadav"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#C8102E] hover:bg-[#A00C24] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center space-x-1"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E5E2DC]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#6B6860]">Or sign up with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignUp}
          className="w-full py-2.5 px-4 bg-white border border-[#E5E2DC] hover:border-[#1A1A1A] text-[#1A1A1A] text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center space-x-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Google</span>
        </button>

        <p className="text-center text-xs text-[#6B6860]">
          Already have an account?{" "}
          <Link to="/login" className="text-[#1A1A1A] font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

