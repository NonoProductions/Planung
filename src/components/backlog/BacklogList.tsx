"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, NotebookPen, Search, X } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import BacklogTaskCard from "@/components/backlog/BacklogTaskCard";

type BucketKey = "this_week" | "next_weeks" | "someday";

type SectionConfig = {
  key: BucketKey;
  label: string;
};

const BUCKETS: SectionConfig[] = [
  { key: "this_week", label: "Diese Woche" },
  { key: "next_weeks", label: "Nächste Wochen" },
  { key: "someday", label: "Irgendwann" },
];

const COLOR_PRIMARY = "var(--text-primary)";
const COLOR_SECONDARY = "var(--text-secondary)";
const COLOR_MUTED = "var(--text-muted)";
const COLOR_ACCENT = "var(--accent-primary)";

const innerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto",
  padding: "28px 28px 40px",
  display: "flex",
  flexDirection: "column",
  gap: 22,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 24,
  paddingBottom: 4,
  borderBottom: "1px solid #efe8e0",
};

const titleStyle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 36,
  fontWeight: 800,
  lineHeight: 0.96,
  letterSpacing: "-0.065em",
};

const pillsRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  paddingBottom: 10,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: "rgba(244, 239, 232, 0.85)",
  color: COLOR_SECONDARY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  paddingTop: 22,
  borderTop: "1px solid #efe8e0",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  width: "100%",
  padding: 0,
  border: 0,
  background: "transparent",
  textAlign: "left",
  cursor: "pointer",
};

const sectionTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const sectionTitle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 26,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "-0.05em",
};

const sectionCount: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  background: "rgba(244, 239, 232, 0.85)",
  color: COLOR_MUTED,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "-0.015em",
};

const sectionToggle: CSSProperties = {
  flexShrink: 0,
  color: COLOR_MUTED,
  display: "inline-flex",
  alignItems: "center",
  transition: "transform 160ms ease",
};

const taskStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingTop: 4,
};

const emptyCopy: CSSProperties = {
  padding: "6px 0 0",
  color: COLOR_MUTED,
  fontSize: 13,
  lineHeight: 1.6,
};

const addButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  minHeight: 38,
  marginTop: 4,
  padding: "0 14px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#ffffff",
  color: COLOR_SECONDARY,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  cursor: "pointer",
  boxShadow: "0 1px 0 rgba(89, 72, 48, 0.04)",
};

const inlineFormStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 14,
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 1px 0 rgba(89, 72, 48, 0.04)",
};

const inlineInputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 0",
  border: 0,
  borderBottom: "1px solid var(--border-subtle)",
  background: "transparent",
  color: COLOR_PRIMARY,
  fontSize: 14,
  fontWeight: 500,
  outline: "none",
};

const inlineFieldStyle: CSSProperties = {
  minHeight: 32,
  padding: "4px 10px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#fbfaf8",
  color: COLOR_SECONDARY,
  fontSize: 12,
  fontWeight: 600,
  outline: "none",
};

const inlineRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
};

const subtleButton: CSSProperties = {
  padding: "6px 12px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButton: CSSProperties = {
  padding: "7px 14px",
  border: 0,
  borderRadius: 8,
  background: COLOR_ACCENT,
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "-0.015em",
  cursor: "pointer",
};

const toolbarInputWrap: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 36,
  padding: "0 12px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#ffffff",
  color: COLOR_SECONDARY,
  flex: 1,
  minWidth: 0,
  maxWidth: 320,
};

const toolbarInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 0,
  background: "transparent",
  color: COLOR_PRIMARY,
  fontSize: 13,
  outline: "none",
};

const toolbarSelect: CSSProperties = {
  minHeight: 36,
  padding: "0 10px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#ffffff",
  color: COLOR_SECONDARY,
  fontSize: 13,
  fontWeight: 600,
  outline: "none",
};

const brainDumpPanel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "18px 20px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 1px 0 rgba(89, 72, 48, 0.04)",
};

const brainDumpTextarea: CSSProperties = {
  width: "100%",
  minHeight: 140,
  resize: "vertical",
  padding: "12px 14px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#fdfbf7",
  color: COLOR_PRIMARY,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.6,
  outline: "none",
};

const folderShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  paddingTop: 24,
  borderTop: "1px solid #efe8e0",
};

const folderShellHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const folderShellTitle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.04em",
};

function formatTaskCount(count: number) {
  return `${count} ${count === 1 ? "Aufgabe" : "Aufgaben"}`;
}

function Section({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <button type="button" onClick={onToggle} style={sectionHeaderStyle}>
        <div style={sectionTitleRow}>
          <h3 style={sectionTitle}>{title}</h3>
          <span style={sectionCount}>{formatTaskCount(count)}</span>
        </div>
        <motion.span
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: 0.16 }}
          style={sectionToggle}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={taskStack}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function BacklogList() {
  const backlogTasks = useTaskStore((state) => state.backlogTasks);
  const backlogLoading = useTaskStore((state) => state.backlogLoading);
  const channels = useTaskStore((state) => state.channels);
  const fetchBacklogTasks = useTaskStore((state) => state.fetchBacklogTasks);
  const fetchChannels = useTaskStore((state) => state.fetchChannels);
  const addTask = useTaskStore((state) => state.addTask);
  const quickAddRequest = useUIStore((state) => state.quickAddRequest);
  const requestBacklogQuickAdd = useUIStore(
    (state) => state.requestBacklogQuickAdd
  );
  const clearQuickAddRequest = useUIStore((state) => state.clearQuickAddRequest);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(
    new Set()
  );
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set()
  );

  const [brainDumpActive, setBrainDumpActive] = useState(false);
  const [brainDumpBucket, setBrainDumpBucket] = useState<BucketKey>("someday");
  const [brainDumpText, setBrainDumpText] = useState("");
  const brainDumpRef = useRef<HTMLTextAreaElement>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newPlannedTime, setNewPlannedTime] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBacklogTasks();
    fetchChannels();
  }, [fetchBacklogTasks, fetchChannels]);

  useEffect(() => {
    if (quickAddRequest?.mode === "backlog") addInputRef.current?.focus();
  }, [quickAddRequest]);

  useEffect(() => {
    if (brainDumpActive) brainDumpRef.current?.focus();
  }, [brainDumpActive]);

  useEffect(() => {
    if (showNewFolder) folderInputRef.current?.focus();
  }, [showNewFolder]);

  const folders = useMemo(() => {
    const folderSet = new Set<string>();
    backlogTasks.forEach((task) => {
      if (task.backlogFolder) folderSet.add(task.backlogFolder);
    });

    return Array.from(folderSet).sort((first, second) =>
      first.localeCompare(second)
    );
  }, [backlogTasks]);

  const filteredTasks = useMemo(() => {
    return backlogTasks.filter((task) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTask = task.title.toLowerCase().includes(query);
        const matchesChannel = (task.channel?.name || "")
          .toLowerCase()
          .includes(query);

        if (!matchesTask && !matchesChannel) return false;
      }

      if (filterChannel && task.channelId !== filterChannel) return false;
      return true;
    });
  }, [backlogTasks, filterChannel, searchQuery]);

  const tasksByBucket = useMemo(() => {
    const grouped: Record<BucketKey, typeof filteredTasks> = {
      this_week: [],
      next_weeks: [],
      someday: [],
    };

    filteredTasks.forEach((task) => {
      if (task.backlogFolder) return;
      const bucket = task.backlogBucket || "someday";
      grouped[bucket in grouped ? (bucket as BucketKey) : "someday"].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  const tasksByFolder = useMemo(() => {
    const grouped: Record<string, typeof filteredTasks> = {};

    filteredTasks.forEach((task) => {
      if (!task.backlogFolder) return;
      if (!grouped[task.backlogFolder]) grouped[task.backlogFolder] = [];
      grouped[task.backlogFolder].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  const backlogQuickAddTarget =
    quickAddRequest?.mode === "backlog" ? quickAddRequest.value : null;

  const pendingFolderName = backlogQuickAddTarget?.startsWith("folder:")
    ? backlogQuickAddTarget.slice("folder:".length)
    : null;

  const visibleFolders = useMemo(() => {
    if (!pendingFolderName) return folders;

    return Array.from(new Set([...folders, pendingFolderName])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [folders, pendingFolderName]);

  const totalCount = backlogTasks.length;
  const visibleCount = filteredTasks.length;
  const completedCount = filteredTasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;

  const resetInlineForm = () => {
    clearQuickAddRequest();
    setNewTitle("");
    setNewChannelId("");
    setNewPlannedTime("");
  };

  const toggleBucket = (key: string) => {
    setCollapsedBuckets((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFolder = (name: string) => {
    setCollapsedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAddTask = async (bucket: string) => {
    if (!newTitle.trim()) return;

    await addTask({
      title: newTitle.trim(),
      isBacklog: true,
      backlogBucket: bucket,
      channelId: newChannelId || undefined,
      plannedTime: newPlannedTime ? parseInt(newPlannedTime, 10) : undefined,
    });

    resetInlineForm();
  };

  const handleAddInFolder = async (folder: string) => {
    if (!newTitle.trim()) return;

    await addTask({
      title: newTitle.trim(),
      isBacklog: true,
      backlogFolder: folder,
      backlogBucket: "someday",
      channelId: newChannelId || undefined,
      plannedTime: newPlannedTime ? parseInt(newPlannedTime, 10) : undefined,
    });

    resetInlineForm();
  };

  const handleAddKeyDown = (
    event: KeyboardEvent,
    bucketOrFolder: string,
    isFolder?: boolean
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (isFolder) handleAddInFolder(bucketOrFolder);
      else handleAddTask(bucketOrFolder);
    }

    if (event.key === "Escape") {
      resetInlineForm();
    }
  };

  const handleBrainDump = useCallback(async () => {
    const lines = brainDumpText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      await addTask({
        title: line,
        isBacklog: true,
        backlogBucket: brainDumpBucket,
      });
    }

    setBrainDumpText("");
    setBrainDumpActive(false);
  }, [addTask, brainDumpBucket, brainDumpText]);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    requestBacklogQuickAdd(`folder:${newFolderName.trim()}`);
    setShowNewFolder(false);
    setNewFolderName("");
  };

  const renderAddForm = (bucketOrFolder: string, isFolder?: boolean) => (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.16 }}
      style={inlineFormStyle}
    >
      <input
        ref={addInputRef}
        type="text"
        value={newTitle}
        onChange={(event) => setNewTitle(event.target.value)}
        onKeyDown={(event) => handleAddKeyDown(event, bucketOrFolder, isFolder)}
        placeholder="Neue Aufgabe…"
        style={inlineInputStyle}
      />

      <div style={inlineRow}>
        <select
          value={newChannelId}
          onChange={(event) => setNewChannelId(event.target.value)}
          style={inlineFieldStyle}
        >
          <option value="">Kein Kanal</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={0}
          value={newPlannedTime}
          onChange={(event) => setNewPlannedTime(event.target.value)}
          onKeyDown={(event) => handleAddKeyDown(event, bucketOrFolder, isFolder)}
          placeholder="Min."
          style={{ ...inlineFieldStyle, width: 80 }}
        />

        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          <button type="button" onClick={resetInlineForm} style={subtleButton}>
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() =>
              isFolder ? handleAddInFolder(bucketOrFolder) : handleAddTask(bucketOrFolder)
            }
            disabled={!newTitle.trim()}
            style={{
              ...primaryButton,
              opacity: newTitle.trim() ? 1 : 0.35,
              cursor: newTitle.trim() ? "pointer" : "not-allowed",
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </motion.div>
  );

  const showGlobalEmpty = !backlogLoading && totalCount === 0;
  const showNoResults = !backlogLoading && totalCount > 0 && visibleCount === 0;

  return (
    <section className="planning-board">
      <div className="planning-toolbar">
        <div className="planning-toolbar__group planning-toolbar__group--nav">
          <button
            type="button"
            onClick={() => setBrainDumpActive((current) => !current)}
            className="planning-toolbar__button"
            style={
              brainDumpActive
                ? {
                    borderColor: COLOR_ACCENT,
                    color: COLOR_ACCENT,
                    background: "rgba(240, 235, 255, 0.55)",
                  }
                : undefined
            }
          >
            <NotebookPen size={15} strokeWidth={1.9} />
            Brain Dump
          </button>
        </div>

        <div
          className="planning-toolbar__group"
          style={{ flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}
        >
          <label style={toolbarInputWrap}>
            <Search size={14} strokeWidth={2} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Backlog durchsuchen…"
              style={toolbarInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: 0,
                  background: "transparent",
                  color: COLOR_MUTED,
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Suche zurücksetzen"
              >
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </label>

          <select
            value={filterChannel}
            onChange={(event) => setFilterChannel(event.target.value)}
            style={toolbarSelect}
          >
            <option value="">Alle Kanäle</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="backlog-page-scroll">
        <div style={innerStyle}>
          <header style={headerStyle}>
            <div>
              <h1 style={titleStyle}>Backlog</h1>
            </div>
            <div style={pillsRow}>
              <span style={pillStyle}>{formatTaskCount(totalCount)}</span>
              <span style={pillStyle}>{visibleCount} sichtbar</span>
              <span style={pillStyle}>{completedCount} erledigt</span>
            </div>
          </header>

          <AnimatePresence initial={false}>
            {brainDumpActive && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div style={brainDumpPanel}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <p
                      style={{
                        color: COLOR_SECONDARY,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Eine Aufgabe pro Zeile
                    </p>

                    <select
                      value={brainDumpBucket}
                      onChange={(event) =>
                        setBrainDumpBucket(event.target.value as BucketKey)
                      }
                      style={{ ...inlineFieldStyle, marginLeft: "auto" }}
                    >
                      {BUCKETS.map((bucket) => (
                        <option key={bucket.key} value={bucket.key}>
                          {bucket.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    ref={brainDumpRef}
                    value={brainDumpText}
                    onChange={(event) => setBrainDumpText(event.target.value)}
                    placeholder={"E-Mails beantworten\nPräsentation vorbereiten\nGitHub Issues aufräumen\n…"}
                    rows={6}
                    style={brainDumpTextarea}
                  />

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        color: COLOR_MUTED,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {brainDumpText.split("\n").filter((line) => line.trim()).length}{" "}
                      Einträge
                    </span>

                    <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setBrainDumpActive(false);
                          setBrainDumpText("");
                        }}
                        style={subtleButton}
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        onClick={handleBrainDump}
                        disabled={
                          !brainDumpText
                            .split("\n")
                            .some((line) => line.trim().length > 0)
                        }
                        style={{
                          ...primaryButton,
                          opacity: brainDumpText.trim() ? 1 : 0.35,
                          cursor: brainDumpText.trim() ? "pointer" : "not-allowed",
                        }}
                      >
                        Alle hinzufügen
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {backlogLoading && backlogTasks.length === 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "96px 0",
                }}
              >
                <motion.div
                  style={{
                    height: 20,
                    width: 20,
                    borderRadius: 999,
                    border: `2px solid ${COLOR_ACCENT}`,
                    borderTopColor: "transparent",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 0.7,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </div>
            )}

            {showGlobalEmpty && (
              <div
                style={{
                  padding: "72px 0",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: COLOR_PRIMARY,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                  }}
                >
                  Dein Backlog ist leer
                </p>
                <p
                  style={{
                    marginTop: 6,
                    color: COLOR_SECONDARY,
                    fontSize: 13,
                  }}
                >
                  Nutze Brain Dump oder füge im passenden Bereich eine Aufgabe hinzu.
                </p>
              </div>
            )}

            {showNoResults && (
              <div
                style={{
                  padding: "56px 0",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: COLOR_PRIMARY,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  Keine Treffer
                </p>
                <p
                  style={{
                    marginTop: 6,
                    color: COLOR_SECONDARY,
                    fontSize: 13,
                  }}
                >
                  Passe Suche oder Kanalfilter an.
                </p>
              </div>
            )}

            {!showGlobalEmpty && !showNoResults && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {BUCKETS.map((bucket) => {
                  const tasks = tasksByBucket[bucket.key] || [];

                  return (
                    <Section
                      key={bucket.key}
                      title={bucket.label}
                      count={tasks.length}
                      collapsed={collapsedBuckets.has(bucket.key)}
                      onToggle={() => toggleBucket(bucket.key)}
                    >
                      <SortableContext
                        items={tasks.map((task) => task.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <AnimatePresence mode="popLayout">
                          {tasks.map((task, index) => (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -12 }}
                              transition={{
                                duration: 0.22,
                                delay: index * 0.02,
                                ease: [0.4, 0, 0.2, 1],
                              }}
                            >
                              <BacklogTaskCard task={task} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </SortableContext>

                      {tasks.length === 0 && !searchQuery && (
                        <p style={emptyCopy}>Noch keine Aufgaben.</p>
                      )}

                      <AnimatePresence mode="wait">
                        {backlogQuickAddTarget === bucket.key ? (
                          renderAddForm(bucket.key)
                        ) : (
                          <motion.button
                            key={`add-${bucket.key}`}
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                              requestBacklogQuickAdd(bucket.key);
                              setNewTitle("");
                            }}
                            style={addButtonStyle}
                          >
                            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                            Aufgabe hinzufügen
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </Section>
                  );
                })}

                <section style={folderShellStyle}>
                  <div style={folderShellHeader}>
                    <h3 style={folderShellTitle}>Ordner</h3>
                    <span style={sectionCount}>
                      {visibleFolders.length} sichtbar
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {visibleFolders.length > 0 ? (
                      visibleFolders.map((folder) => {
                        const folderTasks = tasksByFolder[folder] || [];

                        return (
                          <Section
                            key={folder}
                            title={folder}
                            count={folderTasks.length}
                            collapsed={collapsedFolders.has(folder)}
                            onToggle={() => toggleFolder(folder)}
                          >
                            <SortableContext
                              items={folderTasks.map((task) => task.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <AnimatePresence mode="popLayout">
                                {folderTasks.map((task, index) => (
                                  <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -12 }}
                                    transition={{
                                      duration: 0.22,
                                      delay: index * 0.02,
                                      ease: [0.4, 0, 0.2, 1],
                                    }}
                                  >
                                    <BacklogTaskCard task={task} />
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </SortableContext>

                            {folderTasks.length === 0 && (
                              <p style={emptyCopy}>Noch keine Aufgaben.</p>
                            )}

                            <AnimatePresence mode="wait">
                              {backlogQuickAddTarget === `folder:${folder}` ? (
                                renderAddForm(folder, true)
                              ) : (
                                <motion.button
                                  key={`add-folder-${folder}`}
                                  type="button"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  onClick={() => {
                                    requestBacklogQuickAdd(`folder:${folder}`);
                                    setNewTitle("");
                                  }}
                                  style={addButtonStyle}
                                >
                                  <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                                  Aufgabe hinzufügen
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </Section>
                        );
                      })
                    ) : (
                      <p style={emptyCopy}>Noch keine Ordner angelegt.</p>
                    )}

                    <AnimatePresence mode="wait">
                      {showNewFolder ? (
                        <motion.div
                          key="new-folder-form"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          style={inlineFormStyle}
                        >
                          <div style={inlineRow}>
                            <input
                              ref={folderInputRef}
                              type="text"
                              value={newFolderName}
                              onChange={(event) => setNewFolderName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") handleCreateFolder();
                                if (event.key === "Escape") {
                                  setShowNewFolder(false);
                                  setNewFolderName("");
                                }
                              }}
                              placeholder="Ordnername…"
                              style={{ ...inlineInputStyle, flex: 1, minWidth: 200 }}
                            />

                            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNewFolder(false);
                                  setNewFolderName("");
                                }}
                                style={subtleButton}
                              >
                                Abbrechen
                              </button>
                              <button
                                type="button"
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim()}
                                style={{
                                  ...primaryButton,
                                  opacity: newFolderName.trim() ? 1 : 0.35,
                                  cursor: newFolderName.trim() ? "pointer" : "not-allowed",
                                }}
                              >
                                Erstellen
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="new-folder-button"
                          type="button"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowNewFolder(true)}
                          style={addButtonStyle}
                        >
                          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                          Neuer Ordner
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
