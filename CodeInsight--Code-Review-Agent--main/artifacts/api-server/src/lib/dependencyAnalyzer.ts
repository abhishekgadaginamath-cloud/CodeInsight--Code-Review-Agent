/**
 * Deterministic dependency analyzer.
 * Parses import/require/from statements from code text to build
 * a file-level dependency graph. No AI — purely static analysis.
 */

export interface DependencyEdge {
  from: string;
  to: string;
  kind: "import" | "require" | "dynamic";
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  /** adjacency: file -> files it imports */
  imports: Record<string, string[]>;
  /** reverse adjacency: file -> files that import it */
  importedBy: Record<string, string[]>;
  files: string[];
}

/** Parse all import/require statements from a single file's source text. */
export function parseImports(filePath: string, source: string): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const basedir = filePath.split("/").slice(0, -1).join("/");

  // static ES import:  import X from './foo'
  const esImport = /import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = esImport.exec(source)) !== null) {
    edges.push({ from: filePath, to: resolveRelative(basedir, m[1]), kind: "import" });
  }

  // CommonJS require:  require('./foo')
  const cjsRequire = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = cjsRequire.exec(source)) !== null) {
    edges.push({ from: filePath, to: resolveRelative(basedir, m[1]), kind: "require" });
  }

  // Dynamic import():  import('./foo')
  const dynImport = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynImport.exec(source)) !== null) {
    edges.push({ from: filePath, to: resolveRelative(basedir, m[1]), kind: "dynamic" });
  }

  // Python-style:  from .foo import bar  /  import foo
  const pyFrom = /from\s+([.\w/]+)\s+import/g;
  while ((m = pyFrom.exec(source)) !== null) {
    edges.push({ from: filePath, to: resolveRelative(basedir, m[1]), kind: "import" });
  }

  return edges;
}

function resolveRelative(basedir: string, importPath: string): string {
  if (!importPath.startsWith(".")) return importPath; // external package
  const parts = [...basedir.split("/"), ...importPath.split("/")];
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === "..") resolved.pop();
    else if (p !== "." && p !== "") resolved.push(p);
  }
  return resolved.join("/");
}

/** Build a full dependency graph from a map of filePath -> sourceCode. */
export function buildDependencyGraph(files: Record<string, string>): DependencyGraph {
  const edges: DependencyEdge[] = [];
  const imports: Record<string, string[]> = {};
  const importedBy: Record<string, string[]> = {};

  for (const [path, source] of Object.entries(files)) {
    imports[path] = [];
    const fileEdges = parseImports(path, source);
    edges.push(...fileEdges);
    for (const edge of fileEdges) {
      imports[path].push(edge.to);
      importedBy[edge.to] = importedBy[edge.to] ?? [];
      importedBy[edge.to].push(path);
    }
  }

  return { edges, imports, importedBy, files: Object.keys(files) };
}

/**
 * Find all files transitively affected if `changedFile` is modified.
 * Returns files that (directly or indirectly) import the changed file.
 */
export function findAffectedFiles(graph: DependencyGraph, changedFile: string): string[] {
  const affected = new Set<string>();
  const queue = [changedFile];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = graph.importedBy[current] ?? [];
    for (const dep of dependents) {
      if (!affected.has(dep)) {
        affected.add(dep);
        queue.push(dep);
      }
    }
  }

  affected.delete(changedFile);
  return [...affected];
}

/**
 * Classify the risk of changing a file given how many files depend on it.
 */
export function classifyImpact(affectedCount: number): "safe" | "moderate" | "high-risk" {
  if (affectedCount === 0) return "safe";
  if (affectedCount <= 3) return "moderate";
  return "high-risk";
}

/**
 * Build a minimal dependency graph from a file-list string like the one
 * fetched from GitHub API (no source access — uses heuristics from filenames).
 * Falls back when we don't have full source.
 */
export function buildHeuristicGraph(filePaths: string[]): DependencyGraph {
  const imports: Record<string, string[]> = {};
  const importedBy: Record<string, string[]> = {};

  // Heuristic: shared utility / lib files are "imported by" many things
  for (const fp of filePaths) {
    imports[fp] = [];
    const lp = fp.toLowerCase();
    const dependents = filePaths.filter((other) => {
      if (other === fp) return false;
      // pages / routes likely import from utils/lib/helpers/services
      if ((lp.includes("util") || lp.includes("helper") || lp.includes("lib") || lp.includes("service")) &&
          (other.includes("page") || other.includes("route") || other.includes("controller") || other.includes("handler"))) {
        return true;
      }
      return false;
    });
    for (const dep of dependents) {
      imports[fp].push(dep);
      importedBy[dep] = importedBy[dep] ?? [];
      importedBy[dep].push(fp);
    }
  }

  return { edges: [], imports, importedBy, files: filePaths };
}
