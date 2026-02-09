// Admin-only API endpoint - Update user account status
query "admin/users/:user_id/status" verb=POST {
  api_group = "Admin"
  auth = "users"

  input {
    integer user_id
    text status // active, suspended, banned
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

    // Prevent admin from modifying their own account status
    precondition ($input.user_id != $auth.id) {
      error = "Cannot modify your own account status."
    }

    // Validate status
    precondition ($input.status == "active" || $input.status == "suspended" || $input.status == "banned") {
      error = "Invalid status. Must be: active, suspended, or banned."
    }

    // Update user account status
    db.update users {
      id = $input.user_id
      account_status = $input.status
    } as $updated_user

    // Log the action (could be expanded to a separate audit log table)
    // For now, we'll just return the result
  }

  response = {
    success: true
    message: "User account status updated successfully"
    user: $updated_user
  }
}
