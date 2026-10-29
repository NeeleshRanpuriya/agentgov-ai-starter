
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Database,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Agent = {
  id?: string;
  _id?: string;
  name?: string;
  role?: string;
};

type AgentOutput = {
  agent_id?: string;
  output?: string;
  created_at?: string;
};

type Task = {
  id?: string;
  _id?: string;
  objective?: string;
  department?: string;
  status?: string;
  created_at?: string;
  final_result?: string;
  error?: string | null;
  agent_outputs?: AgentOutput[];
  policy?: {
    reason?: string;
    requires_approval?: boolean;
  };
};

type Audit = {
  id?: string;
  _id?: string;
  event_type?: string;
  event?: string;
  task_id?: string;
  created_at?: string;
  details?: Record<string, unknown>;
};

const AGENT_STAGES = [
  {
    id: "research",
    name: "Research Agent",
    role: "Collects findings and identifies assumptions",
    stage: "Discovery",
    icon: "01",
  },
  {
    id: "analyst",
    name: "Analyst Agent",
    role: "Analyzes evidence, risks and recommendations",
    stage: "Analysis",
    icon: "02",
  },
  {
    id: "reviewer",
    name: "Reviewer Agent",
    role: "Reviews quality, limitations and governance",
    stage: "Validation",
    icon: "03",
  },
];

function getId(item: { id?: string; _id?: string }): string {
  return String(item.id ?? item._id ?? "");
}

function prettyStatus(status?: string): string {
  return (status || "unknown").replaceAll("_", " ");
}

function safeDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function safeDateTime(value?: string): string {
  if (!value) return "Time unavailable";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString();
}

function normalizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }

  return [];
}

