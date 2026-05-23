/**
 * Transcript Intelligence Architecture
 *
 * Prepares the foundation for:
 * - Multi-transcript analysis
 * - Cross-session AI search
 * - Workspace memory
 * - Enterprise research repository
 * - Semantic transcript search
 * - Team collaboration
 */

// --- Multi-Transcript Analysis ---
export interface AnalysisWorkspace {
  id: string;
  name: string;
  transcriptIds: string[];
  createdAt: number;
  lastAccessedAt: number;
  notes?: string;
}

export interface CrossSessionQuery {
  id: string;
  query: string;
  results: SearchResult[];
  timestamp: number;
}

export interface SearchResult {
  fileId: string;
  fileName: string;
  segmentIndex: number;
  speaker: string;
  text: string;
  startMs: number;
  relevanceScore: number;
  matchType: "exact" | "semantic" | "speaker" | "topic";
}

// --- Workspace Memory ---
export interface WorkspaceMemory {
  recentQueries: string[];
  pinnedInsights: PinnedInsight[];
  preferences: WorkspacePreferences;
  sessionHistory: SessionEntry[];
}

export interface PinnedInsight {
  id: string;
  type: "summary" | "action" | "decision" | "risk" | "custom";
  text: string;
  sourceFileId: string;
  sourceSegmentIndex?: number;
  pinnedAt: number;
}

export interface WorkspacePreferences {
  defaultLanguage: string;
  autoSummarize: boolean;
  summaryStyle: "concise" | "detailed" | "executive";
  preferredModules: string[];
}

export interface SessionEntry {
  fileId: string;
  fileName: string;
  accessedAt: number;
  duration: number;
  segmentCount: number;
  hasSummary: boolean;
}

// --- Semantic Search ---
export interface SemanticIndex {
  fileId: string;
  embeddings: SegmentEmbedding[];
  indexedAt: number;
  model: string;
}

export interface SegmentEmbedding {
  segmentIndex: number;
  vector: number[];
  text: string;
  speaker: string;
  startMs: number;
}

// --- Team Collaboration ---
export interface CollaborationState {
  workspaceId: string;
  members: TeamMember[];
  sharedAnnotations: SharedAnnotation[];
  activityLog: ActivityEntry[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  lastActive: number;
}

export interface SharedAnnotation {
  id: string;
  authorId: string;
  fileId: string;
  segmentIndex: number;
  text: string;
  type: "comment" | "highlight" | "tag" | "task";
  createdAt: number;
  resolved: boolean;
}

export interface ActivityEntry {
  id: string;
  actorId: string;
  action: "upload" | "summarize" | "annotate" | "export" | "share" | "comment";
  fileId?: string;
  detail: string;
  timestamp: number;
}

// --- Research Repository ---
export interface ResearchProject {
  id: string;
  name: string;
  description: string;
  transcriptIds: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  insights: ProjectInsight[];
}

export interface ProjectInsight {
  id: string;
  type: "theme" | "pattern" | "contradiction" | "consensus" | "gap";
  title: string;
  description: string;
  sourceFileIds: string[];
  confidence: number;
  generatedAt: number;
}

// --- Storage Keys ---
const WORKSPACE_MEMORY_KEY = "recllm-workspace-memory";
const WORKSPACES_KEY = "recllm-analysis-workspaces";
const PROJECTS_KEY = "recllm-research-projects";

// --- Workspace Memory Persistence ---
export function loadWorkspaceMemory(): WorkspaceMemory {
  try {
    const raw = localStorage.getItem(WORKSPACE_MEMORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    recentQueries: [],
    pinnedInsights: [],
    preferences: {
      defaultLanguage: "en",
      autoSummarize: false,
      summaryStyle: "concise",
      preferredModules: ["summary", "keypoints", "actions"],
    },
    sessionHistory: [],
  };
}

export function saveWorkspaceMemory(memory: WorkspaceMemory) {
  localStorage.setItem(WORKSPACE_MEMORY_KEY, JSON.stringify(memory));
}

export function addRecentQuery(query: string) {
  const memory = loadWorkspaceMemory();
  memory.recentQueries = [query, ...memory.recentQueries.filter((q) => q !== query)].slice(0, 50);
  saveWorkspaceMemory(memory);
}

export function pinInsight(insight: Omit<PinnedInsight, "id" | "pinnedAt">): PinnedInsight {
  const memory = loadWorkspaceMemory();
  const pinned: PinnedInsight = { ...insight, id: `pin_${Date.now()}`, pinnedAt: Date.now() };
  memory.pinnedInsights.push(pinned);
  saveWorkspaceMemory(memory);
  return pinned;
}

export function recordSessionAccess(entry: Omit<SessionEntry, "accessedAt">) {
  const memory = loadWorkspaceMemory();
  memory.sessionHistory = [
    { ...entry, accessedAt: Date.now() },
    ...memory.sessionHistory.filter((s) => s.fileId !== entry.fileId),
  ].slice(0, 100);
  saveWorkspaceMemory(memory);
}

// --- Analysis Workspaces ---
export function loadWorkspaces(): AnalysisWorkspace[] {
  try {
    const raw = localStorage.getItem(WORKSPACES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveWorkspaces(workspaces: AnalysisWorkspace[]) {
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
}

export function createWorkspace(name: string, transcriptIds: string[]): AnalysisWorkspace {
  const workspaces = loadWorkspaces();
  const ws: AnalysisWorkspace = {
    id: `ws_${Date.now()}`,
    name,
    transcriptIds,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };
  workspaces.push(ws);
  saveWorkspaces(workspaces);
  return ws;
}

// --- Research Projects ---
export function loadProjects(): ResearchProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveProjects(projects: ResearchProject[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function createProject(name: string, description: string): ResearchProject {
  const projects = loadProjects();
  const project: ResearchProject = {
    id: `proj_${Date.now()}`,
    name,
    description,
    transcriptIds: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    insights: [],
  };
  projects.push(project);
  saveProjects(projects);
  return project;
}

// --- Cross-Session Search (local text search) ---
export function searchTranscripts(
  transcripts: { fileId: string; fileName: string; utterances: { speaker: string; text: string; startMs: number }[] }[],
  query: string,
  options?: { speaker?: string; maxResults?: number }
): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const maxResults = options?.maxResults || 50;

  for (const t of transcripts) {
    for (let i = 0; i < t.utterances.length; i++) {
      const u = t.utterances[i];
      if (options?.speaker && u.speaker !== options.speaker) continue;
      if (u.text.toLowerCase().includes(queryLower)) {
        results.push({
          fileId: t.fileId,
          fileName: t.fileName,
          segmentIndex: i,
          speaker: u.speaker,
          text: u.text,
          startMs: u.startMs,
          relevanceScore: u.text.toLowerCase().split(queryLower).length - 1,
          matchType: "exact",
        });
        if (results.length >= maxResults) return results;
      }
    }
  }

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
