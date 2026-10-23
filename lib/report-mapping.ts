interface AttachmentRow { file_name:string; attachment_type?:string|null; created_at:string; removed_at?:string|null }
interface TaskRow { assigned_to?:string|null; status:string; completed_by?:string|null; completed_at?:string|null; completion_note?:string|null; due_at?:string|null; assigned_at?:string|null; started_at?:string|null }
export interface ReportRow {
 id:string; revision:number; location_id?:string|null; report_no:string; reporter_id:string; reported_at:string;
 plant_id?:string|null; category:string; urgency:string; description:string; status:string; completed_at?:string|null;
 is_starred?:boolean; starred_by?:string|null; starred_at?:string|null;
 locations?:{name:string}|null; plants?:{name:string;code:string}|null;
 eso_attachments?:AttachmentRow[]|null; maintenance_tasks?:TaskRow[]|TaskRow|null;
 corrective_actions?:Array<{action_text:string;created_at:string}>|null;
 eso_report_stars?:Array<{starred_by:string;created_at:string}>|null;
}

export function mapReports(
  reports: ReportRow[],
  users: Array<{ id: string; name: string; role: string }>,
  actorId: string,
  now = Date.now(),
) {
  const userById = new Map(users.map((u) => [u.id, u]));
  const me = { id: actorId };
  return (reports || []).map((r) => {
    const attachments = (r.eso_attachments || [])
        .filter((a) => !a.removed_at)
        .slice()
        .sort((a, b) =>
          String(a.created_at).localeCompare(String(b.created_at)),
        ),
      reportAttachment =
        attachments.find((a) => a.attachment_type === "report") ||
        attachments.find((a) => !a.attachment_type),
      completionAttachment = [...attachments]
        .reverse()
        .find((a) => a.attachment_type === "completion");
    const ca = (r.corrective_actions || [])
        .slice()
        .sort((a, b) =>
          String(a.created_at).localeCompare(String(b.created_at)),
        )
        .at(-1),
      task = Array.isArray(r.maintenance_tasks)
        ? r.maintenance_tasks[0]
        : r.maintenance_tasks;
    const stars = [...(r.eso_report_stars || [])].sort((a,b)=>b.created_at.localeCompare(a.created_at)||a.starred_by.localeCompare(b.starred_by)),
      starCount = stars.length || (r.is_starred ? 1 : 0),
      lastStar = stars[0],
      starredByNames = stars
        .map((s) => (userById.get(s.starred_by))?.name)
        .filter(Boolean);
    const starredByMe =
      stars.some((s) => s.starred_by === me.id) ||
      (stars.length === 0 && Boolean(r.is_starred && r.starred_by === me.id));
    const dueTime = task?.due_at ? Date.parse(task.due_at) : NaN;
    const overdue = r.status !== "completed" && r.status !== "closed" && task?.status !== "completed" && dueTime < now;
    return {
      id: r.id,
      revision: r.revision,
      locationId: r.location_id,
      esoNo: r.report_no,
      reporterId: r.reporter_id,
      createdAt: r.reported_at,
      location: r.locations?.name || "Unknown",
      plantId: r.plant_id,
      plantName: r.plants?.name || "",
      category: r.category === "environmental" ? "Environmental" : "Safety",
      urgency: r.urgency[0].toUpperCase() + r.urgency.slice(1),
      description: r.description,
      imageName: reportAttachment?.file_name,
      completionImageName: completionAttachment?.file_name,
      status:
        r.status === "completed" || r.status === "closed"
          ? "Completed"
          : r.status === "in_progress" ||
              r.status === "assigned" ||
              r.status === "waiting"
            ? "In Progress"
            : "Open",
      assignedTo: task?.assigned_to || undefined,
      assignedToName: task?.assigned_to
        ? (userById.get(task.assigned_to))?.name
        : undefined,
      assignedToRole: task?.assigned_to
        ? (userById.get(task.assigned_to))?.role
        : undefined,
      resolvedBy:
        task?.completed_by ||
        (task?.status === "completed" ? task?.assigned_to : undefined),
      resolvedByName:
        task?.completed_by ||
        (task?.status === "completed" ? task?.assigned_to : null)
          ? (userById.get(task?.completed_by || task?.assigned_to || ""))?.name
          : undefined,
      resolvedByRole:
        task?.completed_by ||
        (task?.status === "completed" ? task?.assigned_to : null)
          ? (userById.get(task?.completed_by || task?.assigned_to || ""))?.role
          : undefined,
      taskStatus: task?.status || undefined,
      dueAt: task?.due_at || undefined,
      assignedAt: task?.assigned_at || undefined,
      startedAt: task?.started_at || undefined,
      overdue,
      overdueDays: overdue ? Math.max(1, Math.ceil((now-dueTime)/86400000)) : 0,
      correctiveAction: task?.completion_note || ca?.action_text || undefined,
      completedAt: r.completed_at || task?.completed_at,
      isStarred: starCount > 0,
      starCount,
      starredByMe,
      starredBy: lastStar?.starred_by || r.starred_by || undefined,
      starredByNames,
      starredByName:
        (lastStar?.starred_by
          ? (userById.get(lastStar.starred_by))?.name
          : null) ||
        (r.starred_by ? (userById.get(r.starred_by))?.name : undefined),
      starredAt: lastStar?.created_at || r.starred_at || undefined,
    };
  });
}
