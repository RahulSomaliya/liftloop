ALTER TABLE "exercise" ADD COLUMN "default_lo" smallint;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "default_hi" smallint;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "default_sets" smallint;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gym_config" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "template_exercise" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercise" ADD COLUMN "edited_at" timestamp with time zone;