CREATE TYPE "public"."load_type" AS ENUM('per_side', 'stack', 'dumbbell', 'bodyweight');--> statement-breakpoint
CREATE TYPE "public"."progression" AS ENUM('load_up', 'assist_down');--> statement-breakpoint
CREATE TYPE "public"."session_source" AS ENUM('logged', 'imported');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('normal', 'short', 'walk');--> statement-breakpoint
CREATE TYPE "public"."template_kind" AS ENUM('push', 'pull', 'legs');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('lb', 'kg');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('beat', 'matched', 'under', 'done');--> statement-breakpoint
CREATE TABLE "body_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"weight_kg" numeric(5, 1),
	"waist_cm" numeric(5, 1),
	"sleep_good" boolean,
	"protein_hit" boolean,
	"cardio_type" text,
	"cardio_min" smallint,
	"note" text,
	CONSTRAINT "body_metric_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"load_type" "load_type" NOT NULL,
	"unit" "unit" NOT NULL,
	"bar_weight" numeric(8, 2),
	"increment" numeric(8, 2),
	"progression" "progression" DEFAULT 'load_up' NOT NULL,
	"rest_seconds" smallint DEFAULT 90 NOT NULL,
	"unilateral" text,
	"muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"swap_ids" uuid[] DEFAULT '{}' NOT NULL,
	"cue" text,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "export_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_config" (
	"id" integer PRIMARY KEY NOT NULL,
	"plates_lb" jsonb NOT NULL,
	"dumbbell_rack_lb" jsonb NOT NULL,
	"stack_step_kg" numeric(8, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"start_date" date NOT NULL,
	"next_index" integer DEFAULT 0 NOT NULL,
	"easy_week_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"template_id" uuid,
	"type" "session_type" DEFAULT 'normal' NOT NULL,
	"source" "session_source" DEFAULT 'logged' NOT NULL,
	"duration_min" smallint,
	"sleep_good" boolean,
	"shoulder_pain" smallint,
	"elbow_pain" smallint,
	"advanced_loop" boolean DEFAULT true NOT NULL,
	"note" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"template_exercise_id" uuid,
	"order_index" smallint NOT NULL,
	"sets" smallint NOT NULL,
	"lo" smallint,
	"hi" smallint,
	"goal" jsonb,
	"verdict" "verdict",
	"next_note" text,
	"swapped_from_exercise_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"set_index" smallint NOT NULL,
	"rev" integer DEFAULT 1 NOT NULL,
	"load" numeric(8, 2),
	"reps" smallint,
	"to_failure" boolean DEFAULT false NOT NULL,
	"unit" "unit" NOT NULL,
	"is_pr" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "template_kind" NOT NULL,
	"order_index" smallint NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "template_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_index" smallint NOT NULL,
	"sets" smallint NOT NULL,
	"lo" smallint NOT NULL,
	"hi" smallint NOT NULL,
	"rest_seconds" smallint,
	"superset_group" smallint,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_template_exercise_id_template_exercise_id_fk" FOREIGN KEY ("template_exercise_id") REFERENCES "public"."template_exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_swapped_from_exercise_id_exercise_id_fk" FOREIGN KEY ("swapped_from_exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_program_id_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_exercise" ADD CONSTRAINT "template_exercise_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_exercise" ADD CONSTRAINT "template_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_metric_date_idx" ON "body_metric" USING btree ("date");--> statement-breakpoint
CREATE INDEX "login_attempt_at_idx" ON "login_attempt" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "session_date_idx" ON "session" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "session_exercise_order_uq" ON "session_exercise" USING btree ("session_id","order_index");--> statement-breakpoint
CREATE INDEX "session_exercise_exercise_idx" ON "session_exercise" USING btree ("exercise_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "set_log_slot_uq" ON "set_log" USING btree ("session_exercise_id","set_index");--> statement-breakpoint
CREATE INDEX "set_log_session_exercise_idx" ON "set_log" USING btree ("session_exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_program_order_uq" ON "template" USING btree ("program_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "template_exercise_order_uq" ON "template_exercise" USING btree ("template_id","order_index");