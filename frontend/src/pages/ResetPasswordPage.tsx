import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase.js";
import { AlertCircle, CheckCircle2, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have an active recovery session or recovery tokens in URL
    const checkRecovery = async () => {
      // 1. Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasValidSession(true);
        setCheckingSession(false);
        return;
      }

      // 2. Check if hash contains access_token (type=recovery) or query contains code
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes("type=recovery") || hash.includes("access_token") || search.includes("code=")) {
        // Supabase client might be processing hash tokens asynchronously
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" || (session && (event === "SIGNED_IN" || event === "USER_UPDATED"))) {
            setHasValidSession(true);
            setCheckingSession(false);
          }
        });

        // Give it 2.5 seconds to exchange recovery token
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            setHasValidSession(true);
          }
          setCheckingSession(false);
          subscription.unsubscribe();
        }, 2500);
      } else {
        setCheckingSession(false);
      }
    };

    checkRecovery();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify both fields.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Sign out from recovery session so user can log in with their brand new password
      await supabase.auth.signOut().catch(() => {});
    } catch (err: any) {
      setError(err.message || "Failed to update password. Your reset link may have expired.");
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
          <h1 className="font-serif text-2xl font-bold text-[#1A1A1A]">
            Set New Password
          </h1>
          <p className="text-xs text-[#6B6860]">
            Please enter your new password to regain access to your account.
          </p>
        </div>

        {checkingSession ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-6 h-6 border-2 border-[#C8102E] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#6B6860]">Verifying password reset security token...</p>
          </div>
        ) : success ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h2 className="font-serif text-base font-bold text-emerald-900">
              Password Reset Successful!
            </h2>
            <p className="text-emerald-700 leading-relaxed">
              Your password has been updated securely. You can now sign in using your email or username with your new password.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center space-x-1 w-full py-2.5 px-4 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : !hasValidSession ? (
          <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl space-y-3 text-center">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <h2 className="font-serif text-base font-bold text-amber-900">
              Reset Link Expired or Invalid
            </h2>
            <p className="text-amber-700 leading-relaxed">
              This password reset link is invalid, expired, or has already been used. Please request a fresh password reset email.
            </p>
            <div className="pt-2">
              <Link
                to="/forgot-password"
                className="inline-flex items-center justify-center space-x-1 w-full py-2.5 px-4 bg-[#C8102E] hover:bg-[#A00C24] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <span>Request New Reset Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#6B6860] hover:text-[#1A1A1A]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-[#6B6860] hover:text-[#1A1A1A]"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center space-x-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[#6B6860]">
          Remember your password?{" "}
          <Link to="/login" className="text-[#C8102E] font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
