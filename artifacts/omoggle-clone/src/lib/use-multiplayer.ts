import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, ensureAuth } from "./supabase";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export type MultiplayerStatus =
  | "idle"
  | "auth"
  | "queueing"
  | "waiting"
  | "connecting"
  | "live"
  | "ended"
  | "error";

export interface MultiplayerState {
  status: MultiplayerStatus;
  userId: string | null;
  matchId: string | null;
  isPlayerA: boolean;
  remoteStream: MediaStream | null;
  opponentScore: number;
  opponentPeak: number;
  opponentLeft: boolean;
  errorMsg: string;
}

export interface MultiplayerControls {
  start: (localStream: MediaStream) => Promise<void>;
  broadcastScore: (score: number) => void;
  broadcastEvent: (type: string) => void;
  finalize: (params: { localScore: number; localPeak: number; reason?: string }) => Promise<void>;
  leave: () => void;
  onOpponentEvent: (cb: (type: string) => void) => () => void;
}

export function useMultiplayer(): MultiplayerState & MultiplayerControls {
  const [status, setStatus] = useState<MultiplayerStatus>("idle");
  const [userId, setUserId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isPlayerA, setIsPlayerA] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentPeak, setOpponentPeak] = useState(0);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lobbyRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const lastBroadcastRef = useRef(0);
  const opponentIdRef = useRef<string | null>(null);
  const eventSubsRef = useRef<Set<(t: string) => void>>(new Set());
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const finalizedRef = useRef(false);

  /** Tear down everything */
  const cleanup = () => {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    if (channelRef.current && supabase) supabase.removeChannel(channelRef.current);
    if (lobbyRef.current && supabase) supabase.removeChannel(lobbyRef.current);
    channelRef.current = null;
    lobbyRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  /** Wire a match channel: WebRTC signaling + score/event broadcast. */
  const wireMatchChannel = async (
    matchIdLocal: string,
    selfId: string,
    asPlayerA: boolean,
    localStream: MediaStream,
  ) => {
    if (!supabase) throw new Error("No supabase client");
    setStatus("connecting");

    const { data: matchRow } = await supabase
      .from("matches")
      .select("player_a, player_b")
      .eq("id", matchIdLocal)
      .maybeSingle();
    if (matchRow) {
      opponentIdRef.current =
        matchRow.player_a === selfId ? matchRow.player_b : matchRow.player_a;
    }

    const ch = supabase.channel(`match:${matchIdLocal}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: selfId } },
    });
    channelRef.current = ch;

    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;

    // Add local tracks
    for (const t of localStream.getTracks()) pc.addTrack(t, localStream);

    // Remote stream collector
    const remote = new MediaStream();
    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((tr) => remote.addTrack(tr));
      setRemoteStream(remote);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        ch.send({ type: "broadcast", event: "ice", payload: { from: selfId, candidate: ev.candidate.toJSON() } });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("live");
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setOpponentLeft(true);
      }
    };

    // Inbound signaling
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.from === selfId) return;
      opponentIdRef.current = payload.from;
      await pc.setRemoteDescription(payload.sdp);
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      ch.send({ type: "broadcast", event: "answer", payload: { from: selfId, sdp: ans } });
      // flush pending ICE
      for (const c of pendingIceRef.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIceRef.current = [];
    });

    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.from === selfId) return;
      opponentIdRef.current = payload.from;
      await pc.setRemoteDescription(payload.sdp);
      for (const c of pendingIceRef.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIceRef.current = [];
    });

    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.from === selfId) return;
      if (!pc.remoteDescription) {
        pendingIceRef.current.push(payload.candidate);
      } else {
        await pc.addIceCandidate(payload.candidate).catch(() => {});
      }
    });

    ch.on("broadcast", { event: "score" }, ({ payload }) => {
      if (payload.from === selfId) return;
      setOpponentScore(payload.score);
      setOpponentPeak((p) => Math.max(p, payload.score));
    });

    ch.on("broadcast", { event: "event" }, ({ payload }) => {
      if (payload.from === selfId) return;
      eventSubsRef.current.forEach((cb) => cb(payload.kind));
    });

    ch.on("presence", { event: "leave" }, ({ leftPresences }) => {
      const ids = leftPresences.map((p: any) => p.presence_ref);
      if (ids.length) setOpponentLeft(true);
    });

    await new Promise<void>((resolve, reject) => {
      ch.subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          await ch.track({ joined_at: Date.now(), user_id: selfId });
          resolve();
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          reject(new Error(s));
        }
      });
    });

    // Player A initiates the offer once channel is up.
    if (asPlayerA) {
      // brief delay so B has a chance to subscribe
      setTimeout(async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ch.send({ type: "broadcast", event: "offer", payload: { from: selfId, sdp: offer } });
      }, 600);
    }
  };

  const start = async (localStream: MediaStream) => {
    if (!supabase) {
      setErrorMsg("Supabase not configured");
      setStatus("error");
      return;
    }
    localStreamRef.current = localStream;
    finalizedRef.current = false;
    opponentIdRef.current = null;
    setStatus("auth");
    const { userId: uid, error: authErr } = await ensureAuth();
    if (!uid) {
      setErrorMsg(
        authErr ??
          "Could not create a session. Enable Anonymous or Email (no confirm) in Supabase Auth providers.",
      );
      setStatus("error");
      return;
    }
    setUserId(uid);

    // Lobby channel: receives 'matched' notifications when someone pairs with us as player A.
    const lobby = supabase.channel(`user:${uid}`, { config: { broadcast: { self: false } } });
    lobbyRef.current = lobby;
    lobby.on("broadcast", { event: "matched" }, async ({ payload }) => {
      if (channelRef.current) return;
      setMatchId(payload.match_id);
      setIsPlayerA(true);
      await wireMatchChannel(payload.match_id, uid, true, localStream);
    });
    await new Promise<void>((res) => lobby.subscribe((s) => s === "SUBSCRIBED" && res()));

    setStatus("queueing");
    const session = (await supabase.auth.getSession()).data.session;
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/matchmaker`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    const out = await resp.json();
    if (out.status === "matched") {
      setMatchId(out.match.id);
      // We are player_b (we joined while opponent was waiting).
      setIsPlayerA(false);
      // Notify opponent (who is player_a) via their lobby channel.
      const notify = supabase.channel(`user:${out.match.player_a}`);
      await new Promise<void>((res) =>
        notify.subscribe((s) => s === "SUBSCRIBED" && res()),
      );
      notify.send({ type: "broadcast", event: "matched", payload: { match_id: out.match.id } });
      // small delay then remove
      setTimeout(() => { try { supabase!.removeChannel(notify); } catch {} }, 1500);
      await wireMatchChannel(out.match.id, uid, false, localStream);
    } else {
      setStatus("waiting");
    }
  };

  const broadcastScore = (score: number) => {
    const now = performance.now();
    if (now - lastBroadcastRef.current < 100) return; // 10 Hz cap
    lastBroadcastRef.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "score",
      payload: { from: userId, score },
    });
  };

  const broadcastEvent = (kind: string) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "event",
      payload: { from: userId, kind },
    });
  };

  const finalize = async ({ localScore, localPeak, reason }: { localScore: number; localPeak: number; reason?: string }) => {
    if (!supabase || !matchId || !userId || finalizedRef.current) return;
    finalizedRef.current = true;
    const oppId = opponentIdRef.current ?? "opponent";
    const session = (await supabase.auth.getSession()).data.session;
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finalize-match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          match_id: matchId,
          scores: { [userId]: localScore, [oppId]: opponentScore },
          peak_scores: { [userId]: localPeak, [oppId]: opponentPeak },
          reason: reason ?? "time",
        }),
      });
    } catch (e) {
      console.warn("finalize failed", e);
    }
    setStatus("ended");
  };

  const leave = () => {
    cleanup();
    finalizedRef.current = false;
    opponentIdRef.current = null;
    setStatus("idle");
    setRemoteStream(null);
    setOpponentScore(0);
    setOpponentPeak(0);
    setOpponentLeft(false);
    setMatchId(null);
  };

  const onOpponentEvent = (cb: (t: string) => void) => {
    eventSubsRef.current.add(cb);
    return () => eventSubsRef.current.delete(cb) as unknown as void;
  };

  return {
    status, userId, matchId, isPlayerA, remoteStream,
    opponentScore, opponentPeak, opponentLeft, errorMsg,
    start, broadcastScore, broadcastEvent, finalize, leave, onOpponentEvent,
  };
}