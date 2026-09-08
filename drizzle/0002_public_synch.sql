ALTER TABLE "gym_config" ADD COLUMN "rest_override_seconds" smallint;--> statement-breakpoint
ALTER TABLE "gym_config" ADD COLUMN "rest_ping" boolean DEFAULT true NOT NULL;