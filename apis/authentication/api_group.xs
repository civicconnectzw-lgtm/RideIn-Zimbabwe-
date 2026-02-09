api_group Authentication {
  canonical = "G-puafhu"
  cors = {
    mode       : "custom"
    origins    : ["https://ridein-zimbabwe-1.netlify.app"]
    methods    : ["DELETE", "GET", "PATCH", "POST", "PUT"]
    headers    : ["Authorization", "Content-Type", "Accept", "X-Requested-With"]
    credentials: true
    max_age    : 86400
  }
}