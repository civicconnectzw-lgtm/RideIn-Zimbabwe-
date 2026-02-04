import fetch from "node-fetch";

/**
 * PRODUCTION XANO PROXY
 * Routes requests to specific API groups based on path prefixes.
 */
export const handler = async (event: any) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // 4 API Group Environment Variables
  const XANO_AUTH_BASE_URL = process.env.XANO_AUTH_BASE_URL;
  const XANO_TRIPS_BASE_URL = process.env.XANO_TRIPS_BASE_URL;
  const XANO_RIDER_BASE_URL = process.env.XANO_RIDER_BASE_URL;
  const XANO_DRIVER_BASE_URL = process.env.XANO_DRIVER_BASE_URL;

  // Path cleanup
  const path = event.path.replace("/.netlify/functions/xano", "");
  
  // Routing Logic
  let baseUrl = XANO_RIDER_BASE_URL; // Default is Rider Group
  
  if (path.startsWith("/auth") || path.startsWith("/switch-role")) {
    baseUrl = XANO_AUTH_BASE_URL;
  } else if (path.startsWith("/trips")) {
    baseUrl = XANO_TRIPS_BASE_URL;
  } else if (path.startsWith("/location")) {
    baseUrl = XANO_DRIVER_BASE_URL;
  }
  
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        "Content-Type": "application/json",
        ...(event.headers.authorization ? { "Authorization": event.headers.authorization } : {})
      },
      body: event.httpMethod !== "GET" ? event.body : undefined
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (error: any) {
    console.error(`[Xano Proxy Fail] Routing ${path}:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "High traffic on backend cluster. Please retry." })
    };
  }
};