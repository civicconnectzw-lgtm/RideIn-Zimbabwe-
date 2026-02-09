// Complete password reset with code validation
query "auth/complete-password-reset" verb=POST {
  api_group = "Authentication"

  input {
    // The user's phone number
    text phone
  
    // The reset code received
    text code
  
    // The new password
    password password
  }

  stack {
    // Validate the new password
    precondition (($input.password|strlen) >= 8) {
      error_type = "inputerror"
      error = "Password must be at least 8 characters long."
    }
  
    // Find user by phone
    db.get users {
      field_name = "phone"
      field_value = $input.phone
    } as $user
  
    // Precondition to ensure user exists
    precondition ($user != null) {
      error_type = "inputerror"
      error = "No user found with this phone number."
    }
  
    // Verify reset code matches
    precondition ($user.password_reset_code == $input.code) {
      error_type = "inputerror"
      error = "Invalid or expired reset code."
    }
  
    // Check if code has expired
    precondition ($user.password_reset_expires > "now") {
      error_type = "inputerror"
      error = "Reset code has expired. Please request a new one."
    }
  
    // Hash the new password before storing
    security.hash_password {
      password = $input.password
    } as $hashed_password
  
    // Update password and clear reset fields
    db.edit users {
      field_name = "id"
      field_value = $user.id
      data = {
        password: $hashed_password
        password_reset_code: null
        password_reset_expires: null
      }
    } as $updated_user
  
    // Generate new auth token
    security.create_auth_token {
      table = "users"
      extras = {}
      expiration = 86400
      id = $user.id
    } as $auth_token
  
    // Fetch the updated user for response
    db.get users {
      field_name = "id"
      field_value = $user.id
    } as $final_user
  }

  response = {authToken: $auth_token, user: $final_user}
}
