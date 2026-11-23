import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { AlertCircle, Mail, ArrowRight } from "lucide-react";

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(emailParam);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !email.trim()) return;

    setError(null);
    setLoading(true);

    try {
      await verifyOtp(email.trim(), token.trim());
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code. Please check your code and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-[#E5E2DC] rounded-2xl p-8 space-y-6 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E5E2DC] flex items-center justify-center text-[#C8102E] mx-auto">
          <Mail className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold text-[#1A1A1A]">
            Verify Your Email
          </h1>
          <p className="text-xs text-[#6B6860]">
            We sent a verification code to <br />
            <strong className="text-[#1A1A1A]">{email || "your email address"}</strong>
          </p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {!emailParam && (
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-[#1A1A1A]">
                Verification Code (OTP)
              </label>
              <span className="text-[10px] text-[#6B6860]">8-digit code</span>
            </div>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 12345678"
              maxLength={8}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-lg font-mono tracking-widest text-center focus:outline-none focus:border-[#1A1A1A]"
            />
            <p className="text-[10px] text-[#6B6860] mt-1 text-center">
              Enter the 6 to 8-digit numeric code sent to your email inbox
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || token.length < 6}
            className="w-full py-2.5 px-4 bg-[#C8102E] hover:bg-[#A00C24] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center space-x-1"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Confirm & Enter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-[#6B6860]">
          Didn't receive the email? Check your spam folder or{" "}
          <Link to="/login" className="text-[#C8102E] font-semibold hover:underline">
            return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

