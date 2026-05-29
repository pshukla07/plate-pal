import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Camera, Flame, LogOut, Settings2, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Goal = { calories: number; protein: number; carbs: number; fat: number };
type Log = {
  id: string;
  created_at: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: { name: string; quantity: string }[];
};

const DEFAULT_GOAL: Goal = { calories: 2000, protein: 150, carbs: 220, fat: 65 };
const todayStr = () => new Date().toISOString().slice(0, 10);

const Today = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const [logs, setLogs] = useState<Log[]>([]);
  const [editingGoal, setEditingGoal] = useState(false);
  const [draftGoal, setDraftGoal] = useState<Goal>(DEFAULT_GOAL);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/auth", { replace: true });
        return;
      }
      setUserId(data.session.user.id);
    });
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: g } = await supabase.from("goals").select("*").eq("user_id", userId).maybeSingle();
      if (g) {
        const next = { calories: +g.calories, protein: +g.protein, carbs: +g.carbs, fat: +g.fat };
        setGoal(next);
        setDraftGoal(next);
      }
      const { data: l } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("logged_date", todayStr())
        .order("created_at", { ascending: false });
      if (l) setLogs(l as unknown as Log[]);
    })();
  }, [userId]);

  const totals = logs.reduce(
    (a, l) => ({
      calories: a.calories + +l.calories,
      protein: a.protein + +l.protein,
      carbs: a.carbs + +l.carbs,
      fat: a.fat + +l.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const over = {
    calories: totals.calories > goal.calories,
    protein: totals.protein > goal.protein,
    carbs: totals.carbs > goal.carbs,
    fat: totals.fat > goal.fat,
  };
  const anyOver = over.calories || over.protein || over.carbs || over.fat;

  const overflowSuggestion = () => {
    const excess: { k: keyof Goal; amt: number }[] = [];
    (Object.keys(over) as (keyof Goal)[]).forEach((k) => {
      if (over[k]) excess.push({ k, amt: totals[k] - goal[k] });
    });
    excess.sort((a, b) => b.amt - a.amt);
    const top = excess[0];
    if (!top) return "";
    const unit = top.k === "calories" ? "kcal" : "g";
    const tips: Record<keyof Goal, string> = {
      calories: "consider smaller portions or a lighter dinner",
      carbs: "try reducing rice, bread, or sugary drinks",
      protein: "ease up on protein-heavy sides or shakes",
      fat: "cut back on oils, cheese, or fried items",
    };
    return `You're ${Math.round(top.amt)}${unit} over your ${top.k} target — ${tips[top.k]}.`;
  };

  const saveGoal = async () => {
    if (!userId) return;
    const { error } = await supabase.from("goals").upsert({ user_id: userId, ...draftGoal });
    if (error) return toast.error(error.message);
    setGoal(draftGoal);
    setEditingGoal(false);
    toast.success("Goals saved");
  };

  const deleteLog = async (id: string) => {
    const { error } = await supabase.from("meal_logs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <main className="min-h-screen">
      <header className="container max-w-2xl pt-8 pb-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl gradient-hero flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold">WhatsInMyPlate</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditingGoal((v) => !v)}>
            <Settings2 className="w-4 h-4 mr-1" /> Goals
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <section className="container max-w-2xl px-4 pb-24 space-y-4">
        {anyOver && (
          <div className="rounded-3xl p-5 bg-destructive/10 border border-destructive/30 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Over your daily target</p>
              <p className="text-sm text-foreground/80 mt-1">{overflowSuggestion()}</p>
            </div>
          </div>
        )}

        {editingGoal && (
          <div className="bg-card rounded-3xl p-6 shadow-card space-y-3">
            <h3 className="font-display text-lg font-semibold">Daily goals</h3>
            {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <Label className="capitalize">{k}</Label>
                <Input
                  type="number"
                  className="w-28 h-10 rounded-xl"
                  value={draftGoal[k]}
                  onChange={(e) => setDraftGoal({ ...draftGoal, [k]: +e.target.value })}
                />
              </div>
            ))}
            <Button onClick={saveGoal} className="w-full h-11 rounded-2xl gradient-hero text-primary-foreground">
              Save goals
            </Button>
          </div>
        )}

        <div className="bg-card rounded-3xl p-6 shadow-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </p>
          <h2 className="font-display text-3xl font-semibold mt-1 flex items-center gap-2">
            <Flame className="w-6 h-6 text-accent" />
            {Math.round(totals.calories)}
            <span className="text-base font-sans font-medium text-muted-foreground">
              / {goal.calories} kcal
            </span>
          </h2>
          <Progress value={Math.min(100, (totals.calories / goal.calories) * 100)} className="mt-3 h-2" />

          <div className="mt-5 grid grid-cols-3 gap-3">
            <MacroBar label="Protein" value={totals.protein} goal={goal.protein} color="protein" over={over.protein} />
            <MacroBar label="Carbs" value={totals.carbs} goal={goal.carbs} color="carbs" over={over.carbs} />
            <MacroBar label="Fat" value={totals.fat} goal={goal.fat} color="fat" over={over.fat} />
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Logged meals</p>
              <h3 className="font-display text-xl font-semibold mt-1">
                {logs.length} {logs.length === 1 ? "entry" : "entries"}
              </h3>
            </div>
            <Link to="/">
              <Button size="sm" className="rounded-xl gradient-hero text-primary-foreground">
                <Camera className="w-4 h-4 mr-1" /> Log meal
              </Button>
            </Link>
          </div>
          {logs.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No meals logged yet. Snap your first plate.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {l.items.map((i) => i.name).join(", ") || "Meal"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {Math.round(+l.calories)} kcal · P{Math.round(+l.protein)} C{Math.round(+l.carbs)} F{Math.round(+l.fat)}
                      </p>
                    </div>
                    <button onClick={() => deleteLog(l.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
};

const MacroBar = ({
  label, value, goal, color, over,
}: { label: string; value: number; goal: number; color: "protein" | "carbs" | "fat"; over: boolean }) => {
  const colorMap = {
    protein: "bg-protein/15 text-protein",
    carbs: "bg-carbs/15 text-carbs",
    fat: "bg-fat/15 text-fat",
  } as const;
  return (
    <div className={`rounded-2xl p-4 ${colorMap[color]} ${over ? "ring-2 ring-destructive/60" : ""}`}>
      <p className="text-xs uppercase tracking-wider font-semibold opacity-80">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-foreground">
        {Math.round(value * 10) / 10}
        <span className="text-xs font-sans font-medium text-muted-foreground ml-1">/ {goal}g</span>
      </p>
      <Progress value={Math.min(100, (value / goal) * 100)} className="mt-2 h-1.5" />
    </div>
  );
};

export default Today;
