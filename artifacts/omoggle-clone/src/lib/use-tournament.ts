import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, ensureAuth } from "./supabase";

export type TournamentMode = "koth" | "group";
export type TournamentStatus = "lobby" | "running" | "ended";

export const MAX_ROOM_SIZE = 10;
const SCORE_BROADCAST_HZ = 8;

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  mode: TournamentMode;
  status: TournamentStatus;
  round_seconds: number;
  total_rounds: number;
  current_round: number;
  elimination: boolean;
  round_started_at: string | null;
  round_ends_at: string | null;
  active_a: string | null;
  active_b: string | null;
}

export interface ParticipantRow {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string | null;
  ready: boolean;
  queue_position: number | null;
  wins: number;
  cumulative_score: number;
  points: number;
  eliminated: boolean;
  joined_at: string;
}

export interface LiveScore {
  userId: string;
  score: number;
  peak: number;
  /** Last seen at (performance.now) — used to detect stale players. */
  lastAt: number;
}

export interface TournamentState {
  status: "idle" | "auth" | "ready" | "error";
  userId: string | null;
  errorMsg: string;
  room: RoomRow | null;
  participants: ParticipantRow[];
  liveScores: Record<string, LiveScore>;
  /** Wall-clock ms remaining in the active round, or null when not running. */
  msRemaining: number | null;
  isHost: boolean;
}

export interface TournamentControls {
  createRoom: (opts: { mode: TournamentMode; roundSeconds?: number; totalRounds?: number; elimination?: boolean; displayName?: string }) => Promise<string | null>;
  joinRoom: (code: string, displayName?: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  toggleReady: () => Promise<void>;
  startTournament: () => Promise<void>;
  /** Host-only: end the current round, write results, advance state. */
  endRound: (peaks: Record<string, number>) => Promise<void>;
  broadcastScore: (score: number, peak: number) => void;
  /** KOTH only: rotate the active match — loser goes to back of queue, next challenger pulled. */
  rotateKoth: (loserId: string, peaks: Record<string, number>) => Promise<void>;
}

function makeRoomCode(): string {
  // 6 chars, unambiguous alphabet (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Percentile rank in [0, 1], 1 = best. Ties share the higher rank. */
export function percentileRank(values: number[], target: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) if (v < target) below++;
  return below / Math.max(1, sorted.length - 1);
}

/** Allocate descending points: 1st gets N, 2nd N-1, ... */
export function pointsForRank(rank: number, total: number): number {
  return Math.max(0, total - rank);
}

export function useTournament(): TournamentState & TournamentControls {
  const [status, setStatus] = useState<TournamentState["status"]>("idle");
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({});
  const [msRemaining, setMsRemaining] = useState<number | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomRef = useRef<RoomRow | null>(null);
  const userIdRef = useRef<string | null>(null);
  const lastBroadcastRef = useRef(0);
  const tickRafRef = useRef(0);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const auth = useCallback(async () => {
    if (userIdRef.current) return userIdRef.current;
    setStatus("auth");
    const { userId: uid, error } = await ensureAuth();
    if (!uid) {
      setErrorMsg(error ?? "Could not sign in.");
      setStatus("error");
      return null;
    }
    setUserId(uid);
    setStatus("ready");
    return uid;
  }, []);

  /** Reload room + participants from DB (authoritative state refresh). */
  const refresh = useCallback(async (roomId: string) => {
    if (!supabase) return;
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("tournament_rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("tournament_participants").select("*").eq("room_id", roomId).order("joined_at", { ascending: true }),
    ]);
    if (r) setRoom(r as RoomRow);
    if (p) setParticipants(p as ParticipantRow[]);
  }, []);

