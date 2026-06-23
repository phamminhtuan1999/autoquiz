"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignInWithGoogle = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/` },
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const supabase = createSupabaseBrowserClient();
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/` },
        });
        if (error) throw error;
        setAuthError("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setAuthError((error as Error).message);
    }
  };

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  const closeModal = () => { setShowEmailForm(false); setAuthError(null); };

  if (loading) {
    return <div className="h-8 w-24 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg-muted)]" />;
  }

  if (user) {
    return (
      <button
        onClick={handleSignOut}
        className="inline-flex h-8 items-center rounded-[var(--r-sm)] border border-[var(--border)] px-3 text-sm text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
      >
        Sign out
      </button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSignInWithGoogle}
          aria-label="Continue with Google"
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--fg)] transition-colors hover:bg-[var(--bg-subtle)]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>
        <button
          onClick={() => setShowEmailForm(true)}
          className="inline-flex h-8 items-center rounded-[var(--r-sm)] bg-[var(--accent)] px-3.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          Sign in
        </button>
      </div>

      {mounted && showEmailForm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--fg)]/20 p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-8 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded p-1 text-[var(--fg-faint)] transition-colors hover:text-[var(--fg-muted)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6">
              <h3 className="font-display text-xl font-bold text-[var(--fg-strong)]">
                {isSignUp ? "Create an account" : "Welcome back"}
              </h3>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                {isSignUp ? "Start generating source-grounded quizzes." : "Sign in to continue."}
              </p>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-faint)] focus:border-[var(--accent-border)]"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-faint)] focus:border-[var(--accent-border)]"
              />

              {authError && (
                <p className={`rounded-[var(--r-sm)] border px-3 py-2 text-xs ${
                  authError.startsWith("Check")
                    ? "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]"
                    : "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]"
                }`}>
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-[var(--r-sm)] bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                {isSignUp ? "Create account" : "Sign in"}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs text-[var(--fg-faint)]">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }}
                  className="transition-colors hover:text-[var(--accent)]"
                >
                  {isSignUp ? "Already have an account?" : "Need an account?"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
