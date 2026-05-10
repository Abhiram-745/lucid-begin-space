import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Look for an existing waiting opponent (not self).
    const { data: waiters } = await admin
      .from("matchmaking_queue")
      .select("user_id, joined_at")
      .neq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (waiters && waiters.length > 0) {
      const opponent = waiters[0];
      // Pop both from queue (best-effort).
      await admin
        .from("matchmaking_queue")
        .delete()
        .in("user_id", [userId, opponent.user_id]);

      const { data: match, error: matchErr } = await admin
        .from("matches")
        .insert({ player_a: opponent.user_id, player_b: userId })
        .select()
        .single();
      if (matchErr) throw matchErr;

      return new Response(
        JSON.stringify({ status: "matched", match }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Otherwise enqueue self.
    await admin
      .from("matchmaking_queue")
      .upsert({ user_id: userId }, { onConflict: "user_id" });

    return new Response(
      JSON.stringify({ status: "waiting" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});