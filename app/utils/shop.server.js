import db from "../db.server";

export async function ensureShop(shopDomain) {
  let shop = await db.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    shop = await db.shop.create({
      data: { shopDomain },
    });
  }

  if (shop.uninstalledAt) {
    shop = await db.shop.update({
      where: { shopDomain },
      data: { uninstalledAt: null, installedAt: new Date() },
    });
  }

  return shop;
}

export async function getShopWithConnections(shopDomain) {
  return db.shop.findUnique({
    where: { shopDomain },
    include: { connections: true },
  });
}
