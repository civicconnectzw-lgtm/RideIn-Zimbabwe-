// Register a new user with password validation.
query "auth/signup" verb=POST {
  api_group = "Authentication"

  input {
    // The user's full name.
    text name
  
    // The user's phone number.
    text phone
  
    // The user's password.
    password password
  
    // The user's role (rider or driver). Defaults to 'rider' if not provided.
    text role? filters=trim|lower
    
    // The user's city
    text city?
    
    // Driver-specific fields
    number age?
    text gender?
    text marital_status?
    text religion?
    text personality?
  }

  stack {
    // Validate the password input before creating the user
    // Password must be at least 8 characters long
    precondition (($input.password|strlen) >= 8) {
      error_type = "inputerror"
      error = "Password must be at least 8 characters long."
    }
  
    // Set default role to 'rider' if not provided, otherwise use provided role
    var $user_role {
      value = $input.role ?? "rider"
    }
  
    // Validate the role input
    precondition ($user_role == "rider" || $user_role == "driver") {
      error_type = "inputerror"
      error = "Invalid role specified. Must be 'rider' or 'driver'."
    }
    
    // Check if the user already exists
    db.get users {
      field_name = "phone"
      field_value = $input.phone
    } as $existing_user
  
    // Ensure the phone number is unique
    precondition ($existing_user == null) {
      error_type = "inputerror"
      error = "A user with this phone number already exists."
    }
    
    // Hash the password
    security.hash_password {
      password = $input.password
    } as $hashed_password
  
    // Build user data object
    var $user_data {
      value = {
        name      : $input.name
        phone     : $input.phone
        password  : $hashed_password
        role      : $user_role
        created_at: "now"
      }
    }
    
    // Add optional fields if provided
    conditional {
      if ($input.city != null) {
        var.update $user_data {
          value = $user_data|set:"city":$input.city
        }
      }
    }
    
    conditional {
      if ($input.age != null) {
        var.update $user_data {
          value = $user_data|set:"age":$input.age
        }
      }
    }
    
    conditional {
      if ($input.gender != null) {
        var.update $user_data {
          value = $user_data|set:"gender":$input.gender
        }
      }
    }
    
    conditional {
      if ($input.marital_status != null) {
        var.update $user_data {
          value = $user_data|set:"marital_status":$input.marital_status
        }
      }
    }
    
    conditional {
      if ($input.religion != null) {
        var.update $user_data {
          value = $user_data|set:"religion":$input.religion
        }
      }
    }
    
    conditional {
      if ($input.personality != null) {
        var.update $user_data {
          value = $user_data|set:"personality":$input.personality
        }
      }
    }
    
    // Set driver flags if role is driver
    conditional {
      if ($user_role == "driver") {
        var.update $user_data {
          value = $user_data
            |set:"driver_profile_exists":true
            |set:"driver_status":"pending"
        }
      }
    }
  
    // Create the new user record
    db.add users {
      data = $user_data
    } as $user
  
    // Generate an authentication token
    security.create_auth_token {
      table = "users"
      extras = {}
      expiration = 86400
      id = $user.id
    } as $auth_token
  }

  response = {authToken: $auth_token, user: $user}
}