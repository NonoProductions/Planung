"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import BacklogTaskCard from "@/components/backlog/BacklogTaskCard";

type BucketKey = "this_week" | "next_weeks" | "someday";

type SectionConfig = {
  key: BucketKey;
  label: string;
  description: string;
};

const BUCKETS: SectionConfig[] = [
  {
    key: "this_week",
    label: "Diese Woche",
    description: "Fokus fuer die naechsten Tage.",
  },
  {
    key: "next_weeks",
    label: "Naechste Wochen",
    description: "Wichtige Themen ohne Tagesdruck.",
  },
  {
    key: "someday",
    label: "Irgendwann",
    description: "Ideen, Parkthemen und spaetere Optionen.",
  },
];

function formatTaskCount(count: number) {
  return `${count} ${count === 1 ? "Aufgabe" : "Aufgaben"}`;
}

function Section({
  title,
  description,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="backlog-section">
      <button
        type="button"
        onClick={onToggle}
        className="backlog-section__header"
      >
        <div className="min-w-0 flex-1">
          <div className="backlog-section__title-row">
            <h3 className="backlog-section__title">{title}</h3>
            <span className="backlog-section__count">
              {formatTaskCount(count)}
            </span>
          </div>
          <p className="backlog-section__description">{description}</p>
        </div>
        <motion.span
          animate={{ opacity: collapsed ? 0.72 : 1 }}
          transition={{ duration: 0.16 }}
          className="backlog-section__toggle"
        >
          {collapsed ? "Anzeigen" : "Einklappen"}
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="backlog-section__content">{children}</div>
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
      className="backlog-inline-form"
    >
      <input
        ref={addInputRef}
        type="text"
        value={newTitle}
        onChange={(event) => setNewTitle(event.target.value)}
        onKeyDown={(event) => handleAddKeyDown(event, bucketOrFolder, isFolder)}
        placeholder="Neue Aufgabe..."
        className="w-full border-b bg-transparent pb-3 text-[14px] font-medium outline-none"
        style={{
          color: "var(--text-primary)",
          borderColor: "var(--border-subtle)",
        }}
      />

      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
        <select
          value={newChannelId}
          onChange={(event) => setNewChannelId(event.target.value)}
          className="rounded-lg border px-3 py-2 text-[11px] font-semibold outline-none"
          style={{
            backgroundColor: "var(--bg-input)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
          }}
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
          className="rounded-lg border px-3 py-2 text-[11px] font-semibold outline-none md:w-[88px]"
          style={{
            backgroundColor: "var(--bg-input)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
          }}
        />

        <div className="flex gap-2 md:ml-auto">
          <button
            type="button"
            onClick={resetInlineForm}
            className="rounded-lg px-3 py-2 text-[11px] font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() =>
              isFolder ? handleAddInFolder(bucketOrFolder) : handleAddTask(bucketOrFolder)
            }
            disabled={!newTitle.trim()}
            className="rounded-lg px-3 py-2 text-[11px] font-bold text-white disabled:opacity-30"
            style={{ backgroundColor: "var(--accent-primary)" }}
          >
            Hinzufuegen
          </button>
        </div>
      </div>
    </motion.div>
  );

  const showGlobalEmpty = !backlogLoading && totalCount === 0;
  const showNoResults = !backlogLoading && totalCount > 0 && visibleCount === 0;

  return (
    <section className="planning-board">
      <div className="backlog-page-scroll">
        <div className="backlog-page">
          <header className="backlog-header">
            <div className="backlog-header__top">
              <div className="max-w-[680px]">
                <div>
                  <h1 className="backlog-header__title">Backlog</h1>
                  <p className="backlog-header__description">
                    Sammle Aufgaben fuer spaeter und sortiere sie mit mehr Luft
                    und einer ruhigeren Struktur, passend zur Home-Seite.
                  </p>
                  <div className="backlog-header__stats">
                    <span className="backlog-stat">{formatTaskCount(totalCount)}</span>
                    <span className="backlog-stat">{visibleCount} sichtbar</span>
                    <span className="backlog-stat">{completedCount} erledigt</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBrainDumpActive((current) => !current)}
                className="backlog-braindump-toggle"
                style={{
                  borderColor: brainDumpActive
                    ? "var(--accent-primary)"
                    : "var(--border-color)",
                  color: brainDumpActive
                    ? "var(--accent-primary)"
                    : "var(--text-secondary)",
                  backgroundColor: brainDumpActive
                    ? "rgba(240, 235, 255, 0.75)"
                    : "rgba(255, 255, 255, 0.86)",
                }}
              >
                Brain Dump
              </button>
            </div>

            <div className="backlog-controls">
              <div className="backlog-control backlog-control--search">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Backlog durchsuchen..."
                  className="flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-[var(--text-muted)]"
                  style={{ color: "var(--text-primary)" }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-[12px] font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Reset
                  </button>
                )}
              </div>

              <select
                value={filterChannel}
                onChange={(event) => setFilterChannel(event.target.value)}
                className="backlog-control backlog-control--select text-[13px] font-semibold outline-none"
                style={{ color: "var(--text-secondary)" }}
              >
                <option value="">Alle Kanaele</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <AnimatePresence initial={false}>
            {brainDumpActive && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="backlog-braindump-panel">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Brain Dump - eine Aufgabe pro Zeile
                    </p>

                    <select
                      value={brainDumpBucket}
                      onChange={(event) =>
                        setBrainDumpBucket(event.target.value as BucketKey)
                      }
                      className="backlog-braindump-select text-[12px] font-semibold outline-none md:ml-auto"
                      style={{ color: "var(--text-secondary)" }}
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
                    placeholder={"E-Mails beantworten\nPraesentation vorbereiten\nGitHub Issues aufraeumen\n..."}
                    rows={6}
                    className="backlog-braindump-textarea"
                    style={{ color: "var(--text-primary)" }}
                  />

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {brainDumpText.split("\n").filter((line) => line.trim()).length}{" "}
                      Eintraege
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBrainDumpActive(false);
                          setBrainDumpText("");
                        }}
                        className="rounded-lg px-3 py-2 text-[12px] font-semibold"
                        style={{ color: "var(--text-secondary)" }}
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
                        className="rounded-lg px-3 py-2 text-[12px] font-bold text-white disabled:opacity-30"
                        style={{ backgroundColor: "var(--accent-primary)" }}
                      >
                        Alle hinzufuegen
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <div className="backlog-content">
            {backlogLoading && backlogTasks.length === 0 && (
              <div className="flex items-center justify-center py-24">
                <motion.div
                  className="h-5 w-5 rounded-full border-2 border-t-transparent"
                  style={{
                    borderColor: "var(--accent-primary)",
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
              <div className="backlog-empty-state py-[72px] text-center">
                <p
                  className="text-[18px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Dein Backlog ist leer
                </p>
                <p
                  className="mt-2 text-[14px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Nutze Brain Dump oder fuege direkt im passenden Bereich eine
                  Aufgabe hinzu.
                </p>
              </div>
            )}

            {showNoResults && (
              <div className="backlog-empty-state py-[56px] text-center">
                <p
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Keine Treffer fuer die aktuelle Ansicht
                </p>
                <p
                  className="mt-2 text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Passe Suche oder Kanalfilter an.
                </p>
              </div>
            )}

            {!showGlobalEmpty && !showNoResults && (
              <div className="space-y-6">
                {BUCKETS.map((bucket) => {
                  const tasks = tasksByBucket[bucket.key] || [];

                  return (
                    <Section
                      key={bucket.key}
                      title={bucket.label}
                      description={bucket.description}
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
                        <p className="backlog-empty-copy">
                          Noch keine Aufgaben in diesem Bereich.
                        </p>
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
                            className="backlog-add-button"
                          >
                            Aufgabe hinzufuegen
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </Section>
                  );
                })}

                <section className="backlog-folder-shell">
                  <div className="backlog-folder-shell__header">
                    <div>
                      <h3 className="backlog-folder-shell__title">Ordner</h3>
                      <p className="backlog-folder-shell__description">
                        Themen oder Projekte getrennt sammeln.
                      </p>
                    </div>

                    <span className="backlog-section__count">
                      {visibleFolders.length} sichtbar
                    </span>
                  </div>

                  <div className="mt-6 space-y-6">
                    {visibleFolders.length > 0 ? (
                      visibleFolders.map((folder) => {
                        const folderTasks = tasksByFolder[folder] || [];

                        return (
                          <Section
                            key={folder}
                            title={folder}
                            description="Gemeinsamer Kontext fuer zusammengehoerige Aufgaben."
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
                              <p className="backlog-empty-copy">
                                Noch keine Aufgaben in diesem Ordner.
                              </p>
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
                                  className="backlog-add-button"
                                >
                                  Aufgabe hinzufuegen
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </Section>
                        );
                      })
                    ) : (
                      <p className="backlog-empty-copy">
                        Noch keine Ordner angelegt.
                      </p>
                    )}

                    <AnimatePresence mode="wait">
                      {showNewFolder ? (
                        <motion.div
                          key="new-folder-form"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="backlog-inline-form"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
                              placeholder="Ordnername..."
                              className="flex-1 border-b bg-transparent pb-2 text-[13px] font-medium outline-none"
                              style={{
                                color: "var(--text-primary)",
                                borderColor: "var(--border-color)",
                              }}
                            />

                            <div className="flex gap-2 md:ml-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNewFolder(false);
                                  setNewFolderName("");
                                }}
                                className="rounded-lg px-3 py-2 text-[12px] font-semibold"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                Abbrechen
                              </button>
                              <button
                                type="button"
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim()}
                                className="rounded-lg px-3 py-2 text-[12px] font-bold text-white disabled:opacity-30"
                                style={{ backgroundColor: "var(--accent-primary)" }}
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
                          className="backlog-add-button"
                        >
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
