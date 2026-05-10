-- Roles enum + table (separate from profiles per security guidelines)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a UUID NOT NULL,
  player_b UUID NOT NULL,
  winner_id UUID,
  mode TEXT NOT NULL DEFAULT '1v1',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_matches_player_a ON public.matches(player_a);
CREATE INDEX idx_matches_player_b ON public.matches(player_b);

CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  duration_ms INT,
  winner_id UUID,
  final_scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rounds_match ON public.rounds(match_id);

CREATE TABLE public.frame_scores (
  id BIGSERIAL PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  t_ms INT NOT NULL,
  score REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_frame_scores_round ON public.frame_scores(round_id);

CREATE TABLE public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  t_ms INT NOT NULL,
  type TEXT NOT NULL,
  clip_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_highlights_round ON public.highlights(round_id);
CREATE INDEX idx_highlights_player ON public.highlights(player_id);

CREATE TABLE public.player_stats (
  user_id UUID PRIMARY KEY,
  elo INT NOT NULL DEFAULT 1000,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  peak_score REAL NOT NULL DEFAULT 0,
  matches_played INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frame_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles readable by all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- user_roles policies
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Queue policies
CREATE POLICY "Queue readable by authenticated" ON public.matchmaking_queue
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users join queue as self" ON public.matchmaking_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave own queue" ON public.matchmaking_queue
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Matches policies
CREATE POLICY "Matches readable by all authenticated" ON public.matches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Participants update match" ON public.matches
  FOR UPDATE TO authenticated USING (auth.uid() = player_a OR auth.uid() = player_b);

-- Rounds policies
CREATE POLICY "Rounds readable by all authenticated" ON public.rounds
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Participants insert rounds" ON public.rounds
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (auth.uid() = m.player_a OR auth.uid() = m.player_b))
  );
CREATE POLICY "Participants update rounds" ON public.rounds
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (auth.uid() = m.player_a OR auth.uid() = m.player_b))
  );

-- Frame scores policies
CREATE POLICY "Frame scores readable by authenticated" ON public.frame_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players insert own frame scores" ON public.frame_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);

-- Highlights policies
CREATE POLICY "Highlights readable by authenticated" ON public.highlights
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players insert own highlights" ON public.highlights
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);

-- Player stats policies
CREATE POLICY "Player stats readable by all authenticated" ON public.player_stats
  FOR SELECT TO authenticated USING (true);

-- Storage bucket for highlight clips
INSERT INTO storage.buckets (id, name, public) VALUES ('highlights', 'highlights', true);

CREATE POLICY "Highlights bucket public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'highlights');
CREATE POLICY "Users upload own highlights" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'highlights' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Auto-create profile + stats on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player ' || substr(NEW.id::text, 1, 6)));
  INSERT INTO public.player_stats (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();