api_group Rider {
  canonical = "XiPFmbSV"
  swagger = {token: "S4W6HkpgibUvq_R8FcKNZhbVmr4"}
  cors = {
    mode       : "custom"
    origins    : ["https://ridein-zimbabwe.netlify.app"]
    methods    : ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]
    headers    : ["Authorization", "Content-Type", "Accept", "X-Requested-With"]
    credentials: true
    max_age    : 86400
  }
}