import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

/* ─── Enums as string unions (SQLite) ─── */

export const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "tasks.create",
  "tasks.assign",
  "staff.manage",
  "reports.view_all",
  "reports.view_department",
  "reports.export",
  "announcements.manage",
  "chat.create_group",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ANNOUNCEMENT_AUDIENCES = ["ALL", "DEPARTMENT", "USERS"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const PRIORITIES = ["DO", "SCHEDULE", "DELEGATE", "ELIMINATE"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const RECURRENCE_TYPES = [
  "ONCE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "CUSTOM",
] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export const ASSIGNEE_TYPES = ["USER", "DEPARTMENT"] as const;
export type AssigneeType = (typeof ASSIGNEE_TYPES)[number];

export const COMPLETION_MODES = ["INDIVIDUAL", "SHARED"] as const;
export type CompletionMode = (typeof COMPLETION_MODES)[number];

export const OCCURRENCE_STATUSES = [
  "PENDING",
  "DONE",
  "DONE_LATE",
  "NOT_DONE",
  "MISSED",
  "EXCUSED",
  "DONE_BY_PEER",
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/* ─── Helpers ─── */

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

/* ─── Tables ─── */

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  managerId: integer("manager_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<Role>().notNull().default("STAFF"),
    fullName: text("full_name").notNull(),
    /** نام نرمال‌شده برای جستجوی فارسی */
    fullNameNormalized: text("full_name_normalized").notNull().default(""),
    nationalCode: text("national_code"),
    phone: text("phone"),
    email: text("email"),
    position: text("position"),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    /** تاریخ پیوستن به دپارتمان فعلی (میلادی YYYY-MM-DD) */
    departmentJoinedAt: text("department_joined_at"),
    avatarPath: text("avatar_path"),
    hireDate: text("hire_date"), // Gregorian YYYY-MM-DD
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    /** soft delete — تاریخچه گزارش‌ها حفظ می‌شود */
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    /** با ریست رمز یا غیرفعال‌سازی افزایش می‌یابد تا JWTهای قبلی باطل شوند */
    sessionVersion: integer("session_version").notNull().default(1),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    /** تا این زمان دیالوگ آماده‌سازی دسترسی‌ها نشان داده نشود */
    permissionsSnoozeUntil: integer("permissions_snooze_until", {
      mode: "timestamp_ms",
    }),
    /** فعال‌سازی همه با getUserMedia موفق بوده؛ دیالوگ خودکار دیگر نیاید */
    permissionsSetupCompleted: integer("permissions_setup_completed", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    /** ساعات سکوت اعلان به وقت تهران، HH:mm. پیش‌فرض ۲۲:۰۰ تا ۰۷:۰۰ */
    quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
    quietHoursEnd: text("quiet_hours_end").notNull().default("07:00"),
    /** آخرین باری که از جلوی چشم خارج شد یا اتصال قطع‌شده آفلاین اعلام شد */
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("users_department_id_idx").on(t.departmentId),
    index("users_role_idx").on(t.role),
    index("users_full_name_normalized_idx").on(t.fullNameNormalized),
    index("users_deleted_at_idx").on(t.deletedAt),
  ],
);

export const userDepartments = sqliteTable(
  "user_departments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    joinedAt: text("joined_at").notNull(),
    /** خروج از دپارتمان. تهی یعنی عضویت باز است. */
    leftAt: text("left_at"),
  },
  (t) => [
    index("user_departments_department_idx").on(t.departmentId),
    index("user_departments_user_idx").on(t.userId),
    uniqueIndex("user_departments_open_unique")
      .on(t.userId, t.departmentId)
      .where(sql`${t.leftAt} is null`),
  ],
);

export const userPermissions = sqliteTable(
  "user_permissions",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").$type<Permission>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permission] })],
);

export const staffNotes = sqliteTable(
  "staff_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("staff_notes_user_id_idx").on(t.userId)],
);

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience")
    .$type<AnnouncementAudience>()
    .notNull()
    .default("ALL"),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const announcementTargets = sqliteTable(
  "announcement_targets",
  {
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })],
);

