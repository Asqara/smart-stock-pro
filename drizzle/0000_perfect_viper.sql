CREATE TYPE "public"."merchant_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."merchant_type" AS ENUM('restaurant', 'photobooth');--> statement-breakpoint
CREATE TYPE "public"."dine_mode" AS ENUM('dine_in', 'takeaway');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('awaiting_payment', 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('qris_online', 'va_online', 'qris_cashier', 'cash_cashier');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('idr');--> statement-breakpoint
CREATE TYPE "public"."payment_entity_type" AS ENUM('user', 'merchant', 'platform_fee', 'payment_gateway_fee', 'tax', 'external');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'merchant', 'admin', 'superadmin');--> statement-breakpoint
CREATE TABLE "merchant_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_api_keys_keyHash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "merchant_type" DEFAULT 'restaurant' NOT NULL,
	"status" "merchant_status" DEFAULT 'pending' NOT NULL,
	"category" text,
	"description" text,
	"logo_url" text,
	"banner_url" text,
	"city" text,
	"fee_percent" text DEFAULT '2.5' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_shortName_unique" UNIQUE("short_name"),
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "merchants_short_name_format" CHECK ("merchants"."short_name" ~ '^[a-zA-Z0-9_.\-]+$' AND "merchants"."short_name" !~ '\.$')
);
--> statement-breakpoint
CREATE TABLE "merchant_order_counters" (
	"merchant_id" uuid NOT NULL,
	"display_date" date NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_order_counters_merchant_id_display_date_pk" PRIMARY KEY("merchant_id","display_date")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"customer_note" text,
	"dine_mode" "dine_mode" NOT NULL,
	"table_number" text,
	"payment_method" "payment_method" NOT NULL,
	"payment_transaction_id" uuid,
	"status" "order_status" DEFAULT 'awaiting_payment' NOT NULL,
	"total_amount" integer NOT NULL,
	"order_type" text DEFAULT 'immediate' NOT NULL,
	"estimated_ready_at" timestamp with time zone,
	"display_code" integer NOT NULL,
	"display_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"image_url" text,
	"stock" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_details" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"payment_transaction_id" uuid NOT NULL,
	"provider" text,
	"provider_payment_method" text,
	"provider_payment_id" text,
	"provider_payment_time" timestamp with time zone,
	"provider_request_body" jsonb,
	"provider_response_body" jsonb,
	"provider_payment_qr_code" text,
	"provider_payment_url" text,
	"ip_address" "inet",
	"referer" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"parent_id" uuid,
	"status" "payment_status" NOT NULL,
	"sender_type" "payment_entity_type" NOT NULL,
	"sender_id" uuid,
	"sender_name" text,
	"sender_email" text,
	"sender_phone" text,
	"sender_currency" "currency" NOT NULL,
	"recipient_type" "payment_entity_type" NOT NULL,
	"recipient_id" uuid,
	"recipient_name" text,
	"recipient_email" text,
	"recipient_phone" text,
	"recipient_currency" "currency" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"received_amount_cents" bigint GENERATED ALWAYS AS ("amount_cents") STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_positive_amount_check" CHECK ("payment_transactions"."amount_cents" > 0),
	CONSTRAINT "payment_transactions_sender_id_email_check" CHECK ((
        "payment_transactions"."sender_type" IN ('user', 'merchant')
        AND ("payment_transactions"."sender_id" IS NOT NULL OR "payment_transactions"."sender_email" IS NOT NULL)
      ) OR (
        "payment_transactions"."sender_type" NOT IN ('user', 'merchant')
      )),
	CONSTRAINT "payment_transactions_recipient_id_email_check" CHECK ((
        "payment_transactions"."recipient_type" IN ('user', 'merchant')
        AND ("payment_transactions"."recipient_id" IS NOT NULL OR "payment_transactions"."recipient_email" IS NOT NULL)
      ) OR (
        "payment_transactions"."recipient_type" NOT IN ('user', 'merchant')
      )),
	CONSTRAINT "payment_transactions_sender_name_check" CHECK ((
        "payment_transactions"."sender_type" IN ('user', 'merchant')
        AND "payment_transactions"."sender_name" IS NOT NULL
      ) OR (
        "payment_transactions"."sender_type" NOT IN ('user', 'merchant')
      )),
	CONSTRAINT "payment_transactions_recipient_name_check" CHECK ((
        "payment_transactions"."recipient_type" IN ('user', 'merchant')
        AND "payment_transactions"."recipient_name" IS NOT NULL
      ) OR (
        "payment_transactions"."recipient_type" NOT IN ('user', 'merchant')
      ))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"name" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'merchant' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "merchant_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"description" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_order_counters" ADD CONSTRAINT "merchant_order_counters_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_details" ADD CONSTRAINT "payment_details_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."payment_transactions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "merchant_webhooks" ADD CONSTRAINT "merchant_webhooks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_api_keys_merchant_id_idx" ON "merchant_api_keys" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_api_keys_key_prefix_idx" ON "merchant_api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "merchant_api_keys_key_hash_idx" ON "merchant_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "merchant_api_keys_revoked_at_idx" ON "merchant_api_keys" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "merchants_owner_id_idx" ON "merchants" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "merchants_slug_idx" ON "merchants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "merchants_short_name_idx" ON "merchants" USING btree ("short_name");--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "merchants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchants_city_idx" ON "merchants" USING btree ("city");--> statement-breakpoint
CREATE INDEX "merchants_category_idx" ON "merchants" USING btree ("category");--> statement-breakpoint
CREATE INDEX "merchants_type_idx" ON "merchants" USING btree ("type");--> statement-breakpoint
CREATE INDEX "merchants_is_featured_idx" ON "merchants" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_merchant_id_idx" ON "orders" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_payment_transaction_id_idx" ON "orders" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_merchant_display_unq" ON "orders" USING btree ("merchant_id","display_date","display_code");--> statement-breakpoint
CREATE INDEX "products_merchant_id_idx" ON "products" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "products_is_available_idx" ON "products" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_details_payment_transaction_id_unq" ON "payment_details" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_sender_idx" ON "payment_transactions" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_recipient_idx" ON "payment_transactions" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_sender_time_status_idx" ON "payment_transactions" USING btree ("sender_id",uuid_extract_timestamp("id"),"status");--> statement-breakpoint
CREATE INDEX "payment_transactions_recipient_time_status_idx" ON "payment_transactions" USING btree ("recipient_id",uuid_extract_timestamp("id"),"status");--> statement-breakpoint
CREATE INDEX "payment_transactions_parent_idx" ON "payment_transactions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions" USING hash ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "merchant_webhooks_merchant_id_idx" ON "merchant_webhooks" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_webhooks_revoked_at_idx" ON "merchant_webhooks" USING btree ("revoked_at");