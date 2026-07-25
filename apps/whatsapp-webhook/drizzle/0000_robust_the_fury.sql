CREATE TYPE "public"."message_kind" AS ENUM('text', 'audio');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('received', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reply_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"message_id" integer NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"request_messages" jsonb NOT NULL,
	"response_text" text,
	"error" text,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"message_id" text NOT NULL,
	"from_phone" text NOT NULL,
	"contact_name" text,
	"kind" "message_kind" NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"inbound_text" text,
	"transcript" text,
	"resolved_text" text,
	"status" "message_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "outbound_replies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbound_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"message_id" integer NOT NULL,
	"to_phone" text NOT NULL,
	"reply_text" text NOT NULL,
	"status" "reply_status" NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_replies" ADD CONSTRAINT "outbound_replies_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;