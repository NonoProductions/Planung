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
import { FolderPlus, Plus, Search, Sparkles, X } from "lucide-react";
import BacklogTaskCard from "@/components/backlog/BacklogTaskCard";
import type { Task } from "@/types";
import { useDismissAddForm } from "@/hooks/useDismissAddForm";

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
    description: "Fokus für die nächsten Tage.",
  },
  {
    key: "next_weeks",
    label: "Nächste Wochen",
    description: "Wichtige Themen ohne Tagesdruck.",
  },
  {
    key: "someday",
    label: "Irgendwann",
    description: "Ideen, Parkthemen und spätere Optionen.",
  },
];

function formatTaskCount(count: number) {
  return `${count} ${count === 1 ? "Aufgabe" : "Aufgaben"}`;
}

function BacklogColumn({
  title,
  description,
  tasks,
  children,
}: {
  title: string;
  description: string;
  tasks: Task[];
  children: ReactNode;
}) {
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

  return (
    <section className="planning-column">
      <div className="planning-column__inner">
        <div className="planning-column__heading">
          <h2 className="planning-column__title backlog-column__title">{title}</h2>
          <p className="planning-column__date">{description}</p>

          <div className="planning-progress">
            <div
              className="planning-progress__fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          {children}
        </div>
      </div>
    </section>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, "0")}`;
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

  const resetInlineForm = () => {
    clearQuickAddRequest();
    setNewTitle("");
    setNewChannelId("");
    setNewPlannedTime("");
  };

  useDismissAddForm(Boolean(backlogQuickAddTarget), resetInlineForm);
  useDismissAddForm(showNewFolder, () => {
    setShowNewFolder(false);
    setNewFolderName("");
  });

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

  const isFiltering = Boolean(searchQuery || filterChannel);

  const renderAddForm = (bucketOrFolder: string, isFolder?: boolean) => (
    <div className="planning-add-form">
      <input
        ref={addInputRef}
        type="text"
        value={newTitle}
        onChange={(event) => setNewTitle(event.target.value)}
        onKeyDown={(event) => handleAddKeyDown(event, bucketOrFolder, isFolder)}
        placeholder="Neue Aufgabe..."
        className="planning-add-form__input"
        style={{
          borderColor: "var(--border-color)",
          color: "var(--text-primary)",
          backgroundColor: "var(--surface-subtle)",
        }}
      />
      <div className="planning-add-form__controls">
        <select
          value={newChannelId}
          onChange={(event) => setNewChannelId(event.target.value)}
          className="planning-add-form__select"
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
          placeholder="Min"
          className="planning-add-form__minutes"
        />
        <button
          type="button"
          onClick={() =>
            isFolder ? handleAddInFolder(bucketOrFolder) : handleAddTask(bucketOrFolder)
          }
          disabled={!newTitle.trim()}
          className="planning-add-form__save disabled:opacity-40"
          style={{ backgroundColor: "var(--accent-primary)" }}
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );

  const renderColumnBody = (
    tasks: Task[],
    target: string,
    isFolder?: boolean
  ) => {
    const plannedTotal = tasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0);

    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (backlogQuickAddTarget === target) {
              resetInlineForm();
              return;
            }
            requestBacklogQuickAdd(target);
            setNewTitle("");
          }}
          className="planning-quick-add"
        >
          <span className="planning-quick-add__label">
            <Plus size={16} strokeWidth={2} />
            Aufgabe
          </span>
          <span className="planning-card__duration">
            {plannedTotal > 0 ? formatMinutes(plannedTotal) : formatTaskCount(tasks.length)}
          </span>
        </button>

        {backlogQuickAddTarget === target && renderAddForm(target, isFolder)}

        <div className="planning-cards">
          <SortableContext
            items={tasks.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="planning-cards__stack">
              <AnimatePresence mode="popLayout">
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <BacklogTaskCard task={task} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {tasks.length === 0 && (
                <p className="backlog-empty-copy">
                  {backlogLoading
                    ? "Wird geladen..."
                    : isFiltering
                      ? "Keine Treffer."
                      : "Noch keine Aufgaben."}
                </p>
              )}
            </div>
          </SortableContext>
        </div>
      </>
    );
  };

  const brainDumpCount = brainDumpText.split("\n").filter((line) => line.trim()).length;

  return (
    <section className="planning-board">
      <div className="planning-toolbar backlog-toolbar">
        <div className="backlog-toolbar__title">
          <span className="settings-toolbar__title">Backlog</span>
          <span className="planning-card__duration">
            {isFiltering ? `${visibleCount} von ${totalCount}` : formatTaskCount(totalCount)}
          </span>
        </div>

        <div className="planning-toolbar__group backlog-toolbar__controls">
          <label className="backlog-search">
            <Search size={14} strokeWidth={2} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Backlog durchsuchen..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Suche zurücksetzen"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </label>

          <select
            value={filterChannel}
            onChange={(event) => setFilterChannel(event.target.value)}
            className="planning-toolbar__button backlog-toolbar__select"
            aria-label="Kanal filtern"
          >
            <option value="">Alle Kanäle</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setBrainDumpActive((current) => !current)}
            className="planning-toolbar__button backlog-toolbar__braindump"
            aria-pressed={brainDumpActive}
            aria-label="Brain Dump"
            title="Brain Dump"
            style={
              brainDumpActive
                ? {
                    borderColor: "var(--accent-primary)",
                    backgroundColor: "var(--accent-primary-light)",
                    color: "var(--accent-primary)",
                  }
                : undefined
            }
          >
            <Sparkles size={14} strokeWidth={2} />
            <span className="backlog-toolbar__braindump-label">Brain Dump</span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {brainDumpActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 overflow-hidden"
          >
            <div className="backlog-braindump">
              <div className="backlog-braindump__head">
                <p className="settings-row__label">Brain Dump</p>
                <p className="settings-row__description">Eine Aufgabe pro Zeile.</p>
                <select
                  value={brainDumpBucket}
                  onChange={(event) => setBrainDumpBucket(event.target.value as BucketKey)}
                  className="planning-add-form__select ml-auto"
                  aria-label="Ziel-Bereich"
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
                placeholder={"E-Mails beantworten\nPräsentation vorbereiten\nGitHub Issues aufräumen\n..."}
                rows={5}
                className="workspace-input workspace-input--textarea ritual-textarea"
              />

              <div className="ritual-actions">
                <button
                  type="button"
                  onClick={handleBrainDump}
                  disabled={brainDumpCount === 0}
                  className="workspace-button workspace-button--primary"
                >
                  {brainDumpCount > 0 ? `${brainDumpCount} hinzufügen` : "Hinzufügen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrainDumpActive(false);
                    setBrainDumpText("");
                  }}
                  className="workspace-button"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="planning-columns">
        <div className="backlog-columns">
          {BUCKETS.map((bucket) => {
            const tasks = tasksByBucket[bucket.key] || [];
            return (
              <BacklogColumn
                key={bucket.key}
                title={bucket.label}
                description={bucket.description}
                tasks={tasks}
              >
                {renderColumnBody(tasks, bucket.key)}
              </BacklogColumn>
            );
          })}

          {visibleFolders.map((folder) => {
            const tasks = tasksByFolder[folder] || [];
            return (
              <BacklogColumn
                key={`folder-${folder}`}
                title={folder}
                description="Ordner"
                tasks={tasks}
              >
                {renderColumnBody(tasks, `folder:${folder}`, true)}
              </BacklogColumn>
            );
          })}

          <section className="planning-column">
            <div className="planning-column__inner">
              <div className="planning-column__heading">
                <h2 className="planning-column__title">Ordner</h2>
                <p className="planning-column__date">
                  {folders.length > 0
                    ? `${folders.length} Ordner angelegt`
                    : "Themen getrennt sammeln"}
                </p>

                <div className="planning-progress" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => setShowNewFolder((current) => !current)}
                  className="planning-quick-add"
                >
                  <span className="planning-quick-add__label">
                    <FolderPlus size={16} strokeWidth={2} />
                    Neuer Ordner
                  </span>
                </button>

                {showNewFolder && (
                  <div className="planning-add-form">
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
                      className="planning-add-form__input"
                      style={{
                        borderColor: "var(--border-color)",
                        color: "var(--text-primary)",
                        backgroundColor: "var(--surface-subtle)",
                      }}
                    />
                    <div className="planning-add-form__controls">
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        disabled={!newFolderName.trim()}
                        className="planning-add-form__save disabled:opacity-40"
                        style={{ backgroundColor: "var(--accent-primary)" }}
                      >
                        Erstellen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
