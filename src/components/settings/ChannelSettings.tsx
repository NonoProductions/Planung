"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import type { Channel } from "@/types";

const DEFAULT_COLOR = "#4F46E5";

/** Channels (the #tags on tasks): add, rename, recolor, delete. */
export default function ChannelSettings() {
  const channels = useTaskStore((state) => state.channels);
  const fetchChannels = useTaskStore((state) => state.fetchChannels);
  const addChannel = useTaskStore((state) => state.addChannel);
  const apiAvailable = useTaskStore((state) => state.apiAvailable);

  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setName("");
    setColor(DEFAULT_COLOR);
    await addChannel({ name: trimmed, color });
  }

  return (
    <div className="settings-block">
      {channels.length > 0 ? (
        <div className="settings-category-list">
          {channels.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} />
          ))}
        </div>
      ) : (
        <p className="settings-row__description">Noch keine Channels.</p>
      )}

      <form onSubmit={handleAdd} className="settings-category-form">
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="settings-color"
          aria-label="Farbe"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Uni, Sport, Projekt..."
          className="workspace-input min-w-0 flex-1"
          aria-label="Name des neuen Channels"
        />
        <button
          type="submit"
          className="workspace-button workspace-button--primary"
          disabled={!name.trim()}
        >
          <Plus size={14} strokeWidth={2.2} />
          Anlegen
        </button>
      </form>

      {!apiAvailable && (
        <p className="settings-row__description">
          Die Datenbank ist gerade nicht verfügbar. Änderungen gelten nur bis zum Neuladen.
        </p>
      )}
    </div>
  );
}

function ChannelRow({ channel }: { channel: Channel }) {
  const updateChannel = useTaskStore((state) => state.updateChannel);
  const deleteChannel = useTaskStore((state) => state.deleteChannel);
  // Only set while the name is being typed; otherwise the stored name shows.
  const [draft, setDraft] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  // The confirmation on the button gives up after a few seconds.
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const commitName = () => {
    const trimmed = draft?.trim();
    setDraft(null);
    if (trimmed && trimmed !== channel.name) void updateChannel(channel.id, { name: trimmed });
  };

  return (
    <div className="settings-category">
      <input
        type="color"
        value={channel.color}
        onChange={(event) => void updateChannel(channel.id, { color: event.target.value })}
        className="settings-color"
        aria-label={`Farbe für ${channel.name}`}
      />
      <span className="settings-channel__hash" style={{ color: channel.color }} aria-hidden="true">
        #
      </span>
      <input
        value={draft ?? channel.name}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(null);
            requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
          }
        }}
        className="settings-category__name"
        aria-label="Name des Channels"
      />
      <button
        type="button"
        onClick={() => {
          if (armed) {
            void deleteChannel(channel.id);
          } else {
            setArmed(true);
          }
        }}
        onBlur={() => setArmed(false)}
        className={`planning-toolbar__button settings-channel__delete${armed ? " is-armed" : ""}`}
        aria-label={armed ? `${channel.name} wirklich löschen` : `${channel.name} löschen`}
        title="Die Tasks bleiben, nur ohne Channel."
      >
        <Trash2 size={14} strokeWidth={2} />
        {armed && <span>Löschen</span>}
      </button>
    </div>
  );
}
