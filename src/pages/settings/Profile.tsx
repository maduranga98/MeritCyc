// =============================================================================
// MeritCyc Profile Settings Page
// Displays user info, allows display-name edit, password change, and avatar
// upload to Firebase Storage at /users/{uid}/avatar.
// =============================================================================

import React, { useEffect, useRef, useState } from "react";
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type AuthError,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { auth, db, storage } from "../../config/firebase";
import { useAuthStore } from "../../stores/authStore";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../types/roles";
import { type SalaryBand } from "../../types/salaryBand";
import { type Department } from "../../types/department";
import { salaryBandService } from "../../services/salaryBandService";
import { departmentService } from "../../services/departmentService";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const nameSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be less than 80 characters"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type NameFormValues = z.infer<typeof nameSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ---------------------------------------------------------------------------
// Role badge colours
// ---------------------------------------------------------------------------

const ROLE_BADGE: Record<string, { bg: string; text: string; label: string }> =
  {
    platform_admin: { bg: "bg-purple-100", text: "text-purple-700", label: "Platform Admin" },
    super_admin: { bg: "bg-blue-100", text: "text-blue-700", label: "Super Admin" },
    hr_admin: { bg: "bg-emerald-100", text: "text-emerald-700", label: "HR Admin" },
    manager: { bg: "bg-orange-100", text: "text-orange-700", label: "Manager" },
    employee: { bg: "bg-gray-100", text: "text-gray-600", label: "Employee" },
  };

// ---------------------------------------------------------------------------
// Helper: check if the current user has an email/password provider
// ---------------------------------------------------------------------------

