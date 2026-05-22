import { authenticate } from "../shopify.server";
import { getGoogleAuthUrl } from "../services/google-auth.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const authUrl = getGoogleAuthUrl(session.shop);
  return { authUrl };
};
