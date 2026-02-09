// Retrieves the authenticated user's profile. If the user is a driver, includes vehicle and location data.
query "auth/me" verb=GET {
  api_group = "Authentication"
  auth = "users"

  input {
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

    // Fetch the authenticated user record
    db.get users {
      field_name = "id"
      field_value = $auth.id
    } as $user_record
  
    // Validate user exists
    precondition ($user_record != null) {
      error_type = "unauthorized"
      error = "User not found or session invalid."
    }

    // Log successful validation
    util.log {
      level = "info"
      message = "Token validated successfully for user: " & $user_record.name & " (ID: " & $auth.id & ")"
    }

    // Create response object with explicitly selected fields to ensure security (excluding password)
    var $response_data {
      value = $user_record
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
  
    // If the user is a driver, fetch and append driver-specific details
    conditional {
      if ($response_data.role == "driver") {
        // Fetch vehicle details associated with the user
        db.get vehicles {
          field_name = "user_id"
          field_value = $auth.id
        } as $vehicle
      
        // Fetch driver location details
        db.get driver_locations {
          field_name = "driver_id"
          field_value = $auth.id
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