  /** Subscribe to a room channel: presence + DB changes + score broadcasts. */
  const subscribeRoom = useCallback(async (roomId: string, code: string, uid: string) => {
    if (!supabase) return;

    // Tear down any previous channel.
    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current); } catch {}
      channelRef.current = null;
    }

    const ch = supabase.channel(`tournament:${code}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: uid } },
    });

    // Live score updates (ephemeral, high-frequency)
    ch.on("broadcast", { event: "score" }, ({ payload }) => {
      const { from, score, peak } = payload as { from: string; score: number; peak: number };
      if (from === userIdRef.current) return;
      setLiveScores((prev) => ({
        ...prev,
        [from]: { userId: from, score, peak: Math.max(prev[from]?.peak ?? 0, peak ?? score), lastAt: performance.now() },
      }));
    });

    // Host-emitted tick (server-authoritative timer broadcast for fine-grained sync).
    // We *also* derive ms remaining from the row's round_ends_at; this is a heartbeat.
    ch.on("broadcast", { event: "tick" }, () => {
      // No-op: timer state lives in `room.round_ends_at` (DB row). The tick exists
      // to nudge clients that may have missed a postgres_changes event.
    });

    // Postgres changes — authoritative state transitions
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournament_rooms", filter: `id=eq.${roomId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          setRoom(null);
          return;
        }
        setRoom(payload.new as RoomRow);
      },
    );
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournament_participants", filter: `room_id=eq.${roomId}` },
      () => { void refresh(roomId); },
    );

    await new Promise<void>((resolve) => {
      ch.subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          await ch.track({ user_id: uid, joined_at: Date.now() });
          resolve();
        }
      });
    });

    channelRef.current = ch;
    await refresh(roomId);
  }, [refresh]);

  /** Drive msRemaining from room.round_ends_at — single source of truth, monotonic. */
  useEffect(() => {
    if (tickRafRef.current) cancelAnimationFrame(tickRafRef.current);
    const loop = () => {
      const r = roomRef.current;
      if (r && r.status === "running" && r.round_ends_at) {
        const remaining = new Date(r.round_ends_at).getTime() - Date.now();
        setMsRemaining(Math.max(0, remaining));
      } else {
        setMsRemaining(null);
      }
      tickRafRef.current = requestAnimationFrame(loop);
    };
    tickRafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(tickRafRef.current);
  }, []);

  // Cleanup channel on unmount.
  useEffect(() => () => {
    if (channelRef.current && supabase) {
      try { supabase.removeChannel(channelRef.current); } catch {}
    }
    channelRef.current = null;
  }, []);

  // ---------------------------- Controls ---------------------------- //

  const createRoom = useCallback(async ({ mode, roundSeconds = 60, totalRounds = 5, elimination = false, displayName }: Parameters<TournamentControls["createRoom"]>[0]) => {
    if (!supabase) {
      setErrorMsg("Supabase not configured");
      setStatus("error");
      return null;
    }
    const uid = await auth();
    if (!uid) return null;

    // Retry on rare code collisions.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      const { data, error } = await supabase
        .from("tournament_rooms")
        .insert({ code, host_id: uid, mode, round_seconds: roundSeconds, total_rounds: totalRounds, elimination })
        .select("*")
        .single();
      if (!error && data) {
        const r = data as RoomRow;
        // Host auto-joins as a participant.
        await supabase.from("tournament_participants").insert({
          room_id: r.id,
          user_id: uid,
          display_name: displayName ?? null,
          queue_position: mode === "koth" ? 0 : null,
        });
        setRoom(r);
        await subscribeRoom(r.id, r.code, uid);
        return r.code;
      }
      // Unique-violation on code → retry; anything else → bail.
      if (error && (error as { code?: string }).code !== "23505") {
        setErrorMsg(error.message);
        return null;
      }
    }
    setErrorMsg("Could not allocate a room code");
    return null;
  }, [auth, subscribeRoom]);

  const joinRoom = useCallback(async (code: string, displayName?: string) => {
    if (!supabase) return false;
    const uid = await auth();
    if (!uid) return false;

    const normalized = code.trim().toUpperCase();
    const { data: r, error: rErr } = await supabase
      .from("tournament_rooms")
      .select("*")
      .eq("code", normalized)
      .maybeSingle();
    if (rErr || !r) {
      setErrorMsg("Room not found");
      return false;
    }
    const room = r as RoomRow;

    // Capacity check — RLS lets anyone read participants, so we check before insert.
    const { count } = await supabase
      .from("tournament_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);
    const existingCount = count ?? 0;

    const { data: existingSelf } = await supabase
      .from("tournament_participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", uid)
      .maybeSingle();

    if (!existingSelf) {
      if (existingCount >= MAX_ROOM_SIZE) {
        setErrorMsg(`Room is full (max ${MAX_ROOM_SIZE})`);
        return false;
      }
      if (room.status !== "lobby") {
        setErrorMsg("Tournament has already started");
        return false;
      }
      await supabase.from("tournament_participants").insert({
        room_id: room.id,
        user_id: uid,
        display_name: displayName ?? null,
        queue_position: room.mode === "koth" ? existingCount : null,
      });
    }

    setRoom(room);
    await subscribeRoom(room.id, room.code, uid);
    return true;
  }, [auth, subscribeRoom]);

  const leaveRoom = useCallback(async () => {
    const r = roomRef.current;
    const uid = userIdRef.current;
    if (!supabase || !r || !uid) return;
    await supabase
      .from("tournament_participants")
      .delete()
      .eq("room_id", r.id)
      .eq("user_id", uid);
    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current); } catch {}
      channelRef.current = null;
    }
    setRoom(null);
    setParticipants([]);
    setLiveScores({});
    setMsRemaining(null);
  }, []);

  const toggleReady = useCallback(async () => {
    const r = roomRef.current;
    const uid = userIdRef.current;
    if (!supabase || !r || !uid) return;
    const me = participants.find((p) => p.user_id === uid);
    await supabase
      .from("tournament_participants")
      .update({ ready: !(me?.ready ?? false) })
      .eq("room_id", r.id)
      .eq("user_id", uid);
  }, [participants]);

  const startTournament = useCallback(async () => {
    const r = roomRef.current;
    const uid = userIdRef.current;
    if (!supabase || !r || !uid || r.host_id !== uid) return;
    const now = new Date();
    const endsAt = new Date(now.getTime() + r.round_seconds * 1000);

    // For KOTH, pick the first two queued participants.
    const koth = r.mode === "koth";
    const ordered = [...participants].filter((p) => !p.eliminated).sort(
      (a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999),
    );
    const a = koth ? ordered[0]?.user_id ?? null : null;
    const b = koth ? ordered[1]?.user_id ?? null : null;

    await supabase
      .from("tournament_rooms")
      .update({
        status: "running",
        current_round: 1,
        round_started_at: now.toISOString(),
        round_ends_at: endsAt.toISOString(),
        active_a: a,
        active_b: b,
      })
      .eq("id", r.id);

    channelRef.current?.send({ type: "broadcast", event: "start", payload: { at: now.toISOString() } });
  }, [participants]);

  const endRound = useCallback(async (peaks: Record<string, number>) => {
    const r = roomRef.current;
    const uid = userIdRef.current;
    if (!supabase || !r || !uid || r.host_id !== uid) return;

    // Compute rankings + normalization across whoever competed this round.
    const competitors = r.mode === "koth"
      ? [r.active_a, r.active_b].filter((x): x is string => !!x)
      : participants.filter((p) => !p.eliminated).map((p) => p.user_id);

    const values = competitors.map((u) => peaks[u] ?? 0);
    const ranked = [...competitors].sort((a, b) => (peaks[b] ?? 0) - (peaks[a] ?? 0));
    const normalized: Record<string, number> = {};
    for (const u of competitors) normalized[u] = percentileRank(values, peaks[u] ?? 0);

    const winner = ranked[0] ?? null;

    await supabase.from("tournament_rounds").insert({
      room_id: r.id,
      round_number: r.current_round,
      ended_at: new Date().toISOString(),
      final_scores: peaks,
      normalized_scores: normalized,
      ranking: ranked,
      winner_id: winner,
    });

    // Update per-participant cumulative stats.
    const updates: Array<PromiseLike<unknown>> = [];
    for (let i = 0; i < ranked.length; i++) {
      const uid = ranked[i];
      const p = participants.find((x) => x.user_id === uid);
      if (!p) continue;
      const pts = pointsForRank(i, ranked.length);
      const isWinner = i === 0;
      updates.push(
        supabase.from("tournament_participants").update({
          wins: p.wins + (isWinner ? 1 : 0),
          cumulative_score: p.cumulative_score + (peaks[uid] ?? 0),
          points: p.points + pts,
        }).eq("id", p.id).then((res) => res),
      );
    }
    await Promise.all(updates);

    // Optional elimination: knock out the lowest scorer.
    if (r.elimination && ranked.length > 1) {
      const out = ranked[ranked.length - 1];
      const p = participants.find((x) => x.user_id === out);
      if (p) await supabase.from("tournament_participants").update({ eliminated: true }).eq("id", p.id);
    }

    // Advance: another round, or end.
    const nextRound = r.current_round + 1;
    const remaining = participants.filter((p) => !p.eliminated && p.user_id !== (r.elimination ? ranked[ranked.length - 1] : "")).length;
    const tournamentOver = nextRound > r.total_rounds || (r.elimination && remaining <= 1);

    if (tournamentOver) {
      await supabase.from("tournament_rooms").update({
        status: "ended",
        round_started_at: null,
        round_ends_at: null,
        active_a: null,
        active_b: null,
      }).eq("id", r.id);
    } else {
      const now = new Date();
      const endsAt = new Date(now.getTime() + r.round_seconds * 1000);
      // For KOTH, winner stays in, next challenger from queue.
      let nextA = r.active_a;
      let nextB = r.active_b;
      if (r.mode === "koth") {
        nextA = winner ?? r.active_a;
        const loserId = ranked[1];
        // Rotate: loser's position becomes max+1 so they go to back of queue.
        const queueOrdered = [...participants].filter((p) => !p.eliminated && p.user_id !== nextA).sort(
          (a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999),
        );
        const challenger = queueOrdered.find((p) => p.user_id !== loserId) ?? queueOrdered[0];
        nextB = challenger?.user_id ?? null;
        if (loserId) {
          const maxPos = participants.reduce((m, p) => Math.max(m, p.queue_position ?? 0), 0);
          await supabase.from("tournament_participants").update({ queue_position: maxPos + 1 })
            .eq("room_id", r.id).eq("user_id", loserId);
        }
      }
      await supabase.from("tournament_rooms").update({
        current_round: nextRound,
        round_started_at: now.toISOString(),
        round_ends_at: endsAt.toISOString(),
        active_a: nextA,
        active_b: nextB,
      }).eq("id", r.id);
    }

    channelRef.current?.send({ type: "broadcast", event: "round_end", payload: { round: r.current_round, winner } });
  }, [participants]);

  const rotateKoth = useCallback(async (loserId: string, peaks: Record<string, number>) => {
    // Convenience wrapper — KOTH uses the same advance logic as endRound.
    await endRound(peaks);
    void loserId;
  }, [endRound]);

  const broadcastScore = useCallback((score: number, peak: number) => {
    const now = performance.now();
    const minInterval = 1000 / SCORE_BROADCAST_HZ;
    if (now - lastBroadcastRef.current < minInterval) return;
    lastBroadcastRef.current = now;
    const uid = userIdRef.current;
    if (!uid) return;
    channelRef.current?.send({
      type: "broadcast",
      event: "score",
      payload: { from: uid, score, peak },
    });
  }, []);

  const isHost = !!(room && userId && room.host_id === userId);

  return {
    status,
    userId,
    errorMsg,
    room,
    participants,
    liveScores,
    msRemaining,
    isHost,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    startTournament,
    endRound,
    broadcastScore,
    rotateKoth,
  };
}
