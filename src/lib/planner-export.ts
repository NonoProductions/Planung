import type { PlannerExportData, PlannerSettings } from "@/types";

const CSV_COLUMNS = [
  "recordType",
  "id",
  "key",
  "title",
  "value",
  "status",
  "progress",
  "plannedTime",
  "actualTime",
  "scheduledDate",
  "startTime",
  "endTime",
  "color",
  "channelId",
  "calendarCategoryId",
  "parentId",
  "isRecurring",
  "isBacklog",
  "backlogBucket",
  "backlogFolder",
  "weekStart",
  "exportedAt",
] as const;

function escapeCsv(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function flattenSettings(
  value: PlannerSettings | Record<string, unknown> | string | number | boolean,
  prefix = ""
): Array<{ key: string; value: string }> {
  if (typeof value !== "object" || value === null) {
    return [{ key: prefix, value: String(value) }];
  }

  return Object.entries(value).flatMap(([entryKey, entryValue]) =>
    flattenSettings(
      entryValue as Record<string, unknown> | string | number | boolean,
      prefix ? `${prefix}.${entryKey}` : entryKey
    )
  );
}

export function buildPlannerExportCsv(data: PlannerExportData) {
  const rows: Array<Record<(typeof CSV_COLUMNS)[number], string | number | boolean | null>> = [
    ...flattenSettings(data.settings).map((entry) => ({
      recordType: "setting",
      id: entry.key,
      key: entry.key,
      title: "",
      value: entry.value,
      status: "",
      progress: "",
      plannedTime: "",
      actualTime: "",
      scheduledDate: "",
      startTime: "",
      endTime: "",
      color: "",
      channelId: "",
      calendarCategoryId: "",
      parentId: "",
      isRecurring: "",
      isBacklog: "",
      backlogBucket: "",
      backlogFolder: "",
      weekStart: "",
      exportedAt: data.exportedAt,
    })),
    ...data.tasks.map((task) => ({
      recordType: "task",
      id: task.id,
      key: "",
      title: task.title,
      value: task.description ?? "",
      status: task.status,
      progress: "",
      plannedTime: task.plannedTime ?? "",
      actualTime: task.actualTime ?? "",
      scheduledDate: task.scheduledDate ?? "",
      startTime: task.scheduledStart ?? "",
      endTime: task.scheduledEnd ?? "",
      color: task.channel?.color ?? "",
      channelId: task.channelId ?? "",
      calendarCategoryId: "",
      parentId: "",
      isRecurring: task.isRecurring,
      isBacklog: task.isBacklog,
      backlogBucket: task.backlogBucket ?? "",
      backlogFolder: task.backlogFolder ?? "",
      weekStart: "",
      exportedAt: data.exportedAt,
    })),
    ...data.objectives.map((objective) => ({
      recordType: "objective",
      id: objective.id,
      key: "",
      title: objective.title,
      value: "",
      status: "",
      progress: objective.progress,
      plannedTime: "",
      actualTime: "",
      scheduledDate: "",
      startTime: "",
      endTime: "",
      color: "",
      channelId: "",
      calendarCategoryId: "",
      parentId: "",
      isRecurring: "",
      isBacklog: "",
      backlogBucket: "",
      backlogFolder: "",
      weekStart: objective.weekStart,
      exportedAt: data.exportedAt,
    })),
    ...data.events.map((event) => ({
      recordType: "event",
      id: event.id,
      key: "",
      title: event.title,
      value: event.description ?? "",
      status: "",
      progress: "",
      plannedTime: "",
      actualTime: "",
      scheduledDate: "",
      startTime: event.startTime,
      endTime: event.endTime,
      color: event.color ?? "",
      channelId: "",
      calendarCategoryId: event.calendarCategoryId ?? "",
      parentId: "",
      isRecurring: event.isRecurring,
      isBacklog: "",
      backlogBucket: "",
      backlogFolder: "",
      weekStart: "",
      exportedAt: data.exportedAt,
    })),
    ...data.channels.map((channel) => ({
      recordType: "channel",
      id: channel.id,
      key: "",
      title: channel.name,
      value: "",
      status: "",
      progress: "",
      plannedTime: "",
      actualTime: "",
      scheduledDate: "",
      startTime: "",
      endTime: "",
      color: channel.color,
      channelId: channel.id,
      calendarCategoryId: "",
      parentId: "",
      isRecurring: "",
      isBacklog: "",
      backlogBucket: "",
      backlogFolder: "",
      weekStart: "",
      exportedAt: data.exportedAt,
    })),
    ...data.calendarCategories.map((category) => ({
      recordType: "calendarCategory",
      id: category.id,
      key: "",
      title: category.name,
      value: "",
      status: "",
      progress: "",
      plannedTime: "",
      actualTime: "",
      scheduledDate: "",
      startTime: "",
      endTime: "",
      color: category.color,
      channelId: "",
      calendarCategoryId: category.id,
      parentId: "",
      isRecurring: "",
      isBacklog: "",
      backlogBucket: "",
      backlogFolder: "",
      weekStart: "",
      exportedAt: data.exportedAt,
    })),
  ];

  const header = CSV_COLUMNS.join(",");
  const body = rows
    .map((row) => CSV_COLUMNS.map((column) => escapeCsv(row[column])).join(","))
    .join("\n");

  return `${header}\n${body}`;
}
