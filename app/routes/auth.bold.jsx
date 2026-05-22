import { authenticate } from "../shopify.server";
import { getBoldAuthUrl } from "../services/bold.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  try {
    const authUrl = getBoldAuthUrl(session.shop);
    return { authUrl };
  } catch (error) {
    return { error: error.message };
  }
};
