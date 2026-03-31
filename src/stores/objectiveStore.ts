"use client";

import { create } from "zustand";
import type { Objective } from "@/types";
import { extractDateOnly } from "@/lib/date";

interface ObjectiveState {
  objectives: Objective[];
  loading: boolean;

  fetchObjectives: (weekStart: string) => Promise<void>;
  addObjective: (data: { title: string; weekStart: string }) => Promise<void>;
  updateObjective: (id: string, updates: Partial<Pick<Objective, "title" | "progress">>) => Promise<void>;
  deleteObjective: (id: string) => Promise<void>;
}

function mapObjective(o: Record<string, unknown>): Objective {
  return {
    id: o.id as string,
    title: o.title as string,
    weekStart: extractDateOnly(o.weekStart as string) ?? "",
    progress: (o.progress as number) ?? 0,
  };
}

export const useObjectiveStore = create<ObjectiveState>((set) => ({
  objectives: [],
  loading: false,

  fetchObjectives: async (weekStart: string) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/objectives?weekStart=${weekStart}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const objectives = (data as Record<string, unknown>[]).map(mapObjective);
      set({ objectives, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addObjective: async (data) => {
    try {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("API error");
      const created = mapObjective(await res.json() as Record<string, unknown>);
      set((s) => ({ objectives: [...s.objectives, created] }));
    } catch {
      // Local-only fallback
      const local: Objective = {
        id: `local-${Date.now()}`,
        title: data.title,
        weekStart: data.weekStart,
        progress: 0,
      };
      set((s) => ({ objectives: [...s.objectives, local] }));
    }
  },

  updateObjective: async (id, updates) => {
    // Optimistic update
    set((s) => ({
      objectives: s.objectives.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    }));

    try {
      await fetch(`/api/objectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {
      // Optimistic update already applied
    }
  },

  deleteObjective: async (id) => {
    // Optimistic delete
    set((s) => ({ objectives: s.objectives.filter((o) => o.id !== id) }));

    try {
      await fetch(`/api/objectives/${id}`, { method: "DELETE" });
    } catch {
      // Already removed locally
    }
  },
}));
