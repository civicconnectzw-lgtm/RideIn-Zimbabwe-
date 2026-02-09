// Refresh authentication token
query "auth/refresh" verb=POST {
  api_group = "Authentication"
  auth = "users"

  input {
  }

  stack {
    // Check if current token is revoked
    db.get revoked_tokens {
      field_name = "token"
      field_value = $auth.authToken
    } as $revoked_check
  
    precondition ($revoked_check == null) {
      error = "Token has been revoked. Please log in again."
    }

    // Fetch the authenticated user record
    db.get users {
      field_name = "id"
      field_value = $auth.id
      output = ["id", "created_at", "name", "phone", "role", "city", "rating", "trips_count", "is_online", "avatar", "driver_approved", "driver_status", "account_status"]
    } as $user_record
  
    precondition ($user_record != null) {
      error = "User not found."
    }

    // Check account status
    precondition ($user_record.account_status != "suspended" && $user_record.account_status != "banned") {
      error = "Account is suspended or banned."
    }
  
    // Revoke old token
    db.insert revoked_tokens {
      token = $auth.authToken
      user_id = $auth.id
      reason = "token_refresh"
    }

    // Create new auth token with 24 hour expiration
    security.create_auth_token {
      table = "users"
      extras = {}
      expiration = 86400
      id = $user_record.id
    } as $newAuthToken

    // Build a safe user object
    var $safe_user {
      value = $user_record
        |pick:```
          [
            "id"
            "name"
            "phone"
            "role"
            "city"
            "rating"
            "trips_count"
            "is_online"
            "avatar"
            "driver_approved"
            "driver_status"
            "account_status"
            "created_at"
          ]
          ```
    }
  }

  response = {authToken: $newAuthToken, user: $safe_user, tokenExpiry: 86400}
}
