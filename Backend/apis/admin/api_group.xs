api_group "Admin" {
  description = "Admin-only endpoints for system management"
  
  cors {
    enabled = true
    allow_origins = ["https://ridein-zimbabwe.netlify.app", "https://main--ridein-zimbabwe.netlify.app"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    allow_credentials = true
  }
}
