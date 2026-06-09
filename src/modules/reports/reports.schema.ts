import { z } from "zod";

export const PeriodSchema = z.enum(["day", "week", "month"]);

export const ReportsQuerySchema = z.object({
    userId: z.string().min(1).max(8),
    period: PeriodSchema.default("week"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
});

export const GlobalReportsQuerySchema = z.object({
    period: PeriodSchema.default("week"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
});

export const ReportsBucketSchema = z.object({
    period_label: z.string(),
    total: z.number().int(),
    attended: z.number().int(),
    missed: z.number().int(),
    pending: z.number().int(),
    canceled: z.number().int(),
    attendance_rate: z.number(),
});

export const ReservationBucketSchema = z.object({
    period_label: z.string(),
    total: z.number().int(),
    checked_in: z.number().int(),
    not_checked_in: z.number().int(),
    pending: z.number().int(),
    canceled: z.number().int(),
});

export const AttendanceSummarySchema = z.object({
    total: z.number().int(),
    attended: z.number().int(),
    missed: z.number().int(),
    pending: z.number().int(),
    canceled: z.number().int(),
    attendance_rate: z.number(),
    buckets: z.array(ReportsBucketSchema),
});

export const ReservationSummarySchema = z.object({
    total: z.number().int(),
    checked_in: z.number().int(),
    not_checked_in: z.number().int(),
    pending: z.number().int(),
    canceled: z.number().int(),
    buckets: z.array(ReservationBucketSchema),
});

export const TopUserSchema = z.object({
    user_id: z.string(),
    user_name: z.string(),
    total: z.number().int(),
    attended: z.number().int(),
    missed: z.number().int(),
    attendance_rate: z.number(),
});

export const GlobalAttendanceSummarySchema  = AttendanceSummarySchema;
export const GlobalReservationSummarySchema = ReservationSummarySchema;

export type Period = z.infer<typeof PeriodSchema>;
export type ReportsQuery = z.infer<typeof ReportsQuerySchema>;
export type GlobalReportsQuery = z.infer<typeof GlobalReportsQuerySchema>;
export type ReportsBucket = z.infer<typeof ReportsBucketSchema>;
export type ReservationBucket = z.infer<typeof ReservationBucketSchema>;
export type AttendanceSummary = z.infer<typeof AttendanceSummarySchema>;
export type ReservationSummary = z.infer<typeof ReservationSummarySchema>;
export type GlobalAttendanceSummary = z.infer<typeof GlobalAttendanceSummarySchema>;
export type GlobalReservationSummary = z.infer<typeof GlobalReservationSummarySchema>;
export type TopUser = z.infer<typeof TopUserSchema>;