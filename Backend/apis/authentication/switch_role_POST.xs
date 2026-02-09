query "switch-role" verb=POST {
  api_group = "Authentication"
  auth = "users"

  input {
    // The desired role to switch to (e.g., 'rider', 'driver')
    text new_role filters=trim|lower
  }

  stack {
    // Check if token is revoked
    db.get revoked_tokens {
      field_name = "token"
      field_value = $auth.authToken
    } as $revoked_check
  
    precondition ($revoked_check == null) {
      error = "Session has been invalidated. Please log in again."
    }

    // Retrieve the authenticated user's ID
    var $user_id {
      value = $auth.id
    }

    // Log role switch attempt
    util.log {
      level = "info"
      message = "Role switch attempt for user ID: " & $user_id & " to role: " & $input.new_role
    }
  
    // Get the current user record
    db.get users {
      field_name = "id"
      field_value = $user_id
    } as $user
  
    // Precondition to ensure the user exists
    precondition ($user != null) {
      error_type = "accessdenied"
      error = "User not found."
    }
  
    // Validate the new_role input
    precondition ($input.new_role == "rider" || $input.new_role == "driver") {
      error_type = "inputerror"
      error = "Invalid role specified. Must be 'rider' or 'driver'."
    }
  
    // Prevent switching to the same role
    precondition ($user.role != $input.new_role) {
      error_type = "inputerror"
      error = "User is already in the requested role."
    }
  
    // Initialize variable for online status based on current status
    var $new_online_status {
      value = $user.is_online
    }
  
    // Conditional logic for role specific updates
    conditional {
      if ($input.new_role == "driver") {
        // If switching to driver, ensure driver profile exists and is approved
        precondition ($user.driver_profile_exists && $user.driver_approved) {
          error_type = "accessdenied"
          error = "Driver profile not complete or not approved."
        }
      
        // Set driver status to online if switching to driver role
        var.update $new_online_status {
          value = true
        }
      }
    
      else {
        // If switching to rider, set online status to false
        var.update $new_online_status {
          value = false
        }
      }
    }

    // Log successful role switch validation
    util.log {
      level = "info"
      message = "Role switch validated for user: " & $user.name & " from " & $user.role & " to " & $input.new_role
    }
  
    // Update the user's role in the database
    db.edit users {
      field_name = "id"
      field_value = $user_id
      data = {role: $input.new_role, is_online: $new_online_status}
    } as $updated_user
  
    // Fetch the complete updated user record with all fields
    // Fetch full user data including driver-specific details
    db.get users {
      field_name = "id"
      field_value = $user_id
    } as $full_user
  
    // Return the full updated user information
    // Build response with all user fields (excluding password)
    var $response_data {
      value = $full_user
        |pick:```
          [
            "id"
            "name"
            "phone"
            "role"
            "city"
            "gender"
            "age"
            "marital_status"
            "religion"
            "personality"
            "rating"
            "trips_count"
            "is_online"
            "avatar"
            "years_experience"
            "driver_profile_exists"
            "driver_verified"
            "driver_approved"
            "driver_status"
            "force_rider_mode"
            "account_status"
            "created_at"
            "service_areas"
          ]
          ```
    }
  
    // If the user is now a driver, fetch and append driver-specific details
    // If the user is a driver, fetch and append driver-specific details
    conditional {
      if ($response_data.role == "driver") {
        // Fetch vehicle details associated with the user
        db.get vehicles {
          field_name = "user_id"
          field_value = $user_id
        } as $vehicle
      
        // Fetch driver location details
        db.get driver_locations {
          field_name = "driver_id"
          field_value = $user_id
        } as $location
      
        // Update response with vehicle and location data
        var.update $response_data {
          value = $response_data
            |set:"vehicle":$vehicle
            |set:"location":$location
        }
      }
    }
  }

  response = $response_data
}