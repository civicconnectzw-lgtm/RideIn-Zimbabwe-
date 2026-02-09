// Admin-only API endpoint example - Get all users (admin panel)
query "admin/users" verb=GET {
  api_group = "Admin"
  auth = "users"

  input {
    integer page default=1
    integer per_page default=30
  }

  stack {
    // Check if user is admin
    db.get users {
      field_name = "id"
      field_value = $auth.id
      output = ["role"]
    } as $current_user
  
    precondition ($current_user.role == "admin") {
      error = "Access denied. Admin privileges required."
    }

    // Get total count
    db.count users {} as $total_count

    // Calculate pagination
    var $offset {
      value = ($input.page - 1) * $input.per_page
    }

    // Fetch paginated users (excluding passwords)
    db.query users {
      output = ["id", "name", "phone", "role", "city", "rating", "trips_count", "is_online", "avatar", "account_status", "driver_status", "driver_approved", "created_at"]
      limit = $input.per_page
      offset = $offset
      sort = ["-created_at"]
    } as $users

    // Calculate total pages (ceiling division to ensure all users are included)
    var $total_pages {
      value = math.ceil($total_count / $input.per_page)
    }

    var $response {
      value = {
        users: $users
        pagination: {
          page: $input.page
          per_page: $input.per_page
          total: $total_count
          total_pages: $total_pages
        }
      }
    }
  }

  response = $response
}
