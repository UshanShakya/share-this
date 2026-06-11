import { Session as SupabaseSession, User as SupabaseUser } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

export type User = SupabaseUser;
export type Session = SupabaseSession;

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}
