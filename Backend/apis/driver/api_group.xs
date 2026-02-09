api_group Driver {
  canonical = "MPVI7NsD"
  swagger = {token: "k-RInIKFhTKQ8uxPDcWiXZzwYFg"}
  cors = {
    mode       : "custom"
    origins    : ["https://ridein-zimbabwe.netlify.app"]
    methods    : ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
    headers    : ["Authorization", "Content-Type", "Access-Control-Allow-Headers", "Accept", "Origin", "X-Requested-With"]
    credentials: true
    max_age    : 86400
  }
}