import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { supabase } from "../services/supabase.js";
import { api } from "../services/api.js";
import { Talk, ActivityEvent } from "../types/talk.js";
import { TalkCard } from "../components/TalkCard.js";
import { Heart, History, ShieldCheck, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, Edit3, X } from "lucide-react";
import { Link } from "react-router-dom";

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [favorites, setFavorites] = useState<Talk[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activeTab, setActiveTab] = useState<"favorites" | "activity" | "security">("favorites");
  const [loading, setLoading] = useState(true);

  // Edit Profile modal state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Security tab state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getFavorites().catch(() => []),
      api.getActivity().catch(() => []),
    ])
      .then(([favs, acts]) => {
        setFavorites(favs);
        setActivities(acts);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFavoriteToggle = (slug: string, isFavorited: boolean) => {
    if (!isFavorited) {
      setFavorites((prev) => prev.filter((f) => f.slug !== slug));
    }
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);
    setEditSuccess(null);
    try {
      await api.updateProfile({
        full_name: editFullName.trim(),
        bio: editBio.trim(),
      });
      await refreshProfile();
      setEditSuccess("Profile updated successfully!");
      setTimeout(() => {
        setIsEditingProfile(false);
        setEditSuccess(null);
      }, 1200);
    } catch (err: any) {
      setEditError(err.message || "Failed to update profile.");
    } finally {
      setEditLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccess("Password updated successfully! You can now sign in using your email/username and this password.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const isGoogleUser = user?.app_metadata?.provider === "google" ||
    (user?.identities && user.identities.some((id: any) => id.provider === "google"));

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const displayUsername = profile?.username || user?.user_metadata?.username || (user?.email ? user.email.split("@")[0] : "");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Profile Header Card */}
      <div className="bg-white border border-[#E5E2DC] rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-serif text-2xl font-bold overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              (displayName || displayUsername || user?.email || "U").charAt(0).toUpperCase()
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <h1 className="font-serif text-2xl font-bold text-[#1A1A1A]">
                {displayName || (displayUsername ? `@${displayUsername}` : "User Profile")}
              </h1>
              <button
                onClick={() => {
                  setEditFullName(displayName || "");
                  setEditBio(profile?.bio || "");
                  setEditError(null);
                  setEditSuccess(null);
                  setIsEditingProfile(true);
                }}
                className="p-1.5 text-[#6B6860] hover:text-[#1A1A1A] rounded-lg hover:bg-neutral-100 transition-colors"
                title="Edit profile details"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#6B6860]">
              {displayUsername ? `@${displayUsername}` : ""} {user?.email ? `• ${user.email}` : ""}
            </p>
            {profile?.bio && (
              <p className="text-xs text-[#6B6860] pt-0.5 max-w-md italic leading-relaxed">
                "{profile.bio}"
              </p>
            )}
            {!displayName && (
              <p className="text-[11px] text-amber-700 font-medium pt-0.5">
                Profile name not set yet —{" "}
                <button
                  onClick={() => {
                    setEditFullName("");
                    setEditBio(profile?.bio || "");
                    setIsEditingProfile(true);
                  }}
                  className="text-[#C8102E] underline hover:no-underline font-semibold"
                >
                  click here to add your name
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-6 text-center text-xs">
          <div>
            <span className="block font-serif text-xl font-bold text-[#1A1A1A]">
              {favorites.length}
            </span>
            <span className="text-[#6B6860]">Favorites</span>
          </div>
          <div className="w-px h-8 bg-[#E5E2DC]" />
          <div>
            <span className="block font-serif text-xl font-bold text-[#1A1A1A]">
              {activities.length}
            </span>
            <span className="text-[#6B6860]">Activities</span>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-[#E5E2DC] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
              <h2 className="font-serif text-lg font-bold text-[#1A1A1A]">Edit Profile Details</h2>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="p-1 text-[#6B6860] hover:text-[#1A1A1A] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="e.g. Shivam Yadav"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Bio / Learning Goals (Optional)
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell us what topics or ideas you're exploring..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 border border-[#E5E2DC] hover:border-[#1A1A1A] text-xs font-medium text-[#1A1A1A] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E5E2DC]">
        <button
          onClick={() => setActiveTab("favorites")}
          className={`flex items-center space-x-2 px-6 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "favorites"
              ? "border-[#C8102E] text-[#1A1A1A]"
              : "border-transparent text-[#6B6860] hover:text-[#1A1A1A]"
          }`}
        >
          <Heart className="w-4 h-4 text-[#C8102E]" />
          <span>Saved Talks ({favorites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("activity")}
          className={`flex items-center space-x-2 px-6 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "activity"
              ? "border-[#C8102E] text-[#1A1A1A]"
              : "border-transparent text-[#6B6860] hover:text-[#1A1A1A]"
          }`}
        >
          <History className="w-4 h-4 text-[#1A1A1A]" />
          <span>Interaction History</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center space-x-2 px-6 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "security"
              ? "border-[#C8102E] text-[#1A1A1A]"
              : "border-transparent text-[#6B6860] hover:text-[#1A1A1A]"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#1A1A1A]" />
          <span>Security & Password</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "favorites" ? (
        <div>
          {favorites.length === 0 && !loading ? (
            <div className="py-20 text-center space-y-3 bg-white border border-[#E5E2DC] rounded-xl">
              <Heart className="w-8 h-8 text-[#E5E2DC] mx-auto" />
              <p className="font-serif text-lg font-semibold text-[#1A1A1A]">
                No favorite talks yet
              </p>
              <p className="text-xs text-[#6B6860] max-w-sm mx-auto">
                Explore the catalog and click the heart icon on any talk to save it to your library and personalize your recommendations.
              </p>
              <Link
                to="/browse"
                className="inline-block mt-2 px-4 py-2 bg-[#1A1A1A] text-white text-xs font-semibold rounded-md"
              >
                Browse Catalog
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((talk) => (
                <TalkCard
                  key={talk.slug}
                  talk={talk}
                  onFavoriteToggle={handleFavoriteToggle}
                />
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "activity" ? (
        <div className="bg-white border border-[#E5E2DC] rounded-xl divide-y divide-[#E5E2DC] shadow-sm">
          {activities.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#6B6860]">
              No logged activities recorded yet.
            </div>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="p-4 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[#1A1A1A] capitalize">
                      {act.event_type.replace("_", " ")}
                    </span>
                    {act.talks && (
                      <Link
                        to={`/talks/${act.talks.slug}`}
                        className="text-[#C8102E] hover:underline font-medium"
                      >
                        {act.talks.title}
                      </Link>
                    )}
                  </div>
                  {act.talks && (
                    <p className="text-[11px] text-[#6B6860]">
                      Speaker: {act.talks.speaker}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {new Date(act.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E5E2DC] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm max-w-xl">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#1A1A1A]">
              Account Security & Password
            </h2>
            <p className="text-xs text-[#6B6860] mt-1">
              {isGoogleUser
                ? "You are signed in with Google. Set an account password below to enable signing in with your email or username and password."
                : "Manage or update your account password."}
            </p>
          </div>

          <div className="p-4 bg-[#FAF8F5] border border-[#E5E2DC] rounded-lg space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6B6860]">Account Email:</span>
              <span className="font-medium text-[#1A1A1A]">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6860]">Primary Login:</span>
              <span className="font-medium text-[#1A1A1A] capitalize">
                {isGoogleUser ? "Google OAuth" : "Email & Password"}
              </span>
            </div>
          </div>

          {passwordSuccess && (
            <div className="flex items-start space-x-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                {isGoogleUser ? "Create Password" : "New Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E2DC] text-sm focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="py-2.5 px-5 bg-[#1A1A1A] hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm flex items-center space-x-1.5"
            >
              {passwordLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isGoogleUser ? "Set Account Password" : "Change Password"}</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

