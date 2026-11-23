import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Compass, Sparkles, LogOut, Info } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E5E2DC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 group">
          <span className="font-serif text-2xl font-bold tracking-tight text-[#1A1A1A]">
            TalkWise<span className="text-[#C8102E]">.</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-[#6B6860]">
          <Link
            to="/dashboard"
            className="flex items-center space-x-1 hover:text-[#1A1A1A] transition-colors"
          >
            <Sparkles className="w-4 h-4 text-[#C8102E]" />
            <span>For You</span>
          </Link>
          <Link
            to="/browse"
            className="flex items-center space-x-1 hover:text-[#1A1A1A] transition-colors"
          >
            <Compass className="w-4 h-4" />
            <span>Browse Talks</span>
          </Link>
          <Link
            to="/about"
            className="flex items-center space-x-1 hover:text-[#1A1A1A] transition-colors"
          >
            <Info className="w-4 h-4" />
            <span>About</span>
          </Link>
        </nav>

        {/* Auth Actions */}
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-3">
              <Link
                to="/profile"
                className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-[#E5E2DC] bg-white hover:border-[#1A1A1A] transition-all text-xs font-medium text-[#1A1A1A]"
              >
                <div className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px] font-bold">
                  {profile?.username?.charAt(0).toUpperCase() || "U"}
                </div>
                <span>@{profile?.username || "user"}</span>
              </Link>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-1.5 text-[#6B6860] hover:text-[#C8102E] transition-colors rounded-md hover:bg-neutral-100"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3 text-sm">
              <Link
                to="/login"
                className="text-[#6B6860] hover:text-[#1A1A1A] font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

