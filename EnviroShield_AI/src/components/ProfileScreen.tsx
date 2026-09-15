import { useState } from "react";
import { formatAge } from "../lib/local-cache";
import type { SyncedDataset } from "../lib/sync";

interface ProfileScreenProps {
  profile: {
    name: string;
    email: string;
    phone: string;
    bloodGroup: string;
    emergencyName: string;
    emergencyPhone: string;
  };
  onUpdateProfile: (field: string, value: string) => void;
  onSaveProfile: () => void;
  onLogout: () => void;
  online: boolean;
  syncState: "idle" | "syncing" | "error";
  syncError: string | null;
  dataset: SyncedDataset | null;
  onSync: () => void;
  onSendSos: () => void;
  sosResult: string | null;
}

export default function ProfileScreen({
  profile,
  onUpdateProfile,
  onSaveProfile,
  onLogout,
  online,
  syncState,
  syncError,
  dataset,
  onSync,
  onSendSos,
  sosResult,
}: ProfileScreenProps) {
  const [saveToast, setSaveToast] = useState(false);
  const [notifications, setNotifications] = useState({
    critical: true,
    warnings: true,
    browserPush: true,
    sound: true,
  });

  const handleSave = () => {
    onSaveProfile();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("enviroshield_notification_prefs", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0b1016] text-white overflow-y-auto pb-28">
      <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">User Settings</p>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">Profile & Preferences</h1>
        </div>

        {/* Save feedback toast */}
        {saveToast && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center animate-in fade-in duration-200">
            ✓ Profile and settings saved successfully!
          </div>
        )}

        {/* User Card */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-800/40 border border-emerald-500/30 flex items-center justify-center text-2xl">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">
              {profile.name.trim() || "EnviroShield User"}
            </h2>
            <p className="text-xs text-white/50 truncate">{profile.email || "demo@enviroshield.ai"}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80">
                {profile.bloodGroup ? `Blood: ${profile.bloodGroup}` : "Blood: Not set"}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                Active Member
              </span>
            </div>
          </div>
        </div>

        {/* Personal Details Form */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Personal Information</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Full Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => onUpdateProfile("name", e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => onUpdateProfile("email", e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Phone</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => onUpdateProfile("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Blood Group</label>
              <select
                value={profile.bloodGroup}
                onChange={(e) => onUpdateProfile("bloodGroup", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="" className="bg-slate-900 text-white">Select Blood Group</option>
                <option value="A+" className="bg-slate-900 text-white">A+</option>
                <option value="A-" className="bg-slate-900 text-white">A-</option>
                <option value="B+" className="bg-slate-900 text-white">B+</option>
                <option value="B-" className="bg-slate-900 text-white">B-</option>
                <option value="AB+" className="bg-slate-900 text-white">AB+</option>
                <option value="AB-" className="bg-slate-900 text-white">AB-</option>
                <option value="O+" className="bg-slate-900 text-white">O+</option>
                <option value="O-" className="bg-slate-900 text-white">O-</option>
              </select>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="p-5 rounded-2xl bg-white/5 border border-red-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🚨</span> Emergency Contact
            </h3>
            <span className="text-[11px] text-white/40">Used in rescue operations</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Contact Name</label>
              <input
                type="text"
                value={profile.emergencyName}
                onChange={(e) => onUpdateProfile("emergencyName", e.target.value)}
                placeholder="Guardian or family member"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-red-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={profile.emergencyPhone}
                onChange={(e) => onUpdateProfile("emergencyPhone", e.target.value)}
                placeholder="Emergency phone number"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-red-500 transition"
              />
            </div>
            {profile.emergencyPhone.trim() && (
              <a
                href={`tel:${profile.emergencyPhone.replace(/[^+\d]/g, "")}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-sm text-white transition shadow-lg shadow-red-600/20"
              >
                <span>📞</span> Call {profile.emergencyName.trim() || "Emergency Contact"}
              </a>
            )}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Alert Preferences</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Critical & Severe Alerts</p>
                <p className="text-xs text-white/50">Urgent flood and seismic warnings</p>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification("critical")}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  notifications.critical ? "bg-emerald-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications.critical ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-sm font-semibold text-white">Warning & Advisory Notices</p>
                <p className="text-xs text-white/50">Air quality changes and road closures</p>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification("warnings")}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  notifications.warnings ? "bg-emerald-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications.warnings ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-sm font-semibold text-white">Audio Siren / Chime</p>
                <p className="text-xs text-white/50">Audible tone for high hazard situations</p>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification("sound")}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  notifications.sound ? "bg-emerald-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications.sound ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Emergency SOS Section */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Emergency SOS Dispatch</h3>
          <button
            type="button"
            onClick={onSendSos}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-red-700/30 hover:brightness-110 active:scale-[0.99] transition"
          >
            📡 Broadcast SOS with Live Coordinates
          </button>
          {sosResult && <p className="text-xs text-amber-300 mt-2">{sosResult}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href="sms:1077?body=EnviroShield%20AI%20SOS%20Emergency"
              className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-center text-xs font-bold text-white transition"
            >
              SMS Disaster Helpline 1077
            </a>
            <a
              href="tel:1077"
              className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-center text-xs font-bold text-white transition"
            >
              Call Helpline 1077
            </a>
          </div>
        </div>

        {/* Offline Cache & Cloud Sync Status */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white uppercase tracking-wider">Offline Cache & Sync</h3>
            <span className={online ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
              {online ? "Online Connected" : "Offline Storage Mode"}
            </span>
          </div>
          <p className="text-white/60 leading-relaxed">
            Last dataset sync: <strong>{formatAge(dataset?.syncedAt ?? null)}</strong>. All hazard maps,
            road networks, and shelters remain accessible without an active internet connection.
          </p>
          {syncError && <p className="text-red-400">{syncError}</p>}
          <button
            type="button"
            onClick={onSync}
            disabled={!online || syncState === "syncing"}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-semibold transition"
          >
            {syncState === "syncing" ? "Synchronizing..." : "Sync Latest Hazard Dataset"}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition shadow-lg shadow-emerald-500/20"
          >
            Save Profile & Preferences
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm border border-red-500/20 transition"
          >
            Sign Out of EnviroShield
          </button>
        </div>
      </div>
    </div>
  );
}
