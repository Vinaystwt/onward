import { Route, Routes } from "react-router-dom";
import { Suspense } from "react";
import { Shell } from "@/components/Shell";
import { Landing } from "@/pages/Landing";
import { PageFallback } from "@/components/PageFallback";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const ArmRule = lazyWithRetry(() => import("@/pages/ArmRule").then((m) => ({ default: m.ArmRule })));
const Receipts = lazyWithRetry(() => import("@/pages/Receipts").then((m) => ({ default: m.Receipts })));
const ReceiptDetail = lazyWithRetry(() => import("@/pages/ReceiptDetail").then((m) => ({ default: m.ReceiptDetail })));
const TrackRecordPage = lazyWithRetry(() => import("@/pages/TrackRecord").then((m) => ({ default: m.TrackRecordPage })));
const Connectors = lazyWithRetry(() => import("@/pages/Connectors").then((m) => ({ default: m.Connectors })));
const Docs = lazyWithRetry(() => import("@/pages/Docs").then((m) => ({ default: m.Docs })));

function R({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary label="root">
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<R label="Landing"><Landing /></R>} />
          <Route path="/app" element={<R label="Dashboard"><Dashboard /></R>} />
          <Route path="/arm" element={<R label="Arm a rule"><ArmRule /></R>} />
          <Route path="/receipts" element={<R label="Receipts"><Receipts /></R>} />
          <Route path="/receipts/:id" element={<R label="Receipt detail"><ReceiptDetail /></R>} />
          <Route path="/track" element={<R label="Track record"><TrackRecordPage /></R>} />
          <Route path="/connectors" element={<R label="Connectors"><Connectors /></R>} />
          <Route path="/docs" element={<R label="Docs"><Docs /></R>} />
          <Route path="/docs/:section" element={<R label="Docs"><Docs /></R>} />
          <Route path="*" element={<R label="Landing"><Landing /></R>} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
