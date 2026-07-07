import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet } from "../services/api";
import { useAuth } from "./AuthContext";

export interface CompanyProfileSummary {
  id: number;
  companyName: string;
  slug: string;
  websiteUrl?: string;
  source?: string;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
}

type CompanyProfilesContextValue = {
  profiles: CompanyProfileSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const CompanyProfilesContext = createContext<CompanyProfilesContextValue | null>(null);

export function CompanyProfilesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<CompanyProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Add small delay to ensure token is available
      await new Promise(resolve => setTimeout(resolve, 100));
      const data = await apiGet<CompanyProfileSummary[]>("company-profiles");
      setProfiles(data);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CompanyProfilesContext.Provider value={{ profiles, loading, refresh }}>
      {children}
    </CompanyProfilesContext.Provider>
  );
}

export function useCompanyProfiles() {
  const ctx = useContext(CompanyProfilesContext);
  if (!ctx) throw new Error("useCompanyProfiles must be used within CompanyProfilesProvider");
  return ctx;
}
