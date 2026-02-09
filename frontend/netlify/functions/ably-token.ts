
import Ably from "ably";

const XANO_BASE_URL = process.env.XANO_BASE_URL;
if (!XANO_BASE_URL) {
  console.error("[Ably Token] XANO_BASE_URL environment variable is not configured");
}

export const handler = async (event: any) => {
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://ridein-zimbabwe.netlify.app";
  
  // Prevent wildcard origin when credentials are enabled (security requirement)
  if (ALLOWED_ORIGIN === "*") {
    console.error("CORS Error: Cannot use wildcard origin '*' with credentials enabled");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Invalid CORS configuration" })
    };
  }
  
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: "Ably Key Missing" };

  // Extract Authorization header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      statusCode: 401, 
      headers, 
      body: JSON.stringify({ error: "Unauthorized - No valid authorization token provided" })
    };
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Validate token with Xano's /auth/me endpoint
  let authenticatedUserId: string;
  try {
    const response = await fetch(`${XANO_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { 
        statusCode: 401, 
        headers, 
        body: JSON.stringify({ error: "Unauthorized - Invalid or expired token" })
      };
    }

    const userData = await response.json();
    authenticatedUserId = userData.id?.toString();
    
    if (!authenticatedUserId) {
      return { 
        statusCode: 401, 
        headers, 
        body: JSON.stringify({ error: "Unauthorized - Invalid user data" })
      };
    }
  } catch (error) {
    console.error('Token validation error:', error);
    return { 
      statusCode: 401, 
      headers, 
      body: JSON.stringify({ error: "Unauthorized - Failed to validate token" })
    };
  }

  // Use the authenticated user's ID as clientId (prevent impersonation)
  const clientId = authenticatedUserId;

  // Validate Authorization token against Xano /auth/me endpoint
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader && clientId !== "anonymous") {
    try {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const xanoBaseUrl = process.env.XANO_API_URL;
      if (!xanoBaseUrl) {
        console.error("[Ably Token] XANO_API_URL environment variable is not configured");
        return { 
          statusCode: 500, 
          headers, 
          body: JSON.stringify({ error: "Server configuration error" }) 
        };
      }
      
      // Verify token with Xano
      const meResponse = await fetch(`${xanoBaseUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!meResponse.ok) {
        return { 
          statusCode: 401, 
          headers, 
          body: JSON.stringify({ error: "Invalid or expired authorization token" }) 
        };
      }

      const userData = await meResponse.json();
      
      // Enforce clientId to match authenticated user's ID
      if (userData.id && String(userData.id) !== String(clientId)) {
        return { 
          statusCode: 403, 
          headers, 
          body: JSON.stringify({ error: "ClientId must match authenticated user ID" }) 
        };
      }
    } catch (error: any) {
      console.error('[ably-token] Token validation error:', error);
      return { 
        statusCode: 401, 
        headers, 
        body: JSON.stringify({ error: "Token validation failed" }) 
      };
    }
  }

  try {
    const client = new Ably.Rest(apiKey);
    const tokenRequestData = await client.auth.createTokenRequest({ clientId });

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(tokenRequestData)
    };
  } catch (error: any) {
    console.error('Ably token generation error:', error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: "Token generation failed" })
    };
  }
};
