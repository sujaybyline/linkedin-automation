import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Building2, PenSquare } from "lucide-react";
import { PageHeader } from "../components/ui";
import { CompanyIntelDisplay, type CompanyIntelData } from "../components/CompanyIntelDisplay";
import { apiGet } from "../services/api";

interface CompanyProfile {
  id: number;
  companyName: string;
  websiteUrl?: string;
  intel: CompanyIntelData;
  sourcesAnalyzed?: { label: string }[];
  source?: string;
  model?: string;
}

export function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiGet<CompanyProfile>(`company-profiles/${id}`)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"));
  }, [id]);

  if (error) {
    return (
      <div className="text-red-400">
        {error} — <Link to="/fetch-info" className="text-blue-400 underline">Fetch a company</Link>
      </div>
    );
  }

  if (!profile) {
    return <p className="text-slate-400">Loading company profile…</p>;
  }

  const intel: CompanyIntelData = {
    ...profile.intel,
    companyName: profile.companyName || profile.intel?.companyName,
    source: profile.source || profile.intel?.source,
    model: profile.model || profile.intel?.model,
    sourcesAnalyzed: profile.sourcesAnalyzed || profile.intel?.sourcesAnalyzed,
  };

  return (
    <>
      <PageHeader
        title={profile.companyName}
        description={
          profile.websiteUrl
            ? `Saved company intel · ${profile.websiteUrl}`
            : "Saved company marketing intelligence"
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          to="/posts"
          state={{ companyProfileId: profile.id, mode: "ai" }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <PenSquare className="h-4 w-4" />
          Create posts with this context
        </Link>
        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">
          <Building2 className="h-3.5 w-3.5" />
          Profile saved from Fetch info
        </span>
      </div>

      <CompanyIntelDisplay intel={intel} companyProfileId={profile.id} />
    </>
  );
}
