import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

function Bar({ width, height, mt, mb, radius }) {
  return (
    <div
      className="skel-block"
      style={{
        width: width || "100%",
        height: height || 14,
        marginTop: mt || 0,
        marginBottom: mb || 0,
        borderRadius: radius != null ? radius : 6,
      }}
    />
  );
}

function SkeletonCard({ children, style }) {
  return (
    <div className="skel-card" style={style}>
      {children}
    </div>
  );
}

function StatTile() {
  return (
    <div className="skel-stat">
      <div className="skel-stat-bar">
        <div className="skel-block skel-avatar" />
        <div className="skel-stat-content">
          <div className="skel-block skel-text-sm" />
          <div className="skel-block skel-stat-num" />
        </div>
      </div>
    </div>
  );
}

function TableRow() {
  return (
    <div className="skel-table-row">
      <div>
        <Bar width="70%" height={14} />
        <Bar width="50%" height={10} mt={6} />
      </div>
      <div className="skel-block skel-pill" />
      <div className="skel-block skel-pill" />
      <div className="skel-block skel-num" />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <div className="skel-block skel-btn-icon" />
        <div className="skel-block skel-btn-icon" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="skel-wrap">
      <SkeletonCard style={{ marginBottom: 16 }}>
        <div className="skel-section-head">
          <Bar width={160} height={20} />
          <Bar width={80} height={28} radius={8} />
        </div>
        <Bar height={6} mb={16} />
        {[0, 1, 2, 3].map((i) => (
          <div className="skel-row" key={i}>
            <div className="skel-block skel-avatar" style={{ width: 20, height: 20, borderRadius: 10 }} />
            <div style={{ flex: 1 }}>
              <Bar width="40%" height={14} />
              <Bar width="70%" height={12} mt={6} />
            </div>
          </div>
        ))}
      </SkeletonCard>

      <div className="skel-grid skel-grid-4">
        {[0, 1, 2, 3].map((i) => (
          <StatTile key={i} />
        ))}
      </div>

      <div className="skel-layout">
        <div>
          <SkeletonCard>
            <Bar width={160} height={20} mb={16} />
            <div className="skel-table">
              {[0, 1, 2, 3].map((i) => (
                <TableRow key={i} />
              ))}
            </div>
          </SkeletonCard>
        </div>
        <div className="skel-sidebar">
          <SkeletonCard>
            <Bar width={180} height={18} mb={16} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <Bar width="100%" height={12} />
                <Bar width="100%" height={6} mt={6} />
              </div>
            ))}
          </SkeletonCard>
          <SkeletonCard>
            <Bar width={120} height={18} mb={16} />
            <div className="skel-grid skel-grid-2">
              {[0, 1, 2, 3].map((i) => (
                <Bar key={i} height={36} radius={8} />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}

export function ConnectionsSkeleton() {
  return (
    <div className="skel-wrap">
      <div className="skel-section">
        <Bar width={180} height={22} mb={12} />
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <div className="skel-row">
              <div className="skel-block skel-avatar" />
              <div style={{ flex: 1 }}>
                <Bar width="40%" height={16} />
                <Bar width="80%" height={12} mt={6} />
              </div>
              <Bar width={100} height={32} radius={8} />
            </div>
          </SkeletonCard>
        ))}
      </div>

      <div className="skel-section">
        <Bar width={200} height={22} mb={12} />
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <div className="skel-row">
              <div className="skel-block skel-avatar" />
              <div style={{ flex: 1 }}>
                <Bar width="35%" height={16} />
                <Bar width="70%" height={12} mt={6} />
              </div>
              <Bar width={100} height={32} radius={8} />
            </div>
          </SkeletonCard>
        ))}
      </div>

      <div className="skel-section">
        <Bar width={140} height={22} mb={12} />
        <div className="skel-coming-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="skel-coming-card" key={i}>
              <div className="skel-block skel-avatar" />
              <div style={{ flex: 1 }}>
                <Bar width="60%" height={14} />
                <Bar width="40%" height={12} mt={6} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PreviewSkeleton() {
  return (
    <div className="skel-wrap">
      <div className="skel-badges">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel-block skel-badge" />
        ))}
      </div>

      <div className="skel-layout">
        <div className="skel-sidebar">
          <SkeletonCard>
            <Bar width={120} height={18} mb={16} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skel-form-field">
                <Bar width="50%" height={14} mb={6} />
                <Bar width="100%" height={14} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Bar width={100} height={32} radius={8} />
              <Bar width={60} height={32} radius={8} />
            </div>
          </SkeletonCard>
          <SkeletonCard>
            <Bar width={140} height={18} mb={16} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skel-form-field">
                <Bar width="60%" height={14} />
              </div>
            ))}
          </SkeletonCard>
        </div>
        <div>
          <SkeletonCard>
            <Bar width={200} height={20} mb={16} />
            <div className="skel-table">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skel-table-row">
                  <Bar width="70%" height={12} />
                  <Bar width="60%" height={12} />
                  <Bar width="40%" height={12} />
                  <Bar width="50%" height={12} />
                  <Bar width="30%" height={12} />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}

