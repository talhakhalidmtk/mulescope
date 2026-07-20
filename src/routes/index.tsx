import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  FileCode2,
  FileJson,
  FileSearch,
  Github,
  Loader2,
  Network,
  Radar,
  Terminal,
  Upload,
  Wand2,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadDropzone } from "@/components/import/UploadDropzone";
import { FeaturesDialog } from "@/components/import/FeaturesDialog";
import { LiveDemo } from "@/components/import/LiveDemo";
import { MethodBadge } from "@/components/workspace/MethodBadge";
import { parseAsync, parseAsyncSources } from "@/lib/parse-async";
import { setCollection } from "@/lib/log-store";
import type { ParsedCollection } from "@/lib/types";
import { SAMPLE_LOG } from "@/lib/sample-log";
import { cn } from "@/lib/utils";
import { SITE_URL } from "./__root";

const PAGE_TITLE = "MuleScope - Mule Log to Postman Collection & OpenAPI Spec Generator";
const PAGE_DESCRIPTION =
  "Free tool to reverse-engineer a Mule application's API from its runtime logs. Upload a Mule/CloudHub DEBUG log and get a Postman-style workspace, a Postman v2.1 collection, or an OpenAPI 3.0 / RAML 1.0 spec - entirely client-side, nothing ever uploaded.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:url", content: SITE_URL },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Index,
});

// ─── Loading stage types ──────────────────────────────────────────────────────

type Stage = "idle" | "reading" | "parsing" | "building" | "error";