function App() {
  const [page, setPage] = useState("Overview");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [objective, setObjective] = useState("");
  const [department, setDepartment] = useState("Research");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [agentResponse, taskResponse, auditResponse] =
        await Promise.all([
          fetch(`${API}/api/agents`),
          fetch(`${API}/api/tasks`),
          fetch(`${API}/api/audit`),
        ]);

      if (
        !agentResponse.ok ||
        !taskResponse.ok ||
        !auditResponse.ok
      ) {
        throw new Error("Backend API returned an error.");
      }

      const [agentData, taskData, auditData] = await Promise.all([
        agentResponse.json(),
        taskResponse.json(),
        auditResponse.json(),
      ]);

      setAgents(normalizeArray<Agent>(agentData));
      setTasks(normalizeArray<Task>(taskData));
      setAudit(normalizeArray<Audit>(auditData));
      setError("");
    } catch (err) {
      console.error("Dashboard refresh failed:", err);
      setError(
        "Cannot load dashboard data. Check FastAPI on port 8000, MongoDB settings, and browser console."
      );
    }
  }, []);

  useEffect(() => {
    void refresh();

    // Poll the backend for updates to running workflows.
    const timer = window.setInterval(() => {
      void refresh();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [refresh]);

  async function createTask(event: FormEvent) {
    event.preventDefault();

    if (objective.trim().length < 8) {
      setError("Enter an objective with at least 8 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: objective.trim(),
          department,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || "Task creation failed."
        );
      }

      setObjective("");
      setNotice(`Task created: ${prettyStatus(data.status)}`);
      setPage("Tasks");
      await refresh();
    } catch (err) {
      console.error("Task creation failed:", err);
      setError(
        err instanceof Error ? err.message : "Could not create task."
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(
    taskId: string,
    decision: "approve" | "reject"
  ) {
    if (!taskId) {
      setError("Cannot review this task because its ID is missing.");
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/api/tasks/${encodeURIComponent(taskId)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            comment: "Decision submitted from demo dashboard",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Approval action failed.");
      }

      setNotice(
        decision === "approve"
          ? "Approval recorded. Sensitive execution remains disabled in this MVP."
          : "Task rejected."
      );

      await refresh();
    } catch (err) {
      console.error("Approval action failed:", err);
      setError(
        err instanceof Error ? err.message : "Approval failed."
      );
    }
  }

  const pending = tasks.filter(
    (task) => task.status === "awaiting_approval"
  ).length;

  const completed = tasks.filter(
    (task) => task.status === "completed"
  ).length;

  const running = tasks.filter((task) =>
    ["running", "queued"].includes(task.status || "")
  ).length;

  const nav = [
    { name: "Overview", icon: Activity },
    { name: "AI Agents", icon: Bot },
    { name: "Tasks", icon: ClipboardList },
    { name: "Policy Center", icon: ShieldCheck },
    { name: "Audit Logs", icon: TerminalSquare },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Network size={21} />
          </div>
          <div>
            <strong>
              AgentGov <span>AI</span>
            </strong>
            <small>ENTERPRISE CONTROL PLANE</small>
          </div>
        </div>

        <div className="workspace">
          <span className="workspace-dot" />
          Demo workspace
          <span className="chevron">⌄</span>
        </div>

        <p className="nav-label">PLATFORM</p>

        <nav>
          {nav.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                page === item.name ? "active" : ""
              }`}
              onClick={() => setPage(item.name)}
            >
              <item.icon size={18} />
              {item.name}

              {item.name === "Policy Center" && pending > 0 && (
                <b className="nav-count">{pending}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="secure-mark">
            <ShieldCheck size={18} />
            <div>
              <strong>Governance enabled</strong>
              <small>Demo policy engine active</small>
            </div>
          </div>

          <div className="user-row">
            <div className="avatar">A</div>
            <div>
              <strong>Workspace Admin</strong>
              <small>Local demo session</small>
            </div>
            <span className="dots">•••</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="slash">/</span>
            <strong>{page}</strong>
          </div>

          <div className="top-actions">
            <span className="live-dot" />
            System overview
            <button
              className="icon-button"
              onClick={() => void refresh()}
              title="Refresh"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                AI GOVERNANCE / CONTROL CENTER
              </div>
              <h1>
                {page === "Overview" ? "Command center" : page}
              </h1>
              <p>
                Coordinate AI work. Enforce policies. Keep every
                decision accountable.
              </p>
            </div>

            <button
              className="primary-btn"
              onClick={() => setPage("Tasks")}
            >
              <Plus size={17} />
              New task
            </button>
          </div>

          {error && (
            <div className="alert error">
              <CircleAlert size={18} />
              {error}
            </div>
          )}

          {notice && (
            <div className="alert success">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}

          {page === "Overview" && (
            <>
              <div className="metric-grid">
                <Metric
                  icon={<Bot />}
                  label="Registered agents"
                  value={String(agents.length).padStart(2, "0")}
                  hint="Specialized AI workers"
                  tone="purple"
                />
                <Metric
                  icon={<Activity />}
                  label="Active / queued"
                  value={String(running).padStart(2, "0")}
                  hint="Workflows in progress"
                  tone="blue"
                />
                <Metric
                  icon={<CheckCircle2 />}
                  label="Completed tasks"
                  value={String(completed).padStart(2, "0")}
                  hint="Successful workflows"
                  tone="green"
                />
                <Metric
                  icon={<ShieldCheck />}
                  label="Awaiting approval"
                  value={String(pending).padStart(2, "0")}
                  hint="Held by policy engine"
                  tone="orange"
                />
              </div>

              <div className="two-col">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Agent network</h2>
                      <p>
                        Specialized workers available to the orchestrator
                      </p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setPage("AI Agents")}
                    >
                      View agents ↗
                    </button>
                  </div>

                  <div className="agent-list">
                    {agents.map((agent, index) => (
                      <div
                        className="agent-row"
                        key={getId(agent) || `${agent.name}-${index}`}
                      >
                        <div className={`agent-icon tint-${index}`}>
                          <Bot size={19} />
                        </div>
                        <div className="agent-info">
                          <strong>{agent.name || "Unnamed agent"}</strong>
                          <small>{agent.role || "Role unavailable"}</small>
                        </div>
                        <span className="status-pill online">
                          <i />
                          Registered
                        </span>
                      </div>
                    ))}

                    {agents.length === 0 && (
                      <div className="empty-state">
                        No registered agents returned by the API.
                      </div>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Policy watch</h2>
                      <p>Governance checkpoints</p>
                    </div>
                    <ShieldCheck size={19} className="muted" />
                  </div>

                  <div className="policy-callout">
                    <div className="policy-symbol">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <strong>Approval gate enabled</strong>
                      <p>
                        Sensitive-action keywords send tasks to the
                        approval queue.
                      </p>
                    </div>
                  </div>

                  <div className="policy-stats">
                    <div>
                      <span>Pending reviews</span>
                      <strong>{pending}</strong>
                    </div>
                    <div>
                      <span>Audit events</span>
                      <strong>{audit.length}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-btn full"
                    onClick={() => setPage("Policy Center")}
                  >
                    Open policy center
                  </button>
                </section>
              </div>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent workflows</h2>
                    <p>Latest task activity across your workspace</p>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => setPage("Tasks")}
                  >
                    All tasks ↗
                  </button>
                </div>
                <TaskTable tasks={tasks.slice(0, 5)} />
              </section>
            </>
          )}

          {page === "AI Agents" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Registered agents</h2>
                  <p>
                    Each agent has a bounded role in the workflow.
                  </p>
                </div>
              </div>

              <div className="agent-cards">
                {agents.map((agent, index) => (
                  <div
                    className="agent-card"
                    key={getId(agent) || `${agent.name}-${index}`}
                  >
                    <div className={`agent-icon tint-${index}`}>
                      <Bot size={22} />
                    </div>
                    <span className="status-pill online">
                      <i />
                      Ready
                    </span>
                    <h3>{agent.name || "Unnamed agent"}</h3>
                    <p>{agent.role || "Role unavailable"}</p>

                    <div className="agent-meta">
                      <span>Agent ID</span>
                      <code>{getId(agent) || "Unavailable"}</code>
                    </div>
                    <div className="agent-meta">
                      <span>Workflow stage</span>
                      <strong>
                        {["Discovery", "Analysis", "Validation"][index] ||
                          "Specialist"}
                      </strong>
                    </div>
                  </div>
                ))}

                {agents.length === 0 && (
                  <div className="empty-state">No agents available.</div>
                )}
              </div>
            </section>
          )}

          {page === "Tasks" && (
            <div className="tasks-layout">
              <section className="panel create-panel">
                <div className="panel-head">
                  <div>
                    <h2>Create a governed task</h2>
                    <p>
                      The orchestrator runs Research → Analyst → Reviewer.
                    </p>
                  </div>
                </div>

                <form onSubmit={createTask}>
                  <label htmlFor="objective">Task objective</label>
                  <textarea
                    id="objective"
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    placeholder="Example: Analyze the benefits and risks of using AI agents in customer support."
                    rows={5}
                  />

                  <label htmlFor="department">Department</label>
                  <select
                    id="department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                  >
                    <option>Research</option>
                    <option>Finance</option>
                    <option>Engineering</option>
                    <option>Human Resources</option>
                    <option>Customer Support</option>
                    <option>General</option>
                  </select>

                  <div className="form-note">
                    <ShieldCheck size={16} />
                    Sensitive actions may require approval before processing.
                  </div>

                  <button className="primary-btn" disabled={busy}>
                    {busy ? (
                      "Submitting task…"
                    ) : (
                      <>
                        <Plus size={17} />
                        Run agent workflow
                      </>
                    )}
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Task queue</h2>
                    <p>Inspect agent outputs and pending approvals</p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => void refresh()}
                    title="Refresh tasks"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                <TaskTable tasks={tasks} onDecide={decide} />
              </section>
            </div>
          )}

          {page === "Policy Center" && (
            <>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Policy controls</h2>
                    <p>Current demonstration policy configuration</p>
                  </div>
                  <span className="status-pill online">
                    <i />
                    Enabled
                  </span>
                </div>

                <div className="policy-detail">
                  <ShieldCheck size={24} />
                  <div>
                    <h3>Sensitive Action Approval Gate</h3>
                    <p>
                      Tasks matching sensitive-action keywords are held
                      for review. This is a demonstration rule, not a
                      complete security boundary.
                    </p>
                    <div className="tag-row">
                      {[
                        "delete",
                        "transfer",
                        "payment",
                        "payroll",
                        "salary",
                        "personal data",
                        "credentials",
                      ].map((keyword) => (
                        <code key={keyword}>{keyword}</code>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="alert warning">
                  <CircleAlert size={18} />
                  Approvals are recorded for demonstration, but
                  sensitive-task execution is intentionally disabled in
                  this MVP.
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Approval queue</h2>
                    <p>Review tasks held by the policy engine</p>
                  </div>
                </div>
                <TaskTable
                  tasks={tasks.filter(
                    (task) => task.status === "awaiting_approval"
                  )}
                  onDecide={decide}
                />
              </section>
            </>
          )}

          {page === "Audit Logs" && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Audit trail</h2>
                  <p>Workflow and policy events persisted in MongoDB</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void refresh()}
                  title="Refresh audit logs"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="audit-list">
                {audit.map((event, index) => {
                  const eventName =
                    event.event_type || event.event || "Unknown event";

                  return (
                    <div
                      className="audit-row"
                      key={
                        getId(event) ||
                        `${event.task_id}-${eventName}-${index}`
                      }
                    >
                      <div className="audit-icon">
                        <Database size={17} />
                      </div>
                      <div className="audit-copy">
                        <strong>{prettyStatus(eventName)}</strong>
                        <small>
                          Task {event.task_id || "—"} ·{" "}
                          {safeDateTime(event.created_at)}
                        </small>
                      </div>
                      <code>
                        {JSON.stringify(event.details || {})}
                      </code>
                    </div>
                  );
                })}

                {audit.length === 0 && (
                  <div className="empty-state">No audit events found.</div>
                )}
              </div>
            </section>
          )}

          <footer>
            AgentGov AI <span>•</span> Educational MVP <span>•</span>{" "}
            Governance-aware orchestration
          </footer>
        </div>
      </main>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  const numericValue = Number(value) || 0;

  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <small>{hint}</small>
      <div className="metric-line">
        <i
          style={{
            width: `${Math.min(90, Math.max(15, numericValue * 10))}%`,
          }}
        />
      </div>
    </div>
  );
}

function AgentWorkflow({ task }: { task: Task }) {
  const outputs = Array.isArray(task.agent_outputs)
    ? task.agent_outputs
    : [];

  const status = (task.status || "unknown").toLowerCase();

  function getOutput(agentId: string) {
    return outputs.find((item) => {
      const id = (item.agent_id || "")
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

      return id === agentId || id.includes(agentId);
    });
  }

  function getAgentStatus(index: number): string {
    if (getOutput(AGENT_STAGES[index].id)) return "completed";

    if (status === "awaiting_approval" || status === "rejected") {
      return "blocked";
    }

    if (status === "failed") {
      return index === outputs.length ? "failed" : "pending";
    }

    if (status === "running" && index === outputs.length) {
      return "running";
    }

    if (status === "queued" && index === 0) {
      return "queued";
    }

    if (status === "completed") {
      return "not-reported";
    }

    return "pending";
  }

  const labels: Record<string, string> = {
    completed: "Completed",
    running: "Running",
    queued: "Queued",
    pending: "Pending",
    failed: "Failed",
    blocked: "Approval gate",
    "not-reported": "No output",
  };

  return (
    <section className="agent-workflow">
      <div className="workflow-heading">
        <div>
          <h3>Multi-Agent Workflow</h3>
          <p>Research → Analyst → Reviewer</p>
        </div>

        <span
          className={`status-pill ${
            status === "completed"
              ? "online"
              : status === "failed"
                ? "danger"
                : status === "awaiting_approval"
                  ? "pending"
                  : "neutral"
          }`}
        >
          {prettyStatus(status)}
        </span>
      </div>

      <div className="workflow-grid">
        {AGENT_STAGES.map((agent, index) => {
          const agentStatus = getAgentStatus(index);
          const output = getOutput(agent.id);

          return (
            <article
              className={`workflow-card workflow-${agentStatus}`}
              key={agent.id}
            >
              <div className="workflow-agent-top">
                <div className="workflow-agent-icon">
                  {agent.icon}
                </div>

                <div className="workflow-agent-info">
                  <strong>{agent.name}</strong>
                  <small>{agent.role}</small>
                </div>
              </div>

              <div className="workflow-meta">
                <span>{agent.stage}</span>
                <b>
                  {agentStatus === "running" && (
                    <i className="workflow-spinner" />
                  )}
                  {labels[agentStatus] || "Pending"}
                </b>
              </div>

              <div className="workflow-agent-output">
                {output?.output ? (
                  <>
                    <strong>Agent output</strong>
                    <pre>{output.output}</pre>
                  </>
                ) : agentStatus === "running" ? (
                  <p>Agent is processing the task…</p>
                ) : agentStatus === "blocked" ? (
                  <p>Execution is waiting for approval.</p>
                ) : agentStatus === "failed" ? (
                  <p>Workflow failed before this stage completed.</p>
                ) : agentStatus === "not-reported" ? (
                  <p>
                    The task is marked complete, but this agent's output
                    was not returned by the API.
                  </p>
                ) : (
                  <p>Waiting for this stage to start.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {task.error && (
        <div className="workflow-error">
          <CircleAlert size={15} />
          {task.error}
        </div>
      )}

      {task.final_result && (
        <details className="workflow-final-result">
          <summary>View combined final report</summary>
          <pre>{task.final_result}</pre>
        </details>
      )}
    </section>
  );
}

function TaskTable({
  tasks,
  onDecide,
}: {
  tasks: Task[];
  onDecide?: (
    id: string,
    decision: "approve" | "reject"
  ) => void;
}) {
  if (!tasks.length) {
    return (
      <div className="empty-state">
        <ClipboardList size={28} />
        <strong>No tasks yet</strong>
        <span>Create a task to start a multi-agent workflow.</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Task / Agent workflow</th>
            <th>Department</th>
            <th>Status</th>
            <th>Created</th>
            {onDecide && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {tasks.map((task, index) => {
            const id = getId(task);
            const status = task.status || "unknown";
            const taskObjective =
              task.objective || "No objective provided";

            return (
              <tr key={id || `${taskObjective}-${index}`}>
                <td className="task-main-cell">
                  <div className="task-title">{taskObjective}</div>
                  <small className="task-id">
                    {id ? id.slice(-8) : "ID unavailable"}
                  </small>

                  <AgentWorkflow task={task} />
                </td>

                <td>{task.department || "General"}</td>

                <td>
                  <span
                    className={`status-pill ${
                      status === "completed"
                        ? "online"
                        : status === "awaiting_approval"
                          ? "pending"
                          : status === "failed" || status === "rejected"
                            ? "danger"
                            : "neutral"
                    }`}
                  >
                    {prettyStatus(status)}
                  </span>
                </td>

                <td>{safeDate(task.created_at)}</td>

                {onDecide && (
                  <td>
                    {status === "awaiting_approval" && (
                      <div className="action-buttons">
                        <button
                          className="approve-btn"
                          disabled={!id}
                          onClick={() => onDecide(id, "approve")}
                        >
                          Record approval
                        </button>
                        <button
                          className="reject-btn"
                          disabled={!id}
                          onClick={() => onDecide(id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;
