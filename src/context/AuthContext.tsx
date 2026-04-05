import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { type RoleCode } from "../types/roles";
import { type AuthUser } from "../types/user";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          try {
            // -----------------------------------------------------------------
            // 1. Try custom claims first (set by Cloud Functions)
            // -----------------------------------------------------------------
            const tokenResult = await firebaseUser.getIdTokenResult(true);
            const claims = tokenResult.claims;

            if (claims.role) {
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email ?? "",
                name:
                  (claims.name as string) ??
                  firebaseUser.displayName ??
                  firebaseUser.email?.split("@")[0] ??
                  "User",
                role: claims.role as RoleCode,
                // platform_admin has no companyId
                companyId: (claims.companyId as string) ?? "",
                approved: (claims.approved as boolean) ?? false,
              });
            } else {
              // ---------------------------------------------------------------
              // 2. Fallback: read from Firestore /users/{uid}
              //    Handles users created before custom claims were deployed
              // ---------------------------------------------------------------
              const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

              if (userDoc.exists()) {
                const data = userDoc.data();
                setUser({
                  uid: firebaseUser.uid,
                  email: firebaseUser.email ?? "",
                  name:
                    data.name ??
                    firebaseUser.displayName ??
                    firebaseUser.email?.split("@")[0] ??
                    "User",
                  role: mapLegacyRole(data.role),
                  companyId: data.companyId ?? "",
                  approved: data.approved ?? true,
                });
              } else {
                console.error(
                  "No user document found in Firestore for UID:",
                  firebaseUser.uid,
                );
                setUser(null);
              }
            }
          } catch (error) {
            console.error("Error resolving user data:", error);
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// ---------------------------------------------------------------------------
// Legacy role mapper — converts old string roles to RoleCode.
// Remove once all Firestore user docs have been migrated.
// ---------------------------------------------------------------------------

function mapLegacyRole(role: string): RoleCode {
  const map: Record<string, RoleCode> = {
    // Old format (from current codebase)
    "Super Admin": "platform_admin",
    Admin: "super_admin",
    "HR Admin": "hr_admin",
    Manager: "manager",
    Employee: "employee",
    // New format (already correct)
    platform_admin: "platform_admin",
    super_admin: "super_admin",
    hr_admin: "hr_admin",
    manager: "manager",
    employee: "employee",
  };
  return map[role] ?? "employee";
}
