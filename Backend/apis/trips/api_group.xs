api_group Trips {
  canonical = "w0dfiywP"
  swagger = {token: "C2T2wX5av75kpI5_tEw-F6R_2sY"}
  cors = {
    mode       : "custom"
    origins    : ["https://ridein-zimbabwe.netlify.app"]
    methods    : ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
    headers    : ["Authorization", "Content-Type", "Access-Control-Allow-Headers", "Accept", "Origin", "X-Requested-With"]
    credentials: true
    max_age    : 86400
  }
}