export const announcementReads = sqliteTable(
  "announcement_reads",
  {
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: integer("read_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })],
);

export const taskCategories = sqliteTable("task_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
});

export const taskTemplates = sqliteTable(
  "task_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    description: text("description"),
    categoryId: integer("category_id").references(() => taskCategories.id, {
      onDelete: "set null",
    }),
    priority: text("priority").$type<Priority>().notNull().default("SCHEDULE"),
    requiresNote: integer("requires_note", { mode: "boolean" })
      .notNull()
      .default(false),
    requiresAttachment: integer("requires_attachment", { mode: "boolean" })
      .notNull()
      .default(false),
    recurrenceType: text("recurrence_type")
      .$type<RecurrenceType>()
      .notNull()
      .default("DAILY"),
    recurrenceConfig: text("recurrence_config", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    startDate: text("start_date").notNull(), // Gregorian YYYY-MM-DD
    endDate: text("end_date"),
    /** HH:mm تهران. خالی یعنی از ابتدای روز دیده شود. */
    startTime: text("start_time"),
    dueTime: text("due_time"), // HH:mm
    skipHolidays: integer("skip_holidays", { mode: "boolean" })
      .notNull()
      .default(true),
    /** INDIVIDUAL: هر عضو جدا. SHARED: انجام یک نفر برای دوره کافی است. */
    completionMode: text("completion_mode")
      .$type<CompletionMode>()
      .notNull()
      .default("INDIVIDUAL"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("task_templates_category_id_idx").on(t.categoryId),
    index("task_templates_is_active_idx").on(t.isActive),
  ],
);

export const taskAssignments = sqliteTable(
  "task_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    templateId: integer("template_id")
      .notNull()
      .references(() => taskTemplates.id, { onDelete: "cascade" }),
    assigneeType: text("assignee_type").$type<AssigneeType>().notNull(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }),
    ...timestamps,
  },
  (t) => [
    index("task_assignments_template_id_idx").on(t.templateId),
    index("task_assignments_user_id_idx").on(t.userId),
    index("task_assignments_department_id_idx").on(t.departmentId),
  ],
);

export const taskOccurrences = sqliteTable(
  "task_occurrences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    templateId: integer("template_id")
      .notNull()
      .references(() => taskTemplates.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    periodStart: text("period_start").notNull(), // Gregorian YYYY-MM-DD
    periodEnd: text("period_end").notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    status: text("status")
      .$type<OccurrenceStatus>()
      .notNull()
      .default("PENDING"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    note: text("note"),
    /** کد دلیل آماده‌ی «انجام نشد» برای گروه‌بندی گزارش */
    reasonCode: text("reason_code"),
    attachmentPath: text("attachment_path"),
    /**
     * برای کار گروهی دپارتمان: کسی که نتیجه را ثبت کرده.
     * روی ردیف بقیه اعضا هم همین شناسه می‌ماند تا کار برای آن‌ها بسته شود.
     */
    completedByUserId: integer("completed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** برای DONE_BY_PEER: occurrence کسی که کار SHARED را انجام داده. */
    doneByOccurrenceId: integer("done_by_occurrence_id").references(
      (): AnySQLiteColumn => taskOccurrences.id,
      { onDelete: "set null" },
    ),
    /** دپارتمانی که این ردیف از طرف آن ساخته شده. */
    sourceDepartmentId: integer("source_department_id")
      .notNull()
      .references(() => departments.id),
    /** زمان آخرین ویرایش پاسخ پس از ثبت اول */
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    reviewedBy: integer("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewStatus: text("review_status").$type<ReviewStatus>(),
    reviewNote: text("review_note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("task_occurrences_unique").on(
      t.templateId,
      t.userId,
      t.periodKey,
    ),
    index("task_occurrences_user_period_idx").on(t.userId, t.periodStart),
    index("task_occurrences_status_idx").on(t.status),
    index("task_occurrences_template_id_idx").on(t.templateId),
    index("task_occurrences_reason_code_idx").on(t.reasonCode),
    index("task_occurrences_period_end_idx").on(t.periodEnd),
    index("task_occurrences_user_period_end_idx").on(t.userId, t.periodEnd),
    index("task_occurrences_completed_by_idx").on(t.completedByUserId),
    index("task_occurrences_done_by_occ_idx").on(t.doneByOccurrenceId),
    index("task_occurrences_source_department_idx").on(t.sourceDepartmentId),
  ],
);

export const holidays = sqliteTable(
  "holidays",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull().unique(), // Gregorian YYYY-MM-DD
    title: text("title").notNull(),
    ...timestamps,
  },
  (t) => [index("holidays_date_idx").on(t.date)],
);

/** مرخصی / معافیت بازه‌ای — generate این روزها را EXCUSED می‌سازد */
export const staffLeaves = sqliteTable(
  "staff_leaves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    reason: text("reason").notNull(),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    index("staff_leaves_user_id_idx").on(t.userId),
    index("staff_leaves_range_idx").on(t.startDate, t.endDate),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index("audit_logs_actor_id_idx").on(t.actorId),
    index("audit_logs_entity_idx").on(t.entity, t.entityId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

/** دلایل آمادهٔ «انجام نشد» — اگر به دپارتمانی وصل نباشد برای همه است */
export const notDoneReasons = sqliteTable("not_done_reasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const notDoneReasonDepartments = sqliteTable(
  "not_done_reason_departments",
  {
    reasonId: integer("reason_id")
      .notNull()
      .references(() => notDoneReasons.id, { onDelete: "cascade" }),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.reasonId, t.departmentId] }),
    index("not_done_reason_departments_department_idx").on(t.departmentId),
  ],
);

export const CONVERSATION_TYPES = ["DIRECT", "GROUP"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const CONVERSATION_MEMBER_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type ConversationMemberRole =
  (typeof CONVERSATION_MEMBER_ROLES)[number];

export const MESSAGE_TYPES = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "VIDEO_NOTE",
  "VOICE",
  "SYSTEM",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const ATTACHMENT_STATUSES = [
  "UPLOADING",
  "PROCESSING",
  "READY",
  "FAILED",
] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

export const conversations = sqliteTable(
  "conversations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").$type<ConversationType>().notNull(),
    title: text("title"),
    avatarPath: text("avatar_path"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    /** زوج مستقیم، نرمال‌شده به صورت min:max */
    pairKey: text("pair_key"),
    lastMessageId: integer("last_message_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("conversations_pair_key_unique").on(t.pairKey),
    uniqueIndex("conversations_department_unique")
      .on(t.departmentId)
      .where(sql`${t.departmentId} is not null`),
  ],
);

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<ConversationMemberRole>().notNull(),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    leftAt: integer("left_at", { mode: "timestamp_ms" }),
    lastReadMessageId: integer("last_read_message_id"),
    lastDeliveredMessageId: integer("last_delivered_message_id"),
    mutedUntil: integer("muted_until", { mode: "timestamp_ms" }),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_members_user_id_idx").on(t.userId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id),
    type: text("type").$type<MessageType>().notNull(),
    body: text("body"),
    replyToId: integer("reply_to_id").references(
      (): AnySQLiteColumn => messages.id,
      { onDelete: "set null" },
    ),
    clientId: text("client_id").notNull(),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("messages_sender_client_unique").on(t.senderId, t.clientId),
    index("messages_conversation_id_id_idx").on(t.conversationId, t.id),
  ],
);

