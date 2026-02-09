table "revoked_tokens" {
  column "id" integer null autoincrement
  column "created_at" timestamp null default=now
  column "token" text null
  column "user_id" integer null
  column "revoked_at" timestamp null default=now
  column "reason" text null
  
  primary key = "id"
  
  index "idx_token" = ["token"]
  index "idx_user_id" = ["user_id"]
  index "idx_revoked_at" = ["revoked_at"]
}
