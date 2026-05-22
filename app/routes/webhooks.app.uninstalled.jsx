import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session } = await authenticate.webhook(request);

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  const existingShop = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (existingShop) {
    await db.shop.update({
      where: { shopDomain: shop },
      data: { uninstalledAt: new Date() },
    });
  }

  return new Response();
};
