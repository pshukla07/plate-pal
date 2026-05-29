import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Upload, Sparkles, Loader2, RotateCcw, Flame, Check, CalendarDays, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBowl from "@/assets/hero-bowl.jpg";

type FoodItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Totals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type AnalysisResult = {
  status?: string;
  food: FoodItem[];
  total: Totals;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const Index = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    const apply = (session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } } | null) => {
      setUserId(session?.user.id ?? null);
      if (session?.user) {
        const meta = session.user.user_metadata ?? {};
        const name = (meta.full_name as string) || (meta.name as string) || session.user.email || null;
        setUserLabel(name);
      } else {
        setUserLabel(null);
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const logMeal = async () => {
    if (!result) return;
    if (!userId) {
      toast.error("Sign in to log meals");
      return;
    }
    setLogging(true);
    const { error } = await supabase.from("meal_logs").insert({
      user_id: userId,
      calories: result.total.calories,
      protein: result.total.protein,
      carbs: result.total.carbs,
      fat: result.total.fat,
      items: result.food,
    });
    setLogging(false);
    if (error) return toast.error(error.message);
    setLogged(true);
    toast.success("Logged to today");
    navigate("/today");
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB).");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    setResult(null);
    await analyze(dataUrl);
  };

  const analyze = async (image: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-meal", {
        body: { image },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.food || !Array.isArray(data.food)) {
        throw new Error("Unexpected response from analyzer.");
      }
      setResult(data as AnalysisResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyze.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setLogged(false);
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
        {userId ? (
          <Link to="/today" className="flex items-center gap-2">
            {userLabel && (
              <span className="hidden sm:inline text-xs text-muted-foreground max-w-[160px] truncate">
                {userLabel}
              </span>
            )}
            <Button size="sm" variant="ghost" className="rounded-xl">
              <CalendarDays className="w-4 h-4 mr-1" /> Today
            </Button>
          </Link>
        ) : (
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
        )}
      </header>

      <section className="container max-w-2xl px-4 pb-16">
        {!preview && !result && (
          <div className="animate-fade-up">
            <h1 className="font-display text-5xl sm:text-6xl font-semibold leading-[1.05] tracking-tight text-balance mt-4">
              Snap your meal.
              <br />
              <span className="bg-gradient-to-r from-[hsl(142_45%_38%)] via-[hsl(142_50%_45%)] to-[hsl(28_75%_58%)] bg-clip-text text-transparent">
                Know your macros.
              </span>
            </h1>
            <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed text-balance max-w-md">
              Take a photo of any dish and get an instant breakdown of every ingredient — calories, protein, carbs, and fat.
            </p>

            <div className="mt-7 relative">
              <div className="absolute -inset-4 gradient-hero opacity-15 blur-3xl rounded-full" aria-hidden />
              <img
                src={heroBowl}
                alt="A vibrant healthy bowl with grilled salmon, quinoa, avocado and greens"
                width={1024}
                height={1024}
                className="relative w-full aspect-square object-cover rounded-3xl shadow-card animate-float"
              />
            </div>

            <div className="mt-7 grid grid-cols-[1.4fr_1fr] gap-2.5">
              <Button
                size="lg"
                onClick={() => cameraInputRef.current?.click()}
                className="h-14 rounded-2xl gradient-hero text-primary-foreground shadow-glow font-medium tracking-tight hover:opacity-95 transition-all hover:scale-[1.02]"
              >
                <Camera className="w-5 h-5 mr-2" />
                Take photo
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-14 rounded-2xl bg-card border-border/80 text-foreground font-medium tracking-tight shadow-soft hover:bg-secondary hover:scale-[1.02] transition-all"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Works best with a clear, well-lit photo of a single plate.
            </p>
          </div>
        )}

        {preview && (
          <div className="animate-scale-in mt-6">
            <div className="relative rounded-3xl overflow-hidden shadow-card">
              <img src={preview} alt="Your meal" className="w-full aspect-square object-cover" />
              {loading && (
                <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm flex flex-col items-center justify-center text-primary-foreground">
                  <Loader2 className="w-10 h-10 animate-spin mb-3" />
                  <span className="font-display text-xl">Analyzing your plate…</span>
                </div>
              )}
            </div>

            {result && (
              <div className="mt-6 space-y-4 animate-fade-up">
                {/* Totals card */}
                <div className="bg-card rounded-3xl p-6 shadow-card">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Total for this plate
                      </p>
                      <h2 className="font-display text-3xl font-semibold mt-1 flex items-center gap-2">
                        <Flame className="w-6 h-6 text-accent" />
                        {Math.round(result.total.calories)}
                        <span className="text-base font-sans font-medium text-muted-foreground">
                          kcal
                        </span>
                      </h2>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <MacroCard label="Protein" value={result.total.protein} color="protein" />
                    <MacroCard label="Carbs" value={result.total.carbs} color="carbs" />
                    <MacroCard label="Fat" value={result.total.fat} color="fat" />
                  </div>
                </div>

                {/* Per-item breakdown */}
                <div className="bg-card rounded-3xl shadow-card overflow-hidden">
                  <div className="px-6 pt-5 pb-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Detected ingredients
                    </p>
                    <h3 className="font-display text-xl font-semibold mt-1">
                      {result.food.length} {result.food.length === 1 ? "item" : "items"}
                    </h3>
                  </div>
                  <ul className="divide-y divide-border">
                    {result.food.map((item, i) => (
                      <li key={i} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium leading-tight truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium shrink-0">
                            <Flame className="w-3.5 h-3.5 text-accent" />
                            {Math.round(item.calories)}
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 text-[11px] font-medium">
                          <Pill label="P" value={item.protein} color="protein" />
                          <Pill label="C" value={item.carbs} color="carbs" />
                          <Pill label="F" value={item.fat} color="fat" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Estimates only — values may vary based on preparation.
                </p>

                {userId ? (
                  <Button
                    onClick={logMeal}
                    disabled={logging || logged}
                    size="lg"
                    className="w-full h-14 rounded-2xl gradient-hero text-primary-foreground shadow-glow font-medium"
                  >
                    {logged ? (
                      <><Check className="w-4 h-4 mr-2" /> Logged to today</>
                    ) : logging ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging…</>
                    ) : (
                      <>Log this meal</>
                    )}
                  </Button>
                ) : (
                  <Link to="/auth" className="block">
                    <Button size="lg" className="w-full h-14 rounded-2xl gradient-hero text-primary-foreground shadow-glow font-medium">
                      Sign in to log this meal
                    </Button>
                  </Link>
                )}

                <Button
                  onClick={reset}
                  variant="secondary"
                  size="lg"
                  className="w-full h-14 rounded-2xl shadow-soft"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Analyze another plate
                </Button>
              </div>
            )}

            {!loading && !result && (
              <Button onClick={reset} variant="secondary" size="lg" className="mt-4 w-full h-14 rounded-2xl">
                Cancel
              </Button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </section>
    </main>
  );
};

const MacroCard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "protein" | "carbs" | "fat";
}) => {
  const colorMap = {
    protein: "bg-protein/15 text-protein",
    carbs: "bg-carbs/15 text-carbs",
    fat: "bg-fat/15 text-fat",
  } as const;
  return (
    <div className={`rounded-2xl p-4 ${colorMap[color]}`}>
      <p className="text-xs uppercase tracking-wider font-semibold opacity-80">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-foreground">
        {Math.round(value * 10) / 10}
        <span className="text-sm font-sans font-medium text-muted-foreground ml-1">g</span>
      </p>
    </div>
  );
};

const Pill = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "protein" | "carbs" | "fat";
}) => {
  const colorMap = {
    protein: "bg-protein/15 text-protein",
    carbs: "bg-carbs/15 text-carbs",
    fat: "bg-fat/15 text-fat",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${colorMap[color]}`}>
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{Math.round(value * 10) / 10}g</span>
    </span>
  );
};

export default Index;
