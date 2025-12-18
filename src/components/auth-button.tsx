"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignInWithGoogle = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/`,
      },
    });

    if (error) {
      console.error("Error signing in:", error);
    }
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
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/`,
          },
        });
        if (error) throw error;
        setAuthError("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
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

  if (loading) {
    return (
      <div className="rounded-full bg-slate-100 dark:bg-slate-800 px-6 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 animate-pulse">
        Loading...
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">Student</span>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{user.email?.split('@')[0]}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="clay-button !py-2 !px-4 !text-sm bg-slate-200 text-slate-700 hover:bg-slate-300"
          style={{ background: 'none', backgroundColor: '#e2e8f0', color: '#334155' }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleSignInWithGoogle}
          className="clay-button flex items-center gap-2 !bg-white !text-slate-700 hover:!bg-slate-50"
          style={{ background: 'white' }}
        >
          <span className="text-lg">G</span> Google Login
        </button>
        <button
          onClick={() => setShowEmailForm(true)}
          className="clay-button !bg-indigo-600 !text-white"
        >
          Email Login
        </button>
      </div>

      {mounted && showEmailForm && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => {
            setShowEmailForm(false);
            setAuthError(null);
          }}
        >
          <div 
            className="clay-card relative w-full max-w-sm p-8 animate-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowEmailForm(false);
                setAuthError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl dark:bg-indigo-900/50">
                {isSignUp ? "✨" : "👋"}
              </div>
              <h3 className="text-2xl font-heading font-bold text-slate-800 dark:text-slate-100">
                {isSignUp ? "Join the Fun!" : "Welcome Back"}
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {isSignUp ? "Create a student ID to start playing." : "Enter your credentials to continue."}
              </p>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Student Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:font-normal dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:font-normal dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
              
              <button
                type="submit"
                className="clay-button w-full justify-center text-base"
              >
                {isSignUp ? "Create Account" : "Access Dashboard"}
              </button>

              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  className="text-indigo-500 hover:text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {isSignUp ? "Have an ID? Sign In" : "Need an ID? Create one"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(false);
                    setAuthError(null);
                  }}
                  className="hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>

              {authError && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 font-bold text-center border-2 border-red-100 animate-in shake">
                  {authError}
                </div>
              )}
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

