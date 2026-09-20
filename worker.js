export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/nfl-standings") {
      const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };
      try {
        const upstream = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings", { cf: { cacheTtl: 300 }, signal: AbortSignal.timeout(15000) });
        if (!upstream.ok) throw new Error("Standings source returned " + upstream.status);
        const data = await upstream.json();
        if (!Array.isArray(data.children)) throw new Error("Standings source is unavailable");
        return new Response(JSON.stringify(data), { headers });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 502, headers: { ...headers, "Cache-Control": "no-store" } });
      }
    }
    let sportKey = null;
    if (url.pathname === "/mlb") sportKey = "baseball_mlb";
    if (url.pathname === "/ncaaf") sportKey = "americanfootball_ncaaf";
    if (url.pathname === "/nfl") sportKey = "americanfootball_nfl";
    if (!sportKey) {
      return new Response("P.V. House Sports API is running.", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }
    const oddsURL = "https://api.the-odds-api.com/v4/sports/" + sportKey + "/odds/" + "?apiKey=" + encodeURIComponent(env.ODDS_API_KEY) + "&regions=us" + "&markets=h2h,spreads,totals" + "&oddsFormat=american" + "&dateFormat=iso";
    const scoresURL = "https://api.the-odds-api.com/v4/sports/" + sportKey + "/scores/" + "?apiKey=" + encodeURIComponent(env.ODDS_API_KEY) + "&daysFrom=3" + "&dateFormat=iso";
    try {
      const [oddsResponse, scoresResponse] = await Promise.all([fetch(oddsURL), fetch(scoresURL)]);
      if (!oddsResponse.ok) {
        const details = await oddsResponse.text();
        return new Response(JSON.stringify({ error: "Odds request failed", status: oddsResponse.status, details }), { status: oddsResponse.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
      if (!scoresResponse.ok) {
        const details = await scoresResponse.text();
        return new Response(JSON.stringify({ error: "Scores request failed", status: scoresResponse.status, details }), { status: scoresResponse.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
      const odds = await oddsResponse.json();
      const scores = await scoresResponse.json();
      const scoreLookup = {};
      for (const scoreGame of scores) scoreLookup[scoreGame.id] = scoreGame;
      const mergedGames = odds.map(game => {
        const scoreGame = scoreLookup[game.id];
        return { ...game, completed: scoreGame ? scoreGame.completed : false, scores: scoreGame && scoreGame.scores ? scoreGame.scores : null, last_update: scoreGame ? scoreGame.last_update : null };
      });
      return new Response(JSON.stringify(mergedGames), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  }
};
