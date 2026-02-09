// Revoke authentication token (logout with server-side invalidation)
query "auth/revoke" verb=POST {
  api_group = "Authentication"
  auth = "users"

  input {
    text token
  }

  stack {
    // Check if token is already revoked
    db.get revoked_tokens {
      field_name = "token"
      field_value = $input.token
    } as $existing_revocation
  
    conditional {
      if ($existing_revocation == null) {
        // Revoke the token
        db.insert revoked_tokens {
          token = $input.token
          user_id = $auth.id
          reason = "manual_logout"
        }
      }
    }
  }

  response = {success: true, message: "Token revoked successfully"}
}
