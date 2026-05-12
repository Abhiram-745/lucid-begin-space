import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Leaderboard from "@/pages/leaderboard";
import Arena from "@/pages/arena";
import LiveArena from "@/pages/live-arena";
import Profile from "@/pages/profile";
import CameraCheck from "@/pages/camera-check";
import ScorerDebug from "@/pages/scorer-debug";
import TournamentEntry from "@/pages/tournament";
import TournamentLobby from "@/pages/tournament-lobby";
import TournamentKoth from "@/pages/tournament-koth";
import TournamentGroup from "@/pages/tournament-group";
import { useEffect } from "react";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/camera-check" component={CameraCheck} />
      <Route path="/arena/1v1" component={LiveArena} />
      <Route path="/arena" component={Arena} />
      <Route path="/tournament" component={TournamentEntry} />
      <Route path="/tournament/lobby/:code" component={TournamentLobby} />
      <Route path="/tournament/koth/:code" component={TournamentKoth} />
      <Route path="/tournament/group/:code" component={TournamentGroup} />
      <Route path="/profile" component={Profile} />
      <Route path="/scorer" component={ScorerDebug} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
