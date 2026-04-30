import { useRef, useState } from "react";
import { Camera, Upload, Sparkles, Loader2, RotateCcw, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroBowl from "@/assets/hero-bowl.jpg";

type MacroResult = {
  dish: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "low" | "medium" | "high";
  notes?: string;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MacroResult | null>(null);

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
      setResult(data as MacroResult);
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
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="container max-w-2xl pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl gradient-hero flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold">WhatsInMyPlate</span>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">AI macro analysis</span>
      </header>

      <section className="container max-w-2xl px-4 pb-16">
        {!preview && !result && (
          <div className="animate-fade-up">
            <h1 className="font-display text-5xl sm:text-6xl font-semibold leading-[1.05] tracking-tight text-balance mt-6">
              Snap your meal.
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
                Know your macros.
              </span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed text-balance">
              Take a photo of any dish and get instant protein, carbs, and fat estimates — powered by AI.
            </p>

            <div className="mt-10 relative">
              <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" aria-hidden />
              <img
                src={heroBowl}
                alt="A vibrant healthy bowl with grilled salmon, quinoa, avocado and greens"
                width={1024}
                height={1024}
                className="relative w-full aspect-square object-cover rounded-3xl shadow-card animate-float"
              />
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Button
                size="lg"
                onClick={() => cameraInputRef.current?.click()}
                className="h-16 rounded-2xl gradient-hero text-primary-foreground shadow-glow hover:opacity-95 transition-all hover:scale-[1.02]"
              >
                <Camera className="w-5 h-5 mr-2" />
                Take photo
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="h-16 rounded-2xl shadow-soft hover:scale-[1.02] transition-all"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload
              </Button>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
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
                <div className="bg-card rounded-3xl p-6 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Detected dish
                      </p>
                      <h2 className="font-display text-2xl font-semibold mt-1">{result.dish}</h2>
                    </div>
                    <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-full text-xs font-medium">
                      <Flame className="w-3.5 h-3.5 text-accent" />
                      {Math.round(result.calories)} kcal
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <MacroCard label="Protein" value={result.protein_g} color="protein" />
                    <MacroCard label="Carbs" value={result.carbs_g} color="carbs" />
                    <MacroCard label="Fat" value={result.fat_g} color="fat" />
                  </div>

                  {result.notes && (
                    <p className="mt-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                      {result.notes}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Confidence:{" "}
                    <span className="font-medium capitalize text-foreground">{result.confidence}</span> · Estimates only
                  </p>
                </div>

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
        {Math.round(value)}
        <span className="text-sm font-sans font-medium text-muted-foreground ml-1">g</span>
      </p>
    </div>
  );
};

export default Index;
