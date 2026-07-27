CREATE TYPE "public"."order_origin" AS ENUM('whatsapp_ai', 'manual_sales');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'pending_review', 'confirmed', 'on_hold', 'processing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dealers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"business_name" text NOT NULL,
	"contact_person" text,
	"phone" text NOT NULL,
	"address" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dealers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "order_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"previous_status" "order_status",
	"new_status" "order_status" NOT NULL,
	"changed_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"product_id" integer,
	"sku" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"line_total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_number" text NOT NULL,
	"dealer_id" integer NOT NULL,
	"conversation_id" integer,
	"status" "order_status" DEFAULT 'pending_review' NOT NULL,
	"origin" "order_origin" DEFAULT 'whatsapp_ai' NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"proposed_message" text,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sku" text NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"model" text,
	"specifications" text,
	"unit_price" integer NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_messages_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;