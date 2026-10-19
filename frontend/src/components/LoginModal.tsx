import React, { useState } from "react";
import { X, Lock, ShieldCheck, UserCheck, ShieldAlert } from "lucide-react";
import { UserRole, User } from "../types";

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>("Super Admin");
  const [email, setEmail] = useState("director@iitmandi.ac.in");
  const [password, setPassword] = useState("admin123");

  const presetUsers: { name: string; email: string; role: UserRole; desc: string }[] = [
    {
      name: "Prof. Director",
      email: "director@iitmandi.ac.in",
      role: "Super Admin",
      desc: "Full verification, publishing, user management & audit access"
    },
    {
      name: "Dr. A. Sharma (Nodal Officer)",
      email: "ranking.cell@iitmandi.ac.in",
      role: "Ranking Admin",
      desc: "Create, edit, verify rankings, upload parameters & news"
    },
    {
      name: "Data Entry Operator",
      email: "operator@iitmandi.ac.in",
      role: "Data Entry Operator",
      desc: "Draft & submit new ranking records for verification review"
    },
    {
      name: "Public Auditor",
      email: "auditor@iitmandi.ac.in",
      role: "Viewer",
      desc: "Read-only access to audit logs and verification states"
    }
  ];

  const handleSelectPreset = (preset: typeof presetUsers[0]) => {
    setSelectedRole(preset.role);
    setEmail(preset.email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const preset = presetUsers.find((p) => p.role === selectedRole);
    onLoginSuccess({
      id: `usr-${Date.now()}`,
      name: preset ? preset.name : "Admin User",
      email: email,
      role: selectedRole
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="bg-[#003366] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-blue-200 hover:text-white bg-blue-900/60 p-1.5 rounded-full hover:bg-blue-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-[#F58220]" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Institutional Access Control
            </span>
          </div>

          <h2 className="text-xl font-bold font-serif">
            IIT Mandi Admin Login
          </h2>
          <p className="text-xs text-blue-200 mt-0.5">
            Authenticate to manage ranking records, workflows & verification
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Select Institutional Role
            </label>
            <div className="grid grid-cols-1 gap-2">
              {presetUsers.map((preset) => (
                <button
                  type="button"
                  key={preset.role}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                    selectedRole === preset.role
                      ? "bg-blue-50/90 border-[#003366] ring-1 ring-[#003366]"
                      : "bg-slate-50 border-gray-200 hover:bg-white"
                  }`}
                >
                  <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${selectedRole === preset.role ? "text-[#003366]" : "text-gray-400"}`} />
                  <div>
                    <div className="text-xs font-bold text-gray-900">{preset.role}</div>
                    <div className="text-[11px] text-gray-500">{preset.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Institutional Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#003366] hover:bg-blue-900 text-white font-bold text-xs py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Sign In as {selectedRole}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