const STAGE_STEPS: Array<{ id: Stage; label: string }> = [
  { id: "reading",  label: "Reading file" },
  { id: "parsing",  label: "Parsing log entries" },
  { id: "building", label: "Building collection" },
];

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen({
  stage,
  fileName,
  fileSize,
  error,
  onReset,
}: {
  stage: Stage;
  fileName: string;
  fileSize: number;
  error: string | null;
  onReset: () => void;
}) {
  const activeIdx = STAGE_STEPS.findIndex((s) => s.id === stage);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {stage === "error" ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <AlertCircle className="h-6 w-6" />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Radar className="h-6 w-6 text-primary animate-pulse" />
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-center text-lg font-semibold tracking-tight text-foreground mb-1">
          {stage === "error" ? "Analysis failed" : "Analyzing log file"}
        </h2>

        {/* File info */}
        <p className="text-center text-xs text-muted-foreground mb-8 font-mono">
          {fileName}
          {fileSize > 0 && <span className="text-muted-foreground/60"> · {fmtBytes(fileSize)}</span>}
        </p>

        {stage === "error" ? (
          /* Error view */
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs text-destructive font-mono break-all">{error}</p>
            </div>
            <Button
              onClick={onReset}
              variant="outline"
              className="w-full border-border text-foreground"
            >
              Try again
            </Button>
          </div>
        ) : (
          /* Stage list */
          <ol className="space-y-3">
            {STAGE_STEPS.map((step, idx) => {
              const isDone    = idx < activeIdx;
              const isActive  = idx === activeIdx;
              const isPending = idx > activeIdx;

              return (
                <li key={step.id} className="flex items-center gap-3">
                  {/* Status icon */}
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors duration-300",
                      isDone   && "bg-status-success/15 text-status-success",
                      isActive && "bg-primary/15 text-primary",
                      isPending && "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {isDone   && <Check className="h-3.5 w-3.5" />}
                    {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isPending && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "text-sm transition-colors duration-300",
                      isDone   && "text-muted-foreground line-through decoration-muted-foreground/40",
                      isActive && "text-foreground font-medium",
                      isPending && "text-muted-foreground/60",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}

// ─── Hero flow diagram ─────────────────────────────────────────────────────────

function FlowDiagram() {
  return (
    <div className="relative">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Raw log terminal card */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 h-8 border-b border-border bg-surface-2/70">
            <span className="h-2.5 w-2.5 rounded-full bg-status-error/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-status-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-status-success/60" />
            <span className="ml-2 text-[10px] font-mono text-muted-foreground">mule.log</span>
          </div>
          <div className="p-3 font-mono text-[10.5px] leading-relaxed text-foreground/70 space-y-0.5">
            <p className="text-muted-foreground/70">DEBUG [wrk01] HTTP_Listener_config …</p>
            <p><span className="text-method-post">POST</span> /api/orders HTTP/1.1</p>
            <p className="text-muted-foreground/70">Host: x-acme-orders-api…</p>
            <p className="text-muted-foreground/70">event:b2c3d4e5 SelectorRunner - REQUESTER</p>
            <p className="text-foreground/60 truncate">{'{"customerId":"CUST-42","items":[…]}'}</p>
            <p className="text-muted-foreground/70">
              HTTP/1.1 <span className="text-status-success">201</span> Created
              <span className="animate-caret text-brand">▍</span>
            </p>
          </div>
        </div>

        {/* Connector */}
        <div className="flex md:flex-col items-center justify-center gap-2 py-1">
          <div className="hidden md:block h-px w-6 bg-gradient-to-r from-transparent to-border" />
          <div className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 shrink-0">
            <Terminal className="h-3 w-3 text-brand" />
            <span className="text-[10px] font-medium text-brand whitespace-nowrap">MuleScope</span>
          </div>
          <ArrowRight className="hidden md:block h-3.5 w-3.5 text-muted-foreground/60 rotate-90 md:rotate-0" />
          <ArrowRight className="md:hidden h-3.5 w-3.5 text-muted-foreground/60 rotate-90" />
        </div>

        {/* Extracted collection card */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-3 h-8 border-b border-border bg-surface-2/70">
            <span className="text-[10px] font-mono text-muted-foreground">collection.postman.json</span>
            <Download className="h-3 w-3 text-muted-foreground/70" />
          </div>
          <div className="p-2 space-y-1">
            {[
              { m: "POST" as const, name: "Create Order" },
              { m: "GET" as const, name: "Get Order Items" },
              { m: "DELETE" as const, name: "Delete Order" },
            ].map((row) => (
              <div
                key={row.name}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-background border border-border/70"
              >
                <MethodBadge method={row.m} className="w-10 shrink-0" />
                <span className="text-[11px] text-foreground/80 truncate">{row.name}</span>
                <Check className="h-3 w-3 text-status-success ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature cards ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Radar,
    title: "LISTENER & REQUESTER parsing",
    body: "Every inbound and outbound HTTP call is reconstructed from DEBUG trace lines - no regex-fu required.",
  },
  {
    icon: FileJson,
    title: "Postman v2.1 export",
    body: "Download a collection that imports cleanly into Postman, requests, responses, and folders intact.",
  },
  {
    icon: FileCode2,
    title: "OpenAPI 3.0 & RAML export",
    body: "Generate a real API spec from the log - paths, params, and JSON schemas merged across every call, ready for a frontend team or a gateway.",
  },
  {
    icon: Waypoints,
    title: "Flows timeline",
    body: "Calls that share a Mule correlation ID, laid out as a waterfall - the inbound call and every outbound call its flow made, in order.",
  },
  {
    icon: Network,
    title: "API sprawl detection",
    body: "Upload logs from more than one app and see which endpoints get called the exact same way more than once - duplicated integrations, surfaced automatically.",
  },
  {
    icon: AlertTriangle,
    title: "Errors-only export",
    body: "Download just the failed calls (status ≥ 400) as their own Postman collection, ready to hand off for debugging.",
  },
  {
    icon: Terminal,
    title: "Copy as cURL",
    body: "Every request can be copied as a ready-to-run curl command, headers and body included.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: Upload,
    title: "Upload or paste",
    body: "Drop in one Mule DEBUG log, or several - one per app - straight from CloudHub 1.0 or 2.0.",
  },
  {
    icon: Radar,
    title: "MuleScope parses it",
    body: "Every LISTENER and REQUESTER block is reconstructed, deduplicated, and grouped into folders - entirely in your browser.",
  },
  {
    icon: Download,
    title: "Inspect or export",
    body: "Browse the Postman-style workspace, or export a Postman collection, an OpenAPI/RAML spec, or a sprawl report.",
  },
];

function HowItWorks() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {HOW_IT_WORKS.map((step, i) => (
        <div key={step.title} className="relative rounded-lg border border-border bg-card p-4">
          <span className="absolute -top-2.5 -left-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-foreground text-[11px] font-semibold">
            {i + 1}
          </span>
          <step.icon className="h-5 w-5 text-foreground mb-3" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-foreground mb-1">{step.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
        </div>
      ))}
    </div>
  );
}

function FeatureCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
        >
          <f.icon className="h-5 w-5 text-foreground mb-3" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-foreground mb-1">{f.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function Index() {
  const navigate = useNavigate();
  const [paste, setPaste]     = useState("");
  const [source, setSource]   = useState<string | null>(null);
  const [stage, setStage]     = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [error, setError]     = useState<string | null>(null);

  // Shared tail once a parse has been kicked off - handles the
  // parsing/building stage transitions, storing the result, and navigating.
  // Used by both the single-string path (paste/sample log) and the
  // multi-source path (file upload) below.
  const finishParsing = async (parse: () => Promise<ParsedCollection>) => {
    try {
      setStage("parsing");
      const collection = await parse();

      setStage("building");
      setCollection(collection);

      // Brief pause so the user sees "Building collection" tick before navigation.
      await new Promise<void>((r) => setTimeout(r, 250));
      void navigate({ to: "/workspace" });
    } catch (err) {
      setStage("error");
      setError(String(err));
    }
  };

  const run = async (raw: string, name: string, size: number, skipRead: boolean) => {
    setFileName(name);
    setFileSize(size);
    setError(null);

    if (!skipRead) {
      // Stage shown during file.text() - the dropzone already called this,
      // so for files this stage is brief but visible.
      setStage("reading");
      await Promise.resolve(); // yield so React can paint "reading" state
    }

    await finishParsing(() => parseAsync(raw, name));
  };

  const handleFiles = async (files: File[]) => {
    const totalSize = files.reduce((n, f) => n + f.size, 0);
    const label = files.length === 1 ? files[0].name : `${files.length} log files combined`;
    setFileName(label);
    setFileSize(totalSize);
    setStage("reading");
    setError(null);

    // Each file is parsed as its own source and tagged with its filename, so
    // calls to the same endpoint from different files can be told apart
    // (cross-app API sprawl detection) while still deduping together exactly
    // like same-file duplicates always have.
    let sources: { name: string; raw: string }[];
    try {
      const texts = await Promise.all(files.map((f) => f.text()));
      sources = files.map((f, i) => ({ name: f.name, raw: texts[i] }));
    } catch (err) {
      setStage("error");
      setError(String(err));
      return;
    }

    await finishParsing(() => parseAsyncSources(sources));
  };

  const handleAnalyze = () => {
    const text = paste.trim() || SAMPLE_LOG;
    const name = source ?? "pasted.log";
    void run(text, name, text.length, true);
  };

  const handleQuickStart = () => {
    void run(SAMPLE_LOG, "sample.log", SAMPLE_LOG.length, true);
  };

  const reset = () => {
    setStage("idle");
    setError(null);
  };

  // ── Loading / error screen ──────────────────────────────────────────────────
  if (stage !== "idle") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <LoadingScreen
          stage={stage}
          fileName={fileName}
          fileSize={fileSize}
          error={error}
          onReset={reset}
        />
        <Footer />
      </div>
    );
  }

  // ── Import screen ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 w-full">
        {/* Hero */}
        <section className="relative pt-16 pb-14 px-6 border-b border-border/60 overflow-hidden">
          <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
          <div className="relative mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  CloudHub 2.0
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  CloudHub 1.0
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Postman v2.1
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  OpenAPI / RAML
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4 leading-[1.1]">
                Every API call your Mule app made,{" "}
                <span className="text-brand">extracted from the log.</span>
              </h1>
              <p className="text-base text-muted-foreground max-w-md mb-7">
                Drop in a Mule runtime log. MuleScope finds every LISTENER and
                REQUESTER call, rebuilds the request and response, and gives you
                a Postman-style workspace - plus a Postman v2.1 collection export
                and a generated OpenAPI 3.0 or RAML 1.0 spec.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  onClick={handleQuickStart}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Wand2 className="h-4 w-4" />
                  Try it with a sample log
                </Button>
                <a
                  href="#import"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                >
                  or bring your own
                </a>
              </div>
            </div>

            <FlowDiagram />
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-14 border-b border-border/60">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-sm font-medium text-muted-foreground mb-8">
              How it works
            </p>
            <HowItWorks />
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-14 border-b border-border/60">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-sm font-medium text-muted-foreground mb-8">
              Everything the workspace can do
            </p>
            <FeatureCards />
          </div>
        </section>

        {/* Live demo */}
        <section className="px-6 py-14 border-b border-border/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-8">
              <p className="text-sm font-medium text-muted-foreground mb-2">See it in action</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                This is the real workspace - <span className="text-brand">try it right here.</span>
              </h2>
            </div>
            <LiveDemo />
          </div>
        </section>

        {/* Import */}
        <section id="import" className="px-6 py-14 scroll-mt-12">
          <div className="mx-auto max-w-2xl">
            <p className="text-center text-sm font-medium text-muted-foreground mb-5">
              Analyze a log
            </p>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Tabs defaultValue="upload">
                <div className="border-b border-border px-2">
                  <TabsList className="h-11 bg-transparent p-0 gap-1 justify-start">
                    <TabsTrigger
                      value="upload"
                      className="h-9 rounded-md px-3 text-xs data-[state=active]:bg-accent data-[state=active]:shadow-none"
                    >
                      Upload file
                    </TabsTrigger>
                    <TabsTrigger
                      value="paste"
                      className="h-9 rounded-md px-3 text-xs data-[state=active]:bg-accent data-[state=active]:shadow-none"
                    >
                      Paste log
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="upload" className="p-5 mt-0">
                  <UploadDropzone onFiles={(files) => void handleFiles(files)} />
                  <p className="text-[11px] text-muted-foreground/70 mt-2">
                    Select or drop multiple files - one per app - to combine them into one collection and surface API sprawl: endpoints different apps call the same way. No fixed size limit, parsed locally in your browser.
                  </p>
                </TabsContent>

                <TabsContent value="paste" className="p-5 mt-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Raw log content</p>
                    <button
                      onClick={() => {
                        setPaste(SAMPLE_LOG);
                        setSource("sample.log");
                      }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Wand2 className="h-3 w-3" />
                      Load sample
                    </button>
                  </div>
                  <Textarea
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder="Paste raw Mule log output here…"
                    className="min-h-[200px] font-mono text-xs bg-background resize-none border-border/60"
                  />
                  {source && (
                    <p className="text-[11px] text-muted-foreground mt-2 truncate">
                      {source}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-4">
                    <Button
                      onClick={handleAnalyze}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <FileSearch className="h-3.5 w-3.5" />
                      Analyze logs
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      No data leaves your browser
                    </span>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  return (
    <header className="border-b border-border shrink-0 sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-brand text-brand-foreground">
            <Radar className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">MuleScope</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFeaturesOpen(true)}
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            Features
          </button>
          <FeaturesDialog open={featuresOpen} onOpenChange={setFeaturesOpen} />
          <a
            href="https://learning.postman.com/collection-format/getting-started/overview/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            Postman v2.1 spec
          </a>
          <a
            href="https://github.com/talhakhalidmtk/mulescope"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            title="View source on GitHub"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Source</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border shrink-0">
      <div className="mx-auto max-w-5xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-brand text-brand-foreground">
            <Radar className="h-3 w-3" />
          </div>
          <span className="text-xs text-muted-foreground">
            MuleScope - parses and exports entirely in your browser, nothing is uploaded
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <a
            href="https://github.com/talhakhalidmtk/mulescope"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
          <span className="h-3 w-px bg-border" />
          <a
            href="https://learning.postman.com/collection-format/getting-started/overview/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Postman v2.1 spec
          </a>
          <span className="h-3 w-px bg-border" />
          <p>
            Built by{" "}
            <a
              href="https://talhakhalidmtk.me"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand hover:text-brand/80 underline underline-offset-2 transition-colors"
            >
              Talha Khalid
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