export const messageAttachments = sqliteTable(
  "message_attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    uploaderId: integer("uploader_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    path: text("path").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    waveform: text("waveform", { mode: "json" }).$type<number[]>(),
    thumbPath: text("thumb_path"),
    status: text("status").$type<AttachmentStatus>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("message_attachments_status_idx").on(t.status)],
);

export const MEDIA_JOB_STATUSES = ["PENDING", "PROCESSING", "DONE", "FAILED"] as const;
export type MediaJobStatus = (typeof MEDIA_JOB_STATUSES)[number];

export const mediaJobs = sqliteTable(
  "media_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attachmentId: integer("attachment_id")
      .notNull()
      .references(() => messageAttachments.id, { onDelete: "cascade" }),
    status: text("status").$type<MediaJobStatus>().notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("media_jobs_status_idx").on(t.status)],
);

export const NOTIFICATION_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_TYPES = [
  "chat.message",
  "chat.mention",
  "announcement.new",
  "task.assigned",
  "task.daily_digest",
  "task.due_soon",
  "task.overdue",
  "task.manager_summary",
  "system.data_check_failed",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["PUSH", "SMS", "IN_APP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DELIVERY_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    groupKey: text("group_key"),
    /** کلید یکتای اعلان کار: نوع + کاربر + occurrence یا تاریخ. تهی برای چت. */
    dedupeKey: text("dedupe_key"),
    /** تعداد پیام‌های جمع‌شده در یک اعلان چت */
    bundleCount: integer("bundle_count").notNull().default(1),
    priority: text("priority")
      .$type<NotificationPriority>()
      .notNull()
      .default("NORMAL"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_user_read_idx").on(t.userId, t.readAt),
    index("notifications_group_key_idx").on(t.groupKey),
    uniqueIndex("notifications_user_dedupe_uidx")
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: text("channel").$type<NotificationChannel>().notNull(),
    status: text("status").$type<DeliveryStatus>().notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("notification_deliveries_notification_idx").on(t.notificationId),
    index("notification_deliveries_push_queue_idx").on(t.channel, t.status, t.nextAttemptAt),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    deviceLabel: text("device_label"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
    failedCount: integer("failed_count").notNull().default(0),
    disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint),
    index("push_subscriptions_user_id_idx").on(t.userId),
  ],
);

export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    push: integer("push", { mode: "boolean" }).notNull().default(true),
    sms: integer("sms", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type] })],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/* ─── Types ─── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type TaskOccurrence = typeof taskOccurrences.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type StaffLeave = typeof staffLeaves.$inferSelect;
export type Setting = typeof settings.$inferSelect;
