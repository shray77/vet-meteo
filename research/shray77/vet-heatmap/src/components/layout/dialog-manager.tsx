"use client";

import dynamic from "next/dynamic";
import { useUIStore } from "@/lib/ui-store";
import type { Outbreak } from "@/types/domain";

const DiseaseProfileDrawer = dynamic(() => import("@/components/disease-profile-drawer").then(m => ({ default: m.DiseaseProfileDrawer })), { ssr: false });
const QuarantineCalculator = dynamic(() => import("@/components/quarantine-calculator").then(m => ({ default: m.QuarantineCalculator })), { ssr: false });
const NearbyOutbreaks = dynamic(() => import("@/components/nearby-outbreaks").then(m => ({ default: m.NearbyOutbreaks })), { ssr: false });
const SIRSimulator = dynamic(() => import("@/components/sir-simulator").then(m => ({ default: m.SIRSimulator })), { ssr: false });
const OutbreakSourceTracker = dynamic(() => import("@/components/outbreak-source-tracker").then(m => ({ default: m.OutbreakSourceTracker })), { ssr: false });
const TransportGraphAnalysis = dynamic(() => import("@/components/transport-graph-analysis").then(m => ({ default: m.TransportGraphAnalysis })), { ssr: false });
const PdfReportExport = dynamic(() => import("@/components/pdf-report-export").then(m => ({ default: m.PdfReportExport })), { ssr: false });
const CustomDataImport = dynamic(() => import("@/components/custom-data-import").then(m => ({ default: m.CustomDataImport })), { ssr: false });
const EnterpriseRiskMonitor = dynamic(() => import("@/components/enterprise-risk-monitor").then(m => ({ default: m.EnterpriseRiskMonitor })), { ssr: false });
const SpatialSimulator = dynamic(() => import("@/components/spatial-simulator").then(m => ({ default: m.SpatialSimulator })), { ssr: false });
const RegionDrillDown = dynamic(() => import("@/components/region-drill-down").then(m => ({ default: m.RegionDrillDown })), { ssr: false });
const AboutDialog = dynamic(() => import("@/components/about-dialog").then(m => ({ default: m.AboutDialog })), { ssr: false });
const SpreadAnimation = dynamic(() => import("@/components/spread-animation").then(m => ({ default: m.SpreadAnimation })), { ssr: false });
const RegionReportCard = dynamic(() => import("@/components/region-report-card").then(m => ({ default: m.RegionReportCard })), { ssr: false });
const AlertSettings = dynamic(() => import("@/components/alert-settings").then(m => ({ default: m.AlertSettings })), { ssr: false });
const DiseaseComparison = dynamic(() => import("@/components/disease-comparison").then(m => ({ default: m.DiseaseComparison })), { ssr: false });
const OutbreakDetailPanel = dynamic(() => import("@/components/outbreak-detail-panel").then(m => ({ default: m.OutbreakDetailPanel })), { ssr: false });
const RegionComparison = dynamic(() => import("@/components/region-comparison").then(m => ({ default: m.RegionComparison })), { ssr: false });

export function DialogManager({
  outbreaks,
  filtered,
  geo,
  enterprises,
  regionCentroids,
}: {
  outbreaks: Outbreak[];
  filtered: Outbreak[];
  geo: any;
  enterprises: any[];
  regionCentroids: Map<string, [number, number]>;
}) {
  const {
    drawerOpen, setDrawerOpen,
    drawerDisease, setDrawerDisease,
    calcOpen, setCalcOpen,
    calcPreselect,
    nearbyOpen, setNearbyOpen,
    sirOpen, setSirOpen,
    sourceTrackerOpen, setSourceTrackerOpen,
    transportOpen, setTransportOpen,
    pdfReportOpen, setPdfReportOpen,
    customImportOpen, setCustomImportOpen,
    enterpriseRiskOpen, setEnterpriseRiskOpen,
    spreadAnimOpen, setSpreadAnimOpen,
    regionCardOpen, setRegionCardOpen,
    alertOpen, setAlertOpen,
    spatialOpen, setSpatialOpen,
    regionDrillDown, setRegionDrillDownOpen,
    regionDrillDownOpen,
    selectedOutbreak, setSelectedOutbreak,
    outbreakDetailOpen, setOutbreakDetailOpen,
    comparisonOpen, setComparisonOpen,
    aboutOpen, setAboutOpen,
  } = useUIStore();

  return (
    <>
      <DiseaseProfileDrawer
        disease={drawerDisease}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      <QuarantineCalculator
        open={calcOpen}
        onOpenChange={setCalcOpen}
        preselectDisease={calcPreselect}
      />
      <NearbyOutbreaks
        open={nearbyOpen}
        onOpenChange={setNearbyOpen}
        outbreaks={outbreaks}
        regionCentroids={regionCentroids}
        onFocusOutbreak={(o) => {
          setDrawerDisease(o.disease_key);
          setDrawerOpen(true);
        }}
      />
      <SIRSimulator open={sirOpen} onOpenChange={setSirOpen} />
      <OutbreakSourceTracker open={sourceTrackerOpen} onOpenChange={setSourceTrackerOpen} outbreaks={filtered} />
      <TransportGraphAnalysis open={transportOpen} onOpenChange={setTransportOpen} outbreaks={filtered} />
      <PdfReportExport open={pdfReportOpen} onOpenChange={setPdfReportOpen} outbreaks={outbreaks} />
      <CustomDataImport open={customImportOpen} onOpenChange={setCustomImportOpen} outbreaks={outbreaks} />
      <EnterpriseRiskMonitor open={enterpriseRiskOpen} onOpenChange={setEnterpriseRiskOpen} outbreaks={outbreaks} enterprises={enterprises} />
      <SpreadAnimation open={spreadAnimOpen} onOpenChange={setSpreadAnimOpen} outbreaks={outbreaks} />
      <RegionReportCard open={regionCardOpen} onOpenChange={setRegionCardOpen} outbreaks={outbreaks} />
      <AlertSettings open={alertOpen} onOpenChange={setAlertOpen} outbreaks={outbreaks} />
      <RegionDrillDown
        region={regionDrillDown}
        outbreaks={outbreaks}
        open={regionDrillDownOpen}
        onOpenChange={setRegionDrillDownOpen}
        onSelectOutbreak={(o) => {
          setSelectedOutbreak(o);
          setOutbreakDetailOpen(true);
        }}
        geo={geo}
        enterprises={enterprises}
      />
      <OutbreakDetailPanel
        outbreak={selectedOutbreak}
        open={outbreakDetailOpen}
        onOpenChange={setOutbreakDetailOpen}
        outbreaks={outbreaks}
        enterprises={enterprises}
        onSelectDisease={(k) => { setDrawerDisease(k); setDrawerOpen(true); }}
        onSimulate={() => { setSirOpen(true); }}
      />
      <SpatialSimulator
        open={spatialOpen}
        onOpenChange={setSpatialOpen}
        outbreaks={outbreaks}
        regionCentroids={regionCentroids}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <RegionComparison open={comparisonOpen} onOpenChange={setComparisonOpen} outbreaks={outbreaks} />
    </>
  );
}
