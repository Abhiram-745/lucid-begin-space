-- ============================================================================
-- Tournament Mode
-- ----------------------------------------------------------------------------
-- Adds room-based multiplayer competitions: King of the Hill (1v1 rotating queue)
-- and Group Tournament (parallel multi-user). All real-time coordination uses
-- Supabase Realtime channels keyed on the room code; this DB layer is the
-- authoritative durable state and the source of truth for leaderboards.
-- ============================================================================

CREATE TYPE public.tournament_mode AS ENUM ('koth', 'group');
CREATE TYPE public.tournament_status AS ENUM ('lobby', 'running', 'ended');

CREATE TABLE public.tournament_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  mode public.tournament_mode NOT NULL,
  status public.tournament_status NOT NULL DEFAULT 'lobby',
  round_seconds INT NOT NULL DEFAULT 60,
  total_rounds INT NOT NULL DEFAULT 5,
  current_round INT NOT NULL DEFAULT 0,
  elimination BOOLEAN NOT NULL DEFAULT false,
  -- Authoritative round timing — every client computes remaining time from these
  round_started_at TIMESTAMPTZ,
  round_ends_at TIMESTAMPTZ,
  -- Active match for KOTH: which two participants are currently playing
  active_a UUID,
  active_b UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tournament_rooms_code ON public.tournament_rooms(code);
CREATE INDEX idx_tournament_rooms_status ON public.tournament_rooms(status);

CREATE TABLE public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.tournament_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT,
  ready BOOLEAN NOT NULL DEFAULT false,
  -- Queue position for KOTH; null for group mode. Lower = earlier in queue.
  queue_position INT,
  -- Persistent session leaderboard
  wins INT NOT NULL DEFAULT 0,
  cumulative_score REAL NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  eliminated BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX idx_tournament_participants_room ON public.tournament_participants(room_id);
CREATE INDEX idx_tournament_participants_user ON public.tournament_participants(user_id);

CREATE TABLE public.tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.tournament_rooms(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  -- Per-user final peak scores for this round, keyed by user_id
  final_scores JSONB,
  -- Per-user normalized scores (percentile 0..1)
  normalized_scores JSONB,
  -- Ordered ranking: array of user_ids from 1st place to last
  ranking JSONB,
  winner_id UUID,
  UNIQUE (room_id, round_number)
);
CREATE INDEX idx_tournament_rounds_room ON public.tournament_rounds(room_id);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.tournament_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can find/read rooms (need this to join by code).
CREATE POLICY "Rooms readable by authenticated" ON public.tournament_rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create rooms as host" ON public.tournament_rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host updates own room" ON public.tournament_rooms
  FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "Host deletes own room" ON public.tournament_rooms
  FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE POLICY "Participants readable by authenticated" ON public.tournament_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users join as self" ON public.tournament_participants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own participation" ON public.tournament_participants
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Host updates participants" ON public.tournament_participants
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tournament_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );
CREATE POLICY "Users leave own participation" ON public.tournament_participants
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Host removes participants" ON public.tournament_participants
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tournament_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );

CREATE POLICY "Round results readable by authenticated" ON public.tournament_rounds
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Host writes round results" ON public.tournament_rounds
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.tournament_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );
CREATE POLICY "Host updates round results" ON public.tournament_rounds
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tournament_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );

CREATE TRIGGER trg_tournament_rooms_updated BEFORE UPDATE ON public.tournament_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
