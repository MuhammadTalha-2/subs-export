import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop } = await authenticate.webhook(request);

  const existingShop = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (existingShop) {
    await db.shop.delete({ where: { shopDomain: shop } });
  }

  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
