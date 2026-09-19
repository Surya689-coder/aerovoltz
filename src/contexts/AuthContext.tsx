import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types";

interface AppSession {
  user: {
    id: string;
    email: string;
    user_metadata: {
      role: UserRole;
    };
  };
}

interface AuthContextValue {
  session: AppSession | null;
  role: UserRole;
  loading: boolean;

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;

  signUp: (
    email: string,
    password: string,
    role: UserRole
  ) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;
}

const AuthContext =
  createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<AppSession | null>(null);

  const [role, setRole] =
    useState<UserRole>("commander");

  const [loading, setLoading] =
    useState(true);

  // ============================================================
  // RESTORE SAVED SESSION
  // ============================================================

  useEffect(() => {
    const savedSession =
      localStorage.getItem("sar_app_session");

    if (savedSession) {
      try {
        const parsed =
          JSON.parse(savedSession) as AppSession;

        if (
          parsed?.user?.id &&
          parsed?.user?.email &&
          parsed?.user?.user_metadata?.role
        ) {
          setSession(parsed);
          setRole(
            parsed.user.user_metadata.role
          );
        } else {
          localStorage.removeItem(
            "sar_app_session"
          );
        }
      } catch (error) {
        console.error(
          "Failed to restore RESQ X session:",
          error
        );

        localStorage.removeItem(
          "sar_app_session"
        );
      }
    }

    setLoading(false);
  }, []);

  // ============================================================
  // SIGN IN
  // ============================================================

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      return {
        error: "Please enter your email address.",
      };
    }

    if (!password) {
      return {
        error: "Please enter your password.",
      };
    }

    try {
      console.log(
        "RESQ X: Signing in...",
        normalizedEmail
      );

      const { data, error } =
        await supabase.rpc(
          "verify_app_login",
          {
            login_email: normalizedEmail,
            login_password: password,
          }
        );

      console.log(
        "RESQ X: Login response:",
        data
      );

      if (error) {
        console.error(
          "RESQ X: Login error:",
          error
        );

        /*
         * PGRST202 = Supabase cannot find the RPC
         * 42883   = PostgreSQL function does not exist
         */
        if (
          error.code === "PGRST202" ||
          error.code === "42883"
        ) {
          return {
            error:
              "Login function was not found. Please check that this website is connected to the correct Supabase project.",
          };
        }

        return {
          error: error.message,
        };
      }

      /*
       * Empty result means:
       * - email doesn't exist
       * OR
       * - password is incorrect
       */
      if (!data || data.length === 0) {
        return {
          error: "Invalid email or password.",
        };
      }

      const user = data[0] as {
        user_id: string;
        user_email: string;
        user_role: UserRole;
      };

      // Validate returned user data
      if (
        !user.user_id ||
        !user.user_email ||
        !user.user_role
      ) {
        console.error(
          "Invalid user data returned from Supabase:",
          user
        );

        return {
          error:
            "Login succeeded but the user information returned by Supabase is invalid.",
        };
      }

      const nextSession: AppSession = {
        user: {
          id: user.user_id,
          email: user.user_email,
          user_metadata: {
            role: user.user_role,
          },
        },
      };

      // Save session
      localStorage.setItem(
        "sar_app_session",
        JSON.stringify(nextSession)
      );

      // Update React state
      setSession(nextSession);

      setRole(
        nextSession.user.user_metadata.role
      );

      console.log(
        "RESQ X: Login successful:",
        nextSession.user.email,
        nextSession.user.user_metadata.role
      );

      return {
        error: null,
      };
    } catch (error) {
      console.error(
        "RESQ X: Unexpected login error:",
        error
      );

      return {
        error:
          "Unable to connect to Supabase. Please check your internet connection and Supabase configuration.",
      };
    }
  };

  // ============================================================
  // CREATE ACCOUNT
  // ============================================================

  const signUp = async (
    email: string,
    password: string,
    selectedRole: UserRole
  ): Promise<{ error: string | null }> => {
    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      return {
        error: "Please enter your email address.",
      };
    }

    if (!password) {
      return {
        error: "Please enter a password.",
      };
    }

    if (password.length < 6) {
      return {
        error:
          "Password must contain at least 6 characters.",
      };
    }

    if (
      selectedRole !== "commander" &&
      selectedRole !== "observer"
    ) {
      return {
        error: "Please select a valid account role.",
      };
    }

    try {
      console.log(
        "RESQ X: Creating account...",
        {
          email: normalizedEmail,
          role: selectedRole,
        }
      );

      const { data, error } =
        await supabase.rpc(
          "create_app_user",
          {
            new_email: normalizedEmail,
            new_password: password,
            new_role: selectedRole.toLowerCase(),
          }
        );

      console.log(
        "RESQ X: Create account response:",
        data
      );

      if (error) {
        console.error(
          "RESQ X: Create account error:",
          error
        );

        if (
          error.code === "PGRST202" ||
          error.code === "42883"
        ) {
          return {
            error:
              "The create account function was not found. Please check that this website is connected to the correct Supabase project.",
          };
        }

        /*
         * Duplicate account
         */
        if (
          error.message
            ?.toLowerCase()
            .includes("already exists")
        ) {
          return {
            error:
              "An account with this email already exists.",
          };
        }

        return {
          error: error.message,
        };
      }

      /*
       * Function should return the newly created user.
       */
      if (!data || data.length === 0) {
        return {
          error:
            "The account could not be created. Supabase did not return a new user.",
        };
      }

      console.log(
        "RESQ X: Account created successfully:",
        data[0]
      );

      return {
        error: null,
      };
    } catch (error) {
      console.error(
        "RESQ X: Unexpected account creation error:",
        error
      );

      return {
        error:
          "Unable to connect to Supabase. Please check your internet connection and Supabase configuration.",
      };
    }
  };

  // ============================================================
  // SIGN OUT
  // ============================================================

  const signOut = async (): Promise<void> => {
    console.log("RESQ X: Signing out...");

    localStorage.removeItem(
      "sar_app_session"
    );

    setSession(null);

    setRole("commander");
  };

  // ============================================================
  // AUTH CONTEXT
  // ============================================================

  return (
    <AuthContext.Provider
      value={{
        session,
        role,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// AUTH HOOK
// ============================================================

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return ctx;
}