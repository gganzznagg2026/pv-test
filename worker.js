export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    /*
      P.V. HOUSE SPORTS DATA SERVICE

      /mlb   = MLB odds + scores
      /ncaaf = NCAA Football odds + scores
      /nfl   = NFL odds + scores
    */

    let sportKey = null;

    if (url.pathname === "/mlb") {
      sportKey = "baseball_mlb";
    }

    if (url.pathname === "/ncaaf") {
      sportKey = "americanfootball_ncaaf";
    }

    if (url.pathname === "/nfl") {
      sportKey = "americanfootball_nfl";
    }

    if (!sportKey) {
      return new Response(
        "P.V. House Sports API is running.",
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain"
          }
        }
      );
    }

    const oddsURL =
      "https://api.the-odds-api.com/v4/sports/" +
      sportKey +
      "/odds/" +
      "?apiKey=" +
      encodeURIComponent(env.ODDS_API_KEY) +
      "&regions=us" +
      "&markets=h2h,spreads,totals" +
      "&oddsFormat=american" +
      "&dateFormat=iso";

    const scoresURL =
      "https://api.the-odds-api.com/v4/sports/" +
      sportKey +
      "/scores/" +
      "?apiKey=" +
      encodeURIComponent(env.ODDS_API_KEY) +
      "&daysFrom=3" +
      "&dateFormat=iso";

    try { if (false) { const espnDate = url.searchParams.get("dates"); const espnURL = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard" + (espnDate ? "?dates=" + encodeURIComponent(espnDate) : ""); const espnResponse = await fetch(espnURL); return new Response(await espnResponse.text(), { status: espnResponse.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" } }); }

      const [oddsResponse, scoresResponse] =
        await Promise.all([
          fetch(oddsURL),
          fetch(scoresURL)
        ]);

      if (!oddsResponse.ok) {
        const details = await oddsResponse.text();

        return new Response(
          JSON.stringify({
            error: "Odds request failed",
            status: oddsResponse.status,
            details
          }),
          {
            status: oddsResponse.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }

      if (!scoresResponse.ok) {
        const details = await scoresResponse.text();

        return new Response(
          JSON.stringify({
            error: "Scores request failed",
            status: scoresResponse.status,
            details
          }),
          {
            status: scoresResponse.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }

      const odds = await oddsResponse.json();
      const scores = await scoresResponse.json();

      const scoreLookup = {};

      for (const scoreGame of scores) {
        scoreLookup[scoreGame.id] = scoreGame;
      }

      const mergedGames = odds.map(game => {
        const scoreGame = scoreLookup[game.id];

        return {
          ...game,
          completed: scoreGame
            ? scoreGame.completed
            : false,
          scores: scoreGame && scoreGame.scores
            ? scoreGame.scores
            : null,
          last_update: scoreGame
            ? scoreGame.last_update
            : null
        };
      });

      return new Response(
        JSON.stringify(sportKey === "baseball_mlb" ? {events: mergedGames.concat(sportKey === "baseball_mlb" ? scores.filter(scoreGame => !mergedGames.some(game => game.id === scoreGame.id)).map(scoreGame => ({id: scoreGame.id, commence_time: scoreGame.commence_time, home_team: scoreGame.home_team, away_team: scoreGame.away_team, completed: scoreGame.completed, scores: scoreGame.scores || null, bookmakers: []})) : []).map(game => { const byName = {}; (game.scores || []).forEach(score => { byName[score.name] = score.score; }); return {id: game.id, date: game.commence_time, competitions: [{competitors: [{homeAway: "away", team: {displayName: game.away_team}, score: byName[game.away_team] || "—"}, {homeAway: "home", team: {displayName: game.home_team}, score: byName[game.home_team] || "—"}], status: {type: {completed: game.completed === true, state: game.completed === true ? "post" : "pre"}}}]};})} : mergedGames),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300"
          }
        }
      );

    } catch (error) {

      return new Response(
        JSON.stringify({
          error: error.message
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );

    }
  }
};
