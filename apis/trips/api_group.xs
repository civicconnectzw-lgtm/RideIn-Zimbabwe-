api_group Trips {
  canonical = "w0dfiywP"
  swagger = {token: "C2T2wX5av75kpI5_tEw-F6R_2sY"}
  cors = {
    mode       : "custom"
    origins    : ["https://ridein-zimbabwe.netlify.app"]
    methods    : ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]
    headers    : ["Authorization", "Content-Types", "Accept", "X-Requested-With"]
    credentials: true
    max_age    : 86400
  }
}