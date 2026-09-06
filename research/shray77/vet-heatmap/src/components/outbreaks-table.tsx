"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { speciesRu } from "@/lib/i18n-species";

interface OutbreaksTableProps {
  outbreaks: Outbreak[];
  onSelectOutbreak?: (o: Outbreak) => void;
}

type SortKey = "date" | "disease" | "region" | "cases" | "deaths";
type SortDir = "asc" | "desc";

function SortHeader({
  k,
  label,
  sortBy,
  sortDir,
  onToggle,
}: {
  k: SortKey;
  label: string;
  sortBy: SortKey;
  sortDir: SortDir;
  onToggle: (k: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onToggle(k)}
      className="inline-flex items-center gap-1 hover:text-foreground text-xs font-medium"
    >
      {label}
      {sortBy === k ? (
        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : null}
    </button>
  );
}

export function OutbreaksTable({ outbreaks, onSelectOutbreak }: OutbreaksTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    let rows = outbreaks;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((o) =>
        `${o.disease} ${o.region} ${o.species}`.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      rows = rows.filter((o) => o.status === statusFilter);
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "disease": cmp = a.disease.localeCompare(b.disease); break;
        case "region": cmp = a.region.localeCompare(b.region); break;
        case "cases": cmp = a.cases - b.cases; break;
        case "deaths": cmp = a.deaths - b.deaths; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [outbreaks, sortBy, sortDir, search, statusFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const exportCsv = () => {
    const headers = ["id", "date", "disease", "region", "municipality", "species", "cases", "deaths", "status", "source", "federal_district"];
    const rows = filtered.map((o) => [
      o.id,
      o.date,
      `"${o.disease}"`,
      `"${o.region}"`,
      `"${o.municipality ?? ""}"`,
      `"${o.species}"`,
      o.cases,
      o.deaths,
      o.status,
      o.source,
      `"${o.federal_district ?? ""}"`,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outbreaks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-3 md:p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold">
          Вспышки ({filtered.length})
          {filtered.length !== outbreaks.length && (
            <span className="text-xs text-muted-foreground ml-1">
              из {outbreaks.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="h-7 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="h-7 text-xs"
          >
            {expanded ? "Свернуть" : "Развернуть"}
          </Button>
        </div>
      </div>

      {/* Search + status filter */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по болезни, региону, виду…"
            className="h-8 text-xs pl-7"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="Ongoing">Активные</SelectItem>
            <SelectItem value="Resolved">Завершённые</SelectItem>
            <SelectItem value="Unknown">Неизвестно</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`overflow-auto thin-scroll ${expanded ? "max-h-[600px]" : "max-h-[300px]"}`}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-2"><SortHeader k="date" label="Дата" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="py-2"><SortHeader k="disease" label="Болезнь" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="py-2"><SortHeader k="region" label="Регион" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="py-2 hidden sm:table-cell">Вид</TableHead>
              <TableHead className="py-2 text-right"><SortHeader k="cases" label="Случаи" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="py-2 text-right"><SortHeader k="deaths" label="Пало" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead className="py-2">Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Нет данных для выбранного фильтра
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => {
                const labels = DISEASE_LABELS[o.disease_key as DiseaseKey];
                const color = diseaseColor(o.disease_key, o.disease_group);
                return (
                  <TableRow
                    key={o.id}
                    onClick={() => onSelectOutbreak?.(o)}
                    className="cursor-pointer hover:bg-accent/30 relative"
                    style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
                  >
                    <TableCell className="py-2 text-[13px] whitespace-nowrap tabular-nums">
                      {new Date(o.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </TableCell>
                    <TableCell className="py-2 text-[13px]">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {labels?.short_ru ?? o.disease}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-[13px]">
                      <div>{o.region === "Russia" || o.region === "Russian Federation" ? "Россия (без региона)" : o.region}</div>
                      {o.municipality && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{o.municipality}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[13px] hidden sm:table-cell text-muted-foreground">
                      {speciesRu(o.species)}
                    </TableCell>
                    <TableCell className="py-2 text-[13px] text-right font-mono tabular-nums">
                      {o.cases.toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell className="py-2 text-[13px] text-right font-mono tabular-nums text-destructive">
                      {o.deaths > 0 ? o.deaths.toLocaleString("ru-RU") : "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      {o.status === "Ongoing" ? (
                        <Badge variant="destructive" className="text-[10px] py-0 h-5 gap-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          Активна
                        </Badge>
                      ) : o.status === "Resolved" ? (
                        <Badge variant="secondary" className="text-[10px] py-0 h-5">Заверш.</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0 h-5">?</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
