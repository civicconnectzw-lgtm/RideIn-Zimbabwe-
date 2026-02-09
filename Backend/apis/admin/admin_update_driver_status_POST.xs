// Admin-only API endpoint - Update driver approval status
query "admin/users/:user_id/driver-status" verb=POST {
  api_group = "Admin"
  auth = "users"

  input {
    integer user_id
    text driver_status // pending, approved, rejected
    text reason
  }

  stack {
    // Check if requester is admin
    db.get users {
      field_name = "id"
      field_value = $auth.id
      output = ["role"]
    } as $current_user
  
    precondition ($current_user.role == "admin") {
      error = "Access denied. Admin privileges required."
    }

    // Validate driver_status
    precondition ($input.driver_status == "pending" || $input.driver_status == "approved" || $input.driver_status == "rejected") {
      error = "Invalid driver status. Must be: pending, approved, or rejected."
    }

    // Get the target user to verify they are a driver
    db.get users {
      field_name = "id"
      field_value = $input.user_id
      output = ["role"]
    } as $target_user

    precondition ($target_user.role == "driver") {
      error = "User is not a driver. Driver status can only be changed for driver accounts."
    }

    // Update driver status fields
    db.update users {
      id = $input.user_id
      driver_status = $input.driver_status
      driver_approved = ($input.driver_status == "approved")
    } as $updated_user
  }

  response = {
    success: true
    message: "Driver status updated successfully"
    user: $updated_user
  }
}
