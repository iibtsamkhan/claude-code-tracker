import { useEffect, useMemo, useState } from "react";
import { parseHistoryFile } from "@/lib/parsers";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { CostChart } from "@/components/dashboard/CostChart";
import { ProviderBreakdown } from "@/components/dashboard/ProviderBreakdown";
import { TopConversations } from "@/components/dashboard/TopConversations";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { Recommendations } from "@/components/dashboard/Recommendations";
import { FileUploadZone } from "@/components/dashboard/FileUploadZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileUp, Filter, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

type DashboardFilters = {
  projectId?: number;
  provider?: "claude" | "openai" | "gemini";
  model?: string;
  search?: string;
  minCost?: number;
  maxCost?: number;
  dateFrom?: string;
  dateTo?: string;
};

type UsageSortBy = "timestamp" | "costUsd" | "totalTokens";
type UsageSortDir = "asc" | "desc";

const PAGE_SIZE = 12;

const parseUrlFilters = (): DashboardFilters => {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId");
  const parsedProjectId = projectId ? Number(projectId) : undefined;
  const provider = params.get("provider");

  return {
    projectId: Number.isFinite(parsedProjectId) ? parsedProjectId : undefined,
    provider:
      provider === "claude" || provider === "openai" || provider === "gemini"
        ? provider
        : undefined,
    model: params.get("model") || undefined,
    search: params.get("search") || undefined,
    minCost:
      params.get("minCost") && Number.isFinite(Number(params.get("minCost")))
        ? Number(params.get("minCost"))
        : undefined,
    maxCost:
      params.get("maxCost") && Number.isFinite(Number(params.get("maxCost")))
        ? Number(params.get("maxCost"))
        : undefined,
    dateFrom: params.get("dateFrom") || undefined,
    dateTo: params.get("dateTo") || undefined,
  };
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState<DashboardFilters>(() => parseUrlFilters());
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedUsageId, setSelectedUsageId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<UsageSortBy>("timestamp");
  const [sortDir, setSortDir] = useState<UsageSortDir>("desc");

  const utils = trpc.useUtils();
  const projectsQuery = trpc.projects.list.useQuery();
  const preferencesQuery = trpc.preferences.get.useQuery();

  const trpcFilters = useMemo(
    () => ({
      projectId: filters.projectId,
      provider: filters.provider,
      model: filters.model?.trim() || undefined,
      search: filters.search?.trim() || undefined,
      minCost: filters.minCost,
      maxCost: filters.maxCost,
      dateFrom: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : undefined,
      dateTo: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : undefined,
    }),
    [filters],
  );

  const analyticsQuery = trpc.analytics.dashboard.useQuery(
    {
      filters: trpcFilters,
      days: preferencesQuery.data?.forecastingDays ?? 30,
    },
    {
      enabled: !!filters.projectId,
    },
  );

  const usageQuery = trpc.usage.list.useQuery(
    {
      filters: trpcFilters,
      pagination: { page, pageSize: PAGE_SIZE },
      sort: { sortBy, sortDir },
    },
    { enabled: !!filters.projectId },
  );

  const detailQuery = trpc.usage.detail.useQuery(
    { id: selectedUsageId ?? 0 },
    { enabled: selectedUsageId !== null },
  );

  const filterOptionsQuery = trpc.analytics.filterOptions.useQuery(
    { filters: { projectId: filters.projectId } },
    { enabled: !!filters.projectId },
  );

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: async () => {
      toast.success("Project created");
      setNewProjectName("");
      setNewProjectDescription("");
      await projectsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const importMutation = trpc.usage.import.useMutation({
    onSuccess: async result => {
      toast.success(`Imported ${result.imported} entries`);
      await Promise.all([
        utils.analytics.dashboard.invalidate(),
        utils.usage.list.invalidate(),
        utils.analytics.filterOptions.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const exportMutation = trpc.exports.data.useMutation({
    onSuccess: payload => {
      const blob = new Blob([payload.content], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("projectId", String(filters.projectId));
    if (filters.provider) params.set("provider", filters.provider);
    if (filters.model) params.set("model", filters.model);
    if (filters.search) params.set("search", filters.search);
    if (filters.minCost !== undefined) params.set("minCost", String(filters.minCost));
    if (filters.maxCost !== undefined) params.set("maxCost", String(filters.maxCost));
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [filters, sortBy, sortDir]);

  useEffect(() => {
    if (!projectsQuery.data || projectsQuery.data.length === 0 || filters.projectId) return;
    setFilters(prev => ({ ...prev, projectId: projectsQuery.data![0].id }));
  }, [filters.projectId, projectsQuery.data]);

  const selectedProject = projectsQuery.data?.find(project => project.id === filters.projectId);

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) {
      toast.error("Project name is required");
      return;
    }
    createProjectMutation.mutate({
      name,
      description: newProjectDescription.trim() || undefined,
      color: "#3b82f6",
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!filters.projectId) {
      toast.error("Select a project before importing usage history");
      return;
    }

    setUploading(true);
    try {
      const content = await file.text();
      const parsed = parseHistoryFile(content, file.name);
      if (!parsed.success) {
        toast.error(parsed.error || "Unable to parse file");
        return;
      }

      await importMutation.mutateAsync({
        projectId: filters.projectId,
        entries: parsed.entries.map(entry => ({
          ...entry,
          timestamp: entry.timestamp,
        })),
      });
    } catch (error) {
      toast.error("Failed to process file");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((usageQuery.data?.total ?? 0) / PAGE_SIZE));
  const hasProjects = (projectsQuery.data?.length ?? 0) > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Cost Tracker</h1>
            <p className="text-muted-foreground mt-1">
              Persisted project analytics with filtering, exports, and detailed usage inspection.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void utils.analytics.dashboard.invalidate()}
              aria-label="Refresh analytics"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => exportMutation.mutate({ format: "csv", filters: trpcFilters })}
              disabled={!filters.projectId || exportMutation.isPending}
              aria-label="Export CSV"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={() => exportMutation.mutate({ format: "json", filters: trpcFilters })}
              disabled={!filters.projectId || exportMutation.isPending}
              aria-label="Export JSON"
            >
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </header>

        {!hasProjects && (
          <Card className="p-6 space-y-4" role="region" aria-label="Project onboarding">
            <h2 className="text-xl font-semibold">Create your first project</h2>
            <p className="text-muted-foreground text-sm">
              Start onboarding in three steps: create a project, upload usage history, then review analytics.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project name</Label>
                <Input
                  id="projectName"
                  value={newProjectName}
                  onChange={event => setNewProjectName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectDescription">Description</Label>
                <Input
                  id="projectDescription"
                  value={newProjectDescription}
                  onChange={event => setNewProjectDescription(event.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleCreateProject} disabled={createProjectMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Create project
            </Button>
          </Card>
        )}

        {hasProjects && (
          <Card className="p-4 md:p-6 space-y-4" role="region" aria-label="Global filters">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Filters</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="projectFilter">Project</Label>
                <Select
                  value={filters.projectId ? String(filters.projectId) : undefined}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, projectId: Number(value) || undefined }))
                  }
                >
                  <SelectTrigger id="projectFilter" className="w-full" aria-label="Project filter">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsQuery.data?.map(project => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="providerFilter">Provider</Label>
                <Select
                  value={filters.provider ?? "all"}
                  onValueChange={value =>
                    setFilters(prev => ({
                      ...prev,
                      provider: value === "all" ? undefined : (value as DashboardFilters["provider"]),
                    }))
                  }
                >
                  <SelectTrigger id="providerFilter" className="w-full" aria-label="Provider filter">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="modelFilter">Model</Label>
                <Select
                  value={filters.model || "all"}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, model: value === "all" ? undefined : value }))
                  }
                >
                  <SelectTrigger id="modelFilter" className="w-full" aria-label="Model filter">
                    <SelectValue placeholder="All models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All models</SelectItem>
                    {(filterOptionsQuery.data?.models ?? []).map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="searchFilter">Search</Label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    id="searchFilter"
                    className="pl-8"
                    value={filters.search ?? ""}
                    onChange={event =>
                      setFilters(prev => ({ ...prev, search: event.target.value || undefined }))
                    }
                    placeholder="Model / conversation"
                    aria-label="Search usage rows"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="minCost">Min cost (USD)</Label>
                <Input
                  id="minCost"
                  type="number"
                  min={0}
                  value={filters.minCost ?? ""}
                  onChange={event => {
                    const next = Number(event.target.value);
                    setFilters(prev => ({
                      ...prev,
                      minCost:
                        event.target.value === "" || !Number.isFinite(next) ? undefined : next,
                    }));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxCost">Max cost (USD)</Label>
                <Input
                  id="maxCost"
                  type="number"
                  min={0}
                  value={filters.maxCost ?? ""}
                  onChange={event => {
                    const next = Number(event.target.value);
                    setFilters(prev => ({
                      ...prev,
                      maxCost:
                        event.target.value === "" || !Number.isFinite(next) ? undefined : next,
                    }));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateFrom">From date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={event =>
                    setFilters(prev => ({ ...prev, dateFrom: event.target.value || undefined }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateTo">To date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={event =>
                    setFilters(prev => ({ ...prev, dateTo: event.target.value || undefined }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setFilters(prev => ({
                    projectId: prev.projectId,
                  }))
                }
              >
                Reset non-project filters
              </Button>
              <span className="text-xs text-muted-foreground">
                Active project: {selectedProject?.name ?? "None"}
              </span>
            </div>
          </Card>
        )}

        {hasProjects && filters.projectId && (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg">Import usage history</h2>
                <p className="text-sm text-muted-foreground">
                  Selected project: <span className="font-medium">{selectedProject?.name}</span>
                </p>
              </div>
              <FileUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-4">
              <FileUploadZone onFileUpload={handleFileUpload} isLoading={uploading || importMutation.isPending} />
            </div>
          </Card>
        )}

        {filters.projectId && analyticsQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}

        {filters.projectId && analyticsQuery.error && (
          <Card className="p-6 border-destructive/40">
            <h3 className="font-semibold text-destructive">Unable to load analytics</h3>
            <p className="text-sm text-muted-foreground mt-1">{analyticsQuery.error.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void analyticsQuery.refetch()}
            >
              Retry
            </Button>
          </Card>
        )}

        {filters.projectId && analyticsQuery.data && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
              <TabsTrigger value="forecast">Forecast</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <OverviewCards
                summary={analyticsQuery.data.summary}
                currency={preferencesQuery.data?.currency || "USD"}
              />
              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Daily trend</h3>
                  <CostChart data={analyticsQuery.data.dailyStats} />
                </Card>
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Top conversations</h3>
                  <TopConversations conversations={analyticsQuery.data.topConversations.slice(0, 8)} />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="breakdown" className="space-y-6">
              <ProviderBreakdown providers={analyticsQuery.data.providerStats} />
            </TabsContent>

            <TabsContent value="forecast" className="space-y-6">
              {analyticsQuery.data.forecast.length > 0 ? (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Forecast</h3>
                  <ForecastChart
                    forecast={analyticsQuery.data.forecast}
                    historical={analyticsQuery.data.dailyStats}
                  />
                </Card>
              ) : (
                <Card className="p-10 text-center text-muted-foreground">
                  Add more than one day of data to generate a forecast.
                </Card>
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-6">
              <Recommendations recommendations={analyticsQuery.data.recommendations} />
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <Card className="p-6 space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h3 className="font-semibold">Detailed conversation / prompt analysis</h3>
                  <div className="flex items-center gap-2">
                    <Select
                      value={sortBy}
                      onValueChange={value => setSortBy(value as UsageSortBy)}
                    >
                      <SelectTrigger className="w-[180px]" aria-label="Sort column">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="timestamp">Timestamp</SelectItem>
                        <SelectItem value="costUsd">Cost</SelectItem>
                        <SelectItem value="totalTokens">Total tokens</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={sortDir}
                      onValueChange={value => setSortDir(value as UsageSortDir)}
                    >
                      <SelectTrigger className="w-[140px]" aria-label="Sort direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {usageQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (usageQuery.data?.items.length ?? 0) === 0 ? (
                  <div className="rounded border border-dashed p-8 text-center text-muted-foreground">
                    No rows match the current filters.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Conversation</TableHead>
                          <TableHead className="text-right">Tokens</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usageQuery.data?.items.map(item => (
                          <TableRow
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer"
                            onClick={() => setSelectedUsageId(item.id)}
                            onKeyDown={event => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedUsageId(item.id);
                              }
                            }}
                          >
                            <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
                            <TableCell>{item.provider}</TableCell>
                            <TableCell className="max-w-48 truncate">{item.model}</TableCell>
                            <TableCell className="max-w-48 truncate">
                              {item.conversationId ?? "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.totalTokens.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">${item.costUsd.toFixed(4)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {usageQuery.data?.page ?? 1} of {totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {hasProjects && filters.projectId && analyticsQuery.data && analyticsQuery.data.totalRows === 0 && (
          <Card className="p-10 text-center">
            <h3 className="font-semibold">No usage data yet for this project</h3>
            <p className="text-muted-foreground mt-2">
              Upload a provider history file to generate project analytics.
            </p>
          </Card>
        )}
      </div>

      <Drawer
        direction="right"
        open={selectedUsageId !== null}
        onOpenChange={open => {
          if (!open) setSelectedUsageId(null);
        }}
      >
        <DrawerContent className="sm:max-w-xl">
          <DrawerHeader>
            <DrawerTitle>Usage detail</DrawerTitle>
            <DrawerDescription>Detailed conversation/prompt record.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-3 text-sm">
            {detailQuery.isLoading && (
              <>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            )}
            {detailQuery.data && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Provider</p>
                  <p>{detailQuery.data.provider}</p>
                  <p className="text-muted-foreground">Model</p>
                  <p>{detailQuery.data.model}</p>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p>{new Date(detailQuery.data.timestamp).toLocaleString()}</p>
                  <p className="text-muted-foreground">Input tokens</p>
                  <p>{detailQuery.data.inputTokens.toLocaleString()}</p>
                  <p className="text-muted-foreground">Output tokens</p>
                  <p>{detailQuery.data.outputTokens.toLocaleString()}</p>
                  <p className="text-muted-foreground">Total tokens</p>
                  <p>{detailQuery.data.totalTokens.toLocaleString()}</p>
                  <p className="text-muted-foreground">Cost</p>
                  <p>${detailQuery.data.costUsd.toFixed(4)}</p>
                  <p className="text-muted-foreground">Conversation ID</p>
                  <p className="break-all">{detailQuery.data.conversationId ?? "-"}</p>
                  <p className="text-muted-foreground">Prompt ID</p>
                  <p className="break-all">{detailQuery.data.promptId ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Metadata</p>
                  <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
                    {JSON.stringify(detailQuery.data.metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </DashboardLayout>
  );
}
