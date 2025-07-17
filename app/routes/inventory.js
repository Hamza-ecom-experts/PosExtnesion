import { jwtVerify } from 'jose';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function loader({ request }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ No bearer token found in Authorization header');
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const sessionToken = authHeader.replace('Bearer ', '').trim();
  let payload;
  try {
    const { payload: decoded } = await jwtVerify(
      sessionToken,
      new TextEncoder().encode(process.env.SHOPIFY_API_SECRET),
      { algorithms: ['HS256'] }
    );
    payload = decoded;
    console.log('✅ Decoded session:', payload);
  } catch (error) {
    console.error('❌ Failed to decode token:', error);
    return new Response('Invalid token', { status: 403, headers: corsHeaders });
  }

  // Extract shop domain from payload.dest (e.g., https://your-store.myshopify.com)
  const shopDomain = payload.dest.replace(/^https:\/\//, '');

  // Exchange session token for Admin API access token
  let accessToken = null;
  let exchangeError = null;
  try {
    const exchangeRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: sessionToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      }),
    });
    const exchangeData = await exchangeRes.json();
    if (exchangeRes.ok && exchangeData.access_token) {
      accessToken = exchangeData.access_token;
      console.log('✅ Access token obtained:', accessToken);
    } else {
      exchangeError = exchangeData;
      console.error('❌ Token exchange failed:', exchangeData);
    }
  } catch (err) {
    exchangeError = err.message || String(err);
    console.error('❌ Token exchange error:', err);
  }

  // Extract query params
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId");
  const variantId = url.searchParams.get("variantId");

  let matchFound = false;
  let matchedLocation = null;
  let inventoryQuantity = null;
  let availableInventory = null;
  let matchedLocationInventory = null;
  let adminApiError = null;
  let adminApiResponse = null;

  if (accessToken && variantId && locationId) {
    // Build the GID for the variant
    const variantGID = variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`;
    // Normalize locationId to GID format for comparison
    const normalizedLocationId = locationId.startsWith('gid://') ? locationId : `gid://shopify/Location/${locationId}`;
    const query = `
      query VariantInventoryLevels($id: ID!) {
        productVariant(id: $id) {
          id
          title
          inventoryItem {
            inventoryLevels(first: 10) {
              nodes {
                location {
                  id
                  name
                }
                quantities(names: ["available"]) {
                  name
                  quantity
                }
              }
            }
          }
        }
      }
    `;
    try {
      const adminRes = await fetch(`https://${shopDomain}/admin/api/2024-04/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query,
          variables: { id: variantGID },
        }),
      });
      const adminData = await adminRes.json();
      adminApiResponse = adminData;
      console.log('🔎 Full Admin API GraphQL response:', JSON.stringify(adminData, null, 2));
      const nodes = adminData?.data?.productVariant?.inventoryItem?.inventoryLevels?.nodes || [];
      for (const node of nodes) {
        if (node.location.id === normalizedLocationId || node.location.name === locationId) {
          matchedLocation = node.location;
          const available = node.quantities.find(q => q.name === 'available');
          inventoryQuantity = available ? available.quantity : null;
          availableInventory = inventoryQuantity;
          matchedLocationInventory = inventoryQuantity;
          if (inventoryQuantity === 0) {
            matchFound = true;
          }
          break;
        }
      }
    } catch (err) {
      adminApiError = err.message || String(err);
    }
  }

  return new Response(
    JSON.stringify({
      message: "POS token authenticated, token exchange and Admimn API query attempted",
      shop: shopDomain,
      user: payload.sub,
      locationId,
      variantId,
      matchFound,
      matchedLocation,
      matchedLocationInventory,
      inventoryQuantity,
      availableInventory,
      adminApiError,
      adminApiResponse,
      sessionPayload: payload,
      accessToken,
      exchangeError,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}
