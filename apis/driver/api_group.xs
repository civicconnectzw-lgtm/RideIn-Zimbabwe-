api_group Driver {
  canonical = "MPVI7NsD"
  swagger = {token: "k-RInIKFhTKQ8uxPDcWiXZzwYFg"}
  cors = {
    mode       : "custom"
    origins    : ["https://ridein-zimbabwe.netlify.app"]
    methods    : ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]
    headers    : ["Authorization", "Content-Type", "Accept", "X-Requested-With"]
    credentials: true
    max_age    : 86400
  }
}