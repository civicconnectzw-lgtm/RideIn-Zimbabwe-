api_group Authentication {
  canonical = "G-puafhu"
  cors = {
    mode       : "custom"
    // IMPORTANT: Update origins to support preview branches and staging environments
    // For production, use environment variables or add patterns like:
    // - https://ridein-zimbabwe.netlify.app
    // - https://deploy-preview-*--ridein-zimbabwe.netlify.app
    // - https://branch-*--ridein-zimbabwe.netlify.app
    // Currently hardcoded to production only - update based on deployment needs
    origins    : ["https://ridein-zimbabwe.netlify.app"]
    methods    : ["GET", "POST", "OPTIONS"]
    headers    : ["Authorization", "Content-Type", "Access-Control-Allow-Headers", "Accept", "Origin", "X-Requested-With"]
    credentials: true
    max_age    : 3600
  }
}