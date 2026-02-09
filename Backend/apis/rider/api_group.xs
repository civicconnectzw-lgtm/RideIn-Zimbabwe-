api_group Rider {
  canonical = "XiPFmbSV"
  swagger = {token: "S4W6HkpgibUvq_R8FcKNZhbVmr4"}
  cors = {
    mode       : "custom"
    origins    : ["https://ridein-zimbabwe.netlify.app"]
    methods    : ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
    headers    : ["Authorization", "Content-Type", "Access-Control-Allow-Headers", "Accept", "Origin", "X-Requested-With"]
    credentials: true
    max_age    : 86400
  }
}