export function ExportsSkeleton() {
  return (
    <div className="skel-wrap">
      <div className="skel-grid">
        {[0, 1, 2].map((i) => (
          <StatTile key={i} />
        ))}
      </div>

      <div className="skel-layout">
        <div className="skel-sidebar">
          <SkeletonCard>
            <Bar width={140} height={20} mb={6} />
            <Bar width="80%" height={12} mb={16} />
            <Bar width="60%" height={12} mb={10} />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #e3e3e3",
                  borderRadius: 8,
                  marginBottom: 8,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Bar width={16} height={16} radius={4} />
                <Bar width="50%" height={12} />
              </div>
            ))}
            <Bar width="100%" height={1} mt={12} mb={12} />
            <Bar width="50%" height={12} mb={8} />
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} width="80%" height={14} mb={8} />
            ))}
            <Bar className="skel-button-full" height={40} radius={8} mt={16} />
          </SkeletonCard>
        </div>
        <div>
          <SkeletonCard>
            <Bar width={160} height={20} mb={6} />
            <Bar width="40%" height={12} mb={16} />
            <div className="skel-table">
              {[0, 1, 2, 3].map((i) => (
                <TableRow key={i} />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="skel-wrap">
      <div className="skel-section">
        <Bar width={140} height={20} mb={6} />
        <Bar width="40%" height={12} mb={16} />
        <SkeletonCard>
          <div className="skel-row" style={{ marginBottom: 0 }}>
            <div className="skel-block skel-avatar" />
            <div style={{ flex: 1 }}>
              <Bar width="30%" height={16} />
              <Bar width="60%" height={12} mt={6} />
            </div>
            <Bar width={100} height={32} radius={8} />
          </div>
        </SkeletonCard>
      </div>

      <div className="skel-section">
        <Bar width={180} height={20} mb={6} />
        <Bar width="50%" height={12} mb={16} />
        <div className="skel-layout">
          <div className="skel-sidebar">
            <SkeletonCard>
              <Bar width={140} height={18} mb={4} />
              <Bar width="60%" height={12} mb={16} />
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skel-form-field">
                  <Bar width="40%" height={12} mb={6} />
                  <Bar height={36} radius={6} />
                </div>
              ))}
              <Bar height={40} radius={8} mt={8} />
            </SkeletonCard>
          </div>
          <div>
            <SkeletonCard>
              <Bar width={160} height={18} mb={6} />
              <Bar width="40%" height={12} mb={16} />
              <div className="skel-table">
                {[0, 1, 2].map((i) => (
                  <TableRow key={i} />
                ))}
              </div>
            </SkeletonCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NavigationProgress() {
  const navigation = useNavigation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (navigation.state !== "idle") {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [navigation.state]);

  if (!visible) return null;
  return <div className="nav-progress" aria-hidden="true" />;
}

export function getSkeletonForPath(pathname) {
  if (!pathname) return null;
  if (pathname === "/app" || pathname === "/app/") return <DashboardSkeleton />;
  if (pathname.startsWith("/app/connections")) return <ConnectionsSkeleton />;
  if (pathname.startsWith("/app/preview")) return <PreviewSkeleton />;
  if (pathname.startsWith("/app/exports")) return <ExportsSkeleton />;
  if (pathname.startsWith("/app/settings")) return <SettingsSkeleton />;
  return null;
}
