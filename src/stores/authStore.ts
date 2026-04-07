// =============================================================================
// MeritCyc Auth Store — Zustand
// Single source of truth for authentication state.
// Initialized by <AuthProvider> once via initialize().
// =============================================================================

import { create } from "zustand";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { type RoleCode } from "../types/roles";
import { type AuthUser, type CustomClaims } from "../types/user";

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface AuthStore {
  /** Raw Firebase user object — useful for providerData, photo, etc. */
  firebaseUser: FirebaseUser | null;
  /** Resolved application-level user (merged claims + Firebase user info). */
  user: AuthUser | null;
  /** Custom claims from the Firebase ID token. */
  claims: CustomClaims | null;
  /** True while the first auth state resolution is in-flight. */
  loading: boolean;

  // Actions
  setUser: (user: AuthUser | null) => void;
  clearUser: () => void;
  setClaims: (claims: CustomClaims | null) => void;
  logout: () => Promise<void>;
  /**
   * Start the Firebase onAuthStateChanged listener.
   * Returns the unsubscribe function — call it on unmount.
   */
  initialize: () => () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>((set) => ({
  firebaseUser: null,
  user: null,
  claims: null,
  loading: true,

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, firebaseUser: null, claims: null }),
  setClaims: (claims) => set({ claims }),

  logout: async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Auth signOut error:", err);
    }
  },

  initialize: () => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (!firebaseUser) {
          set({ user: null, firebaseUser: null, claims: null, loading: false });
          return;
        }

        try {
          // ------------------------------------------------------------------
          // 1. Try custom claims first (set by Cloud Functions)
          // ------------------------------------------------------------------
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          const raw = tokenResult.claims;

          if (raw.role) {
            const claims: CustomClaims = {
              role: raw.role as RoleCode,
              companyId: raw.companyId as string | undefined,
              approved: (raw.approved as boolean) ?? false,
            };

            const user: AuthUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? "",
              name:
                (raw.name as string) ??
                firebaseUser.displayName ??
                firebaseUser.email?.split("@")[0] ??
                "User",
              role: claims.role,
              companyId: claims.companyId ?? "",
              approved: claims.approved,
            };

            set({ user, firebaseUser, claims, loading: false });
          } else {
            // ----------------------------------------------------------------
            // 2. Fallback: read from Firestore /users/{uid}
            //    For users created before custom claims were deployed.
            // ----------------------------------------------------------------
            const userDoc = await getDoc(
              doc(db, "users", firebaseUser.uid)
            );

            if (userDoc.exists()) {
              const data = userDoc.data();
              const role = mapLegacyRole(data.role as string);

              set({
                user: {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email ?? "",
                  name:
                    (data.name as string) ??
                    firebaseUser.displayName ??
                    firebaseUser.email?.split("@")[0] ??
                    "User",
                  role,
                  companyId: (data.companyId as string) ?? "",
                  approved: (data.approved as boolean) ?? true,
                },
                firebaseUser,
                claims: null,
                loading: false,
              });
            } else {
              console.error(
                "No user document found in Firestore for UID:",
                firebaseUser.uid
              );
              set({
                user: null,
                firebaseUser: null,
                claims: null,
                loading: false,
              });
            }
          }
        } catch (err) {
          console.error("Error resolving user data:", err);
          set({ user: null, firebaseUser: null, claims: null, loading: false });
        }
      }
    );

    return unsubscribe;
  },
}));

// ---------------------------------------------------------------------------
// Legacy role mapper — converts old string roles to RoleCode.
// Remove once all Firestore user docs have been migrated.
// ---------------------------------------------------------------------------

function mapLegacyRole(role: string): RoleCode {
  const map: Record<string, RoleCode> = {
    "Super Admin": "platform_admin",
    Admin: "super_admin",
    "HR Admin": "hr_admin",
    Manager: "manager",
    Employee: "employee",
    platform_admin: "platform_admin",
    super_admin: "super_admin",
    hr_admin: "hr_admin",
    manager: "manager",
    employee: "employee",
  };
  return map[role] ?? "employee";
}
