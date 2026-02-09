// Request a password reset code for a user
query "auth/request-password-reset" verb=POST {
  api_group = "Authentication"

  input {
    // The user's phone number
    text phone
  }

  stack {
    // Check if user exists
    db.get users {
      field_name = "phone"
      field_value = $input.phone
    } as $user
  
    // Precondition to ensure the user exists
    precondition ($user != null) {
      error_type = "inputerror"
      error = "No user found with this phone number."
    }
  
    // Generate a 6-digit reset code (100000-999999)
    var $reset_code {
      value = (100000|random:999999)
    }
  
    // Set expiration time (15 minutes from now)
    var $expiration {
      value = "now+15min"
    }
  
    // Store the reset code in the user record
    db.edit users {
      field_name = "id"
      field_value = $user.id
      data = {
        password_reset_code: $reset_code
        password_reset_expires: $expiration
      }
    } as $updated_user
  
    // Return success message (do NOT return the code - it should be sent via SMS)
    var $response {
      value = {
        message: "Password reset code sent successfully. Please check your phone."
      }
    }
  }

  response = $response
}