function hasPasswordProvider(): boolean {
  return (
    auth.currentUser?.providerData.some(
      (p) => p.providerId === "password"
    ) ?? false
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UserProfileData {
  departmentId?: string;
  salaryBandId?: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const setUser = useAuthStore((s) => s.setUser);

  const [profileData, setProfileData] = useState<UserProfileData>({});
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string>(
    firebaseUser?.photoURL ?? ""
  );
  const [isNameLoading, setIsNameLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Name form
  const {
    register: regName,
    handleSubmit: handleName,
    formState: { errors: nameErrors },
    reset: resetName,
  } = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { displayName: user?.name ?? "" },
  });

  // Password form
  const {
    register: regPw,
    handleSubmit: handlePw,
    formState: { errors: pwErrors },
    reset: resetPw,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  // Reset name form when user loads
  useEffect(() => {
    if (user?.name) {
      resetName({ displayName: user.name });
    }
  }, [user?.name, resetName]);

  // Load extra Firestore profile fields + salary bands & departments
  useEffect(() => {
    if (!user?.uid) return;

    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setProfileData({
            departmentId: d.departmentId as string | undefined,
            salaryBandId: d.salaryBandId as string | undefined,
          });
        }
      })
      .catch(() => {
        // Non-critical
      });

    if (user.companyId) {
      Promise.all([
        salaryBandService.getSalaryBands(user.companyId),
        departmentService.getDepartments(user.companyId),
      ])
        .then(([bands, depts]) => {
          setSalaryBands(bands);
          setDepartments(depts);
        })
        .catch(() => {
          // Non-critical
        });
    }
  }, [user?.uid, user?.companyId]);

  // ---------------------------------------------------------------------------
  // Update display name
  // ---------------------------------------------------------------------------
  const onSaveName = async (data: NameFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !user) return;

    setIsNameLoading(true);
    try {
      await updateProfile(currentUser, { displayName: data.displayName });
      await updateDoc(doc(db, "users", user.uid), { name: data.displayName });
      // Sync Zustand store
      setUser({ ...user, name: data.displayName });
      toast.success("Display name updated.");
    } catch {
      toast.error("Failed to update name. Please try again.");
    } finally {
      setIsNameLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Change password
  // ---------------------------------------------------------------------------
  const onChangePassword = async (data: PasswordFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return;

    setIsPasswordLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        data.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, data.newPassword);
      resetPw();
      toast.success("Password changed successfully.");
    } catch (err: unknown) {
      const code = (err as AuthError).code ?? "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        toast.error("Current password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please wait and try again.");
      } else {
        toast.error("Failed to change password. Please try again.");
      }
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Avatar upload
  // ---------------------------------------------------------------------------
  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const currentUser = auth.currentUser;
    if (!file || !currentUser || !user) return;

    // Validate file type and size (max 2 MB)
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB.");
      return;
    }

    setIsAvatarLoading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/avatar`);
      await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: { uploadedBy: user.uid },
      });
      const downloadUrl = await getDownloadURL(storageRef);
      await updateProfile(currentUser, { photoURL: downloadUrl });
      setAvatarUrl(downloadUrl);
      toast.success("Profile photo updated.");
    } catch {
      toast.error("Failed to upload photo. Please try again.");
    } finally {
      setIsAvatarLoading(false);
      // Reset file input so same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE["employee"];
  const roleConfig = ROLES[user.role];
  const canChangePassword = hasPasswordProvider();
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-merit-bg font-brand py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* ------------------------------------------------------------------ */}
        {/* Header card                                                         */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 rounded-full bg-merit-navy flex items-center justify-center text-white text-2xl font-bold overflow-hidden cursor-pointer ring-2 ring-offset-2 ring-merit-emerald/30 hover:ring-merit-emerald/70 transition-all"
                onClick={() => fileInputRef.current?.click()}
                title="Change profile photo"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
                {isAvatarLoading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                    <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAvatarLoading}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-merit-emerald rounded-full flex items-center justify-center shadow-md hover:bg-emerald-600 transition-colors disabled:opacity-60"
                title="Upload photo"
              >
                <CameraIcon />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-merit-navy truncate">
                {user.name}
              </h1>
              <p className="text-sm text-merit-slate mt-0.5 truncate">
                {user.email}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
                {roleConfig.isCompanyScoped && user.companyId && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {user.companyId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Extra fields */}
          {(profileData.departmentId || profileData.salaryBandId) && (
            <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
              {profileData.departmentId && (
                <InfoField label="Department" value={departments.find(d => d.id === profileData.departmentId)?.name || profileData.departmentId} />
              )}
              {profileData.salaryBandId && (() => {
                const band = salaryBands.find(b => b.id === profileData.salaryBandId);
                return (
                  <InfoField
                    label="Salary Band"
                    value={band?.name || profileData.salaryBandId}
                    subtitle={band ? `${band.currency} ${band.minSalary.toLocaleString()} – ${band.maxSalary.toLocaleString()}` : undefined}
                  />
                );
              })()}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Edit display name                                                   */}
        {/* ------------------------------------------------------------------ */}
        <SectionCard title="Display Name">
          <form onSubmit={handleName(onSaveName)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                {...regName("displayName")}
                disabled={isNameLoading}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50"
              />
              {nameErrors.displayName && (
                <p className="text-red-500 text-sm mt-1">
                  {nameErrors.displayName.message}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-merit-slate">
                Email address cannot be changed here.
              </p>
              <button
                type="submit"
                disabled={isNameLoading}
                className="px-5 py-2.5 bg-merit-navy text-white text-sm font-bold rounded-xl hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isNameLoading ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* ------------------------------------------------------------------ */}
        {/* Change password — only for email/password users                    */}
        {/* ------------------------------------------------------------------ */}
        {canChangePassword && (
          <SectionCard title="Change Password">
            <form onSubmit={handlePw(onChangePassword)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    {...regPw("currentPassword")}
                    autoComplete="current-password"
                    disabled={isPasswordLoading}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-merit-slate hover:text-merit-navy"
                  >
                    {showCurrentPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {pwErrors.currentPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {pwErrors.currentPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    {...regPw("newPassword")}
                    autoComplete="new-password"
                    disabled={isPasswordLoading}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-merit-slate hover:text-merit-navy"
                  >
                    {showNewPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {pwErrors.newPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {pwErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-merit-slate mb-2 tracking-wider">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  {...regPw("confirmPassword")}
                  autoComplete="new-password"
                  disabled={isPasswordLoading}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-merit-emerald/20 focus:border-merit-emerald transition-all disabled:bg-gray-50"
                />
                {pwErrors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {pwErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPasswordLoading}
                  className="px-5 py-2.5 bg-merit-navy text-white text-sm font-bold rounded-xl hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isPasswordLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        {/* Note for SSO users */}
        {!canChangePassword && (
          <SectionCard title="Password">
            <p className="text-sm text-merit-slate">
              You signed in with Google. Password management is handled through
              your Google account.
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionCard: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6">
    <h2 className="text-base font-bold text-merit-navy mb-5">{title}</h2>
    {children}
  </div>
);

const InfoField: React.FC<{ label: string; value: string; subtitle?: string }> = ({
  label,
  value,
  subtitle,
}) => (
  <div>
    <p className="text-xs font-bold uppercase text-merit-slate tracking-wider mb-1">
      {label}
    </p>
    <p className="text-sm text-merit-navy font-medium">{value}</p>
    {subtitle && (
      <p className="text-xs text-merit-slate mt-0.5">{subtitle}</p>
    )}
  </div>
);

const CameraIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const EyeIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default ProfilePage;
