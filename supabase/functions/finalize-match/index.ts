import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const K = 32;
function eloDelta(rA: number, rB: number, scoreA: number) {
  const exp = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return Math.round(K * (scoreA - exp));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { match_id, scores, peak_scores, reason } = body as {
      match_id: string;
      scores: Record<string, number>;
      peak_scores: Record<string, number>;
      reason?: string;
    };
    if (!match_id || !scores) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: match, error: matchErr } = await admin
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .single();
    if (matchErr || !match) throw matchErr ?? new Error("Match not found");
    if (match.ended_at) {
      return new Response(
        JSON.stringify({ status: "already_finalized", match }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const playerIds = [match.player_a, match.player_b];
    if (!playerIds.includes(userData.user.id)) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sA = Number(scores[match.player_a] ?? 0);
    const sB = Number(scores[match.player_b] ?? 0);
    const winner = sA === sB ? null : sA > sB ? match.player_a : match.player_b;

    await admin
      .from("matches")
      .update({ winner_id: winner, ended_at: new Date().toISOString() })
      .eq("id", match_id);

    await admin.from("rounds").insert({
      match_id,
      round_number: 1,
      winner_id: winner,
      final_scores: { ...scores, reason: reason ?? "time" },
    });

    // ELO update
    const { data: stats } = await admin
      .from("player_stats")
      .select("user_id, elo, peak_score, wins, losses, matches_played")
      .in("user_id", playerIds);

    const get = (id: string) =>
      stats?.find((s: any) => s.user_id === id) ?? {
        user_id: id, elo: 1000, peak_score: 0, wins: 0, losses: 0, matches_played: 0,
      };
    const a = get(match.player_a);
    const b = get(match.player_b);
    const winA = winner === match.player_a ? 1 : winner === null ? 0.5 : 0;
    const dA = eloDelta(a.elo, b.elo, winA);
    const dB = -dA;

    const updates = [
      {
        user_id: match.player_a,
        elo: a.elo + dA,
        wins: a.wins + (winA === 1 ? 1 : 0),
        losses: a.losses + (winA === 0 ? 1 : 0),
        peak_score: Math.max(a.peak_score, peak_scores?.[match.player_a] ?? sA),
        matches_played: a.matches_played + 1,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: match.player_b,
        elo: b.elo + dB,
        wins: b.wins + (winA === 0 ? 1 : 0),
        losses: b.losses + (winA === 1 ? 1 : 0),
        peak_score: Math.max(b.peak_score, peak_scores?.[match.player_b] ?? sB),
        matches_played: b.matches_played + 1,
        updated_at: new Date().toISOString(),
      },
    ];
    await admin.from("player_stats").upsert(updates, { onConflict: "user_id" });

    return new Response(
      JSON.stringify({ status: "ok", winner, elo_change: { [match.player_a]: dA, [match.player_b]: dB } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});