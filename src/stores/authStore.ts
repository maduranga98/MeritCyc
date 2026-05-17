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
import { getNotifications } from "../services/notificationService";
import { useNotificationStore } from "./notificationStore";

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

// Store a reference to the active notification listener so we can unsubscribe
let notificationUnsubscribe: (() => void) | null = null;

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
      if (notificationUnsubscribe) {
        notificationUnsubscribe();
        notificationUnsubscribe = null;
      }
      useNotificationStore.getState().setNotifications([]);
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
          let tokenResult = await firebaseUser.getIdTokenResult(true);
          let raw = tokenResult.claims;

          // If no role in claims, wait 1s and retry once — handles post-approval
          // race condition where Cloud Function just set claims
          if (!raw.role) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            tokenResult = await firebaseUser.getIdTokenResult(true);
            raw = tokenResult.claims;
          }

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

            // Initialize notification listener
            if (notificationUnsubscribe) notificationUnsubscribe();
            notificationUnsubscribe = getNotifications(firebaseUser.uid, (notifs) => {
              useNotificationStore.getState().setNotifications(notifs);
            });
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
                  approved: (data.approved as boolean) ?? false,
                },
                firebaseUser,
                claims: null,
                loading: false,
              });

              // Initialize notification listener
              if (notificationUnsubscribe) notificationUnsubscribe();
              notificationUnsubscribe = getNotifications(firebaseUser.uid, (notifs) => {
                useNotificationStore.getState().setNotifications(notifs);
              });
            } else {
              // No document found. This can happen for newly signed-up users
              // or users created via direct signup (awaiting verification).
              // Create a minimal user object from Firebase profile.
              console.warn(
                "No custom claims and no Firestore doc for UID:",
                firebaseUser.uid,
                "— using Firebase profile as fallback"
              );

              set({
                user: {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email ?? "",
                  name:
                    firebaseUser.displayName ??
                    firebaseUser.email?.split("@")[0] ??
                    "User",
                  role: "employee",
                  companyId: "",
                  approved: false,
                },
                firebaseUser,
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
  if (!role) return 'employee';
  const normalized = role.toLowerCase().trim().replace(/[\s-]/g, '_');
  const map: Record<string, RoleCode> = {
    'platform_admin': 'platform_admin',
    'super_admin': 'super_admin',
    'admin': 'super_admin',
    'hr_admin': 'hr_admin',
    'hr admin': 'hr_admin',
    'hradmin': 'hr_admin',
    'manager': 'manager',
    'employee': 'employee',
  };
  return map[normalized] ?? map[role.toLowerCase().trim()] ?? 'employee';
}
