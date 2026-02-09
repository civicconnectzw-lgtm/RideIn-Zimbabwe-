// Login and retrieve an authentication token
query "auth/login" verb=POST {
  api_group = "Authentication"

  // Rate limiting should be configured in Xano API Group settings
  // Recommended: 10 requests per minute per IP for login endpoint

  input {
    text phone {
      description = "User's phone number"
      filters = ["trim", "min:1"]
    }
    text password {
      description = "User's password/PIN"
      sensitive = true
      filters = ["trim", "min:4"]
    }
  }

  stack {
    // Log login attempt with masked phone number
    util.log {
      level = "info"
      message = "Login attempt for phone: ***" & ($input.phone|substr:-4)
    }

    // Retrieve user by phone number, excluding email from the requested fields
    db.get users {
      field_name = "phone"
      field_value = $input.phone
      output = ["id", "created_at", "name", "phone", "role", "city", "rating", "trips_count", "is_online", "avatar", "driver_approved", "driver_status", "password"]
    } as $users
  
    precondition ($users != null) {
      error = "Invalid Credentials."
    }
  
    security.check_password {
      text_password = $input.password
      hash_password = $users.password
    } as $pass_result
  
    precondition ($pass_result) {
      error = "Invalid Credentials."
    }

    // Log successful authentication (reuse masked phone from above)
    util.log {
      level = "info"
      message = "Login successful for user ID: " & $users.id
    }
  
    security.create_auth_token {
      table = "users"
      extras = {}
      expiration = 86400
      id = $users.id
    } as $authToken

    // Build a safe user object without password
    var $safe_user {
      value = $users
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
            "created_at"
          ]
          ```
    }
  }

  response = {authToken: $authToken, user: $safe_user}
}