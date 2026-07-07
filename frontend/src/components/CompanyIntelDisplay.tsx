import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Flame,
  Lightbulb,
  Target,
  MessageSquare,
  Hash,
  Calendar,
  Copy,
  PenSquare,
} from "lucide-react";
import { Badge } from "./ui";

export interface HotTopic {
  topic: string;
  why: string;
  urgency: "high" | "medium" | "low";
  suggestedAngle: string;
}

export interface PostIdea {
  title: string;
  format: string;
  hook: string;
  pillar: string;
}

export interface CompanyIntelData {
  companyName: string;
  tagline?: string;
  summary?: string;
  industry?: string;
  targetAudience?: string[];
  brandVoice?: string;
  contentPillars?: string[];
  hotTopics?: HotTopic[];
  postIdeas?: PostIdea[];
  keyMessages?: string[];
  suggestedHashtags?: string[];
  competitorInsights?: string;
  contentCalendarHints?: string[];
  source?: string;
  model?: string;
  sourcesAnalyzed?: { label: string; chars?: number }[];
}

function urgencyBadge(urgency: string) {
  switch (urgency) {
    case "high":
      return <Badge variant="danger">High urgency</Badge>;
    case "low":
      return <Badge>Low urgency</Badge>;
    default:
      return <Badge variant="warning">Medium urgency</Badge>;
  }
}

export function CompanyIntelDisplay({
  intel,
  companyProfileId,
  fallbackName,
}: {
  intel: CompanyIntelData;
  companyProfileId?: number;
  fallbackName?: string;
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function useTopicForPost(topic: string, extraPrompt?: string) {
    navigate("/posts", {
      state: {
        topic,
        aiPrompt: extraPrompt || "",
        mode: "ai" as const,
        companyProfileId,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              {intel.companyName || fallbackName || "Company brief"}
            </h2>
            {intel.tagline && <p className="mt-1 text-sm text-blue-300">{intel.tagline}</p>}
            {intel.industry && (
              <p className="mt-2 text-xs text-slate-500">Industry: {intel.industry}</p>
            )}
          </div>
          {intel.source && (
            <Badge variant="success">
              AI · {intel.source}
              {intel.model ? ` · ${intel.model}` : ""}
            </Badge>
          )}
        </div>
        {intel.summary && (
          <p className="mt-4 text-sm leading-relaxed text-slate-300">{intel.summary}</p>
        )}
        {intel.sourcesAnalyzed?.length ? (
          <p className="mt-3 text-xs text-slate-500">
            Sources: {intel.sourcesAnalyzed.map((s) => s.label).join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <IntelCard title="Hot topics" icon={Flame} iconClass="text-orange-400">
          <div className="space-y-3">
            {(intel.hotTopics || []).map((t, i) => (
              <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{t.topic}</p>
                  {urgencyBadge(t.urgency)}
                </div>
                {t.why && <p className="mt-1.5 text-xs text-slate-400">{t.why}</p>}
                {t.suggestedAngle && (
                  <p className="mt-2 text-xs text-blue-300/90">Angle: {t.suggestedAngle}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => useTopicForPost(t.topic, t.suggestedAngle)}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600/20 px-2 py-1 text-xs text-blue-300 hover:bg-blue-600/30"
                  >
                    <PenSquare className="h-3 w-3" />
                    Create post
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(t.topic, `topic-${i}`)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === `topic-${i}` ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </IntelCard>

        <IntelCard title="Post ideas" icon={Lightbulb} iconClass="text-amber-400">
          <div className="space-y-3">
            {(intel.postIdeas || []).map((p, i) => (
              <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{p.title}</p>
                  {p.format && <Badge>{p.format}</Badge>}
                </div>
                {p.hook && (
                  <p className="mt-1.5 text-xs italic text-slate-400">&ldquo;{p.hook}&rdquo;</p>
                )}
                {p.pillar && (
                  <p className="mt-1 text-[11px] text-slate-500">Pillar: {p.pillar}</p>
                )}
                <button
                  type="button"
                  onClick={() => useTopicForPost(p.title, p.hook)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-600/20 px-2 py-1 text-xs text-blue-300 hover:bg-blue-600/30"
                >
                  <PenSquare className="h-3 w-3" />
                  Create post
                </button>
              </div>
            ))}
          </div>
        </IntelCard>

        <IntelCard title="Target audience" icon={Target} iconClass="text-emerald-400">
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
            {(intel.targetAudience || []).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </IntelCard>

        <IntelCard title="Content pillars" icon={MessageSquare} iconClass="text-violet-400">
          <div className="flex flex-wrap gap-2">
            {(intel.contentPillars || []).map((p, i) => (
              <span
                key={i}
                className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
              >
                {p}
              </span>
            ))}
          </div>
          {intel.brandVoice && (
            <p className="mt-4 text-sm text-slate-400">
              <span className="font-medium text-slate-300">Brand voice: </span>
              {intel.brandVoice}
            </p>
          )}
        </IntelCard>

        <IntelCard title="Key messages" icon={MessageSquare} iconClass="text-sky-400">
          <ul className="space-y-2 text-sm text-slate-300">
            {(intel.keyMessages || []).map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-500">•</span>
                {m}
              </li>
            ))}
          </ul>
        </IntelCard>

        <IntelCard title="Hashtags & calendar" icon={Hash} iconClass="text-pink-400">
          {(intel.suggestedHashtags || []).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {(intel.suggestedHashtags || []).map((h, i) => (
                <span key={i} className="text-xs text-blue-300">
                  {h.startsWith("#") ? h : `#${h}`}
                </span>
              ))}
            </div>
          )}
          {(intel.contentCalendarHints || []).length > 0 && (
            <>
              <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-500">
                <Calendar className="h-3 w-3" />
                Calendar hints
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
                {(intel.contentCalendarHints || []).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </>
          )}
        </IntelCard>
      </div>

      {intel.competitorInsights && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white">Competitive positioning</h3>
          <p className="mt-2 text-sm text-slate-400">{intel.competitorInsights}</p>
        </div>
      )}
    </div>
  );
}

function IntelCard({
  title,
  icon: Icon,
  iconClass,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}
