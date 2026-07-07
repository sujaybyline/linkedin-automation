import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Badge, EmergencyBanner, PageHeader, StatCard } from "../components/ui";
import { apiGet } from "../services/api";
import { useAuth } from "../context/AuthContext";

interface DashboardStats {
  scheduled: number;
  due: number;
  published: number;
  failed: number;
  pendingReview: number;
  emergencyStop: boolean;
  linkedinConnected: boolean;
  dryRunMode: boolean;
  autoPublish: boolean;
}

interface PostRow {
  post_id: string;
  topic: string;
  filename: string;
  approval_status: string;
  quality_status: string;
  scheduling_status: string;
  card_status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  auto_post_status: string;
  created_at: string;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function formatTime(value: string | null) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function approvalBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge variant="success">{status}</Badge>;
    case "rejected":
      return <Badge variant="danger">{status}</Badge>;
    case "pending_review":
      return <Badge variant="warning">{status}</Badge>;
    case "legal_review":
      return <Badge variant="warning">legal review</Badge>;
    case "revision_needed":
      return <Badge variant="warning">revision</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

export function HomePage() {
  const { user } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Add a small delay to ensure token is properly available in all contexts
    const fetchData = async () => {
      // Wait for token and other contexts to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        const [statsData, postsData] = await Promise.all([
          apiGet<DashboardStats>("dashboard/stats").catch(() => null),
          apiGet<PostRow[]>("dashboard/posts").catch(() => [])
        ]);
        
        setStats(statsData);
        setPosts(postsData || []);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, location.state]); // Re-fetch when user changes or navigation state changes

  return (
    <>
      <EmergencyBanner active={stats?.emergencyStop ?? false} />
      <PageHeader
        title="Operations Dashboard"
        description="Overview of all posts and their current status."
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Scheduled" value={stats?.scheduled ?? "—"} />
        <StatCard label="Due now" value={stats?.due ?? "—"} tone="warning" />
        <StatCard label="Published" value={stats?.published ?? "—"} tone="success" />
        <StatCard label="Failed" value={stats?.failed ?? "—"} tone="danger" />
        <StatCard label="Pending review" value={stats?.pendingReview ?? "—"} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Badge variant={stats?.emergencyStop ? "danger" : "success"}>
          Emergency: {stats?.emergencyStop ? "STOP" : "Off"}
        </Badge>
        <Badge variant={stats?.linkedinConnected ? "success" : "warning"}>
          LinkedIn: {stats?.linkedinConnected ? "Connected" : "Not connected"}
        </Badge>
        <Badge variant={stats?.dryRunMode ? "warning" : "danger"}>
          Mode: {stats?.dryRunMode ? "Dry run" : "Live"}
        </Badge>
        <Badge variant={stats?.autoPublish ? "danger" : "default"}>
          Auto publish: {stats?.autoPublish ? "ON" : "OFF"}
        </Badge>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white">All posts</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">Post ID</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Scheduled for</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.post_id} className="border-b border-slate-800/50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{p.post_id}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-200">{p.topic || p.filename || "—"}</td>
                  <td className="px-4 py-3">{approvalBadge(p.approval_status)}</td>
                  <td className="px-4 py-3">
                    <Badge>{p.quality_status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{p.auto_post_status || p.scheduling_status || "unscheduled"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatDate(p.scheduled_date)}
                    {p.scheduled_time ? ` ${formatTime(p.scheduled_time)}` : ""}
                  </td>
                </tr>
              ))}
              {!posts.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No posts yet. Upload a card to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
