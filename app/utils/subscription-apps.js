export const SUBSCRIPTION_APPS = {
  recharge: {
    name: "ReCharge",
    slug: "recharge",
    authType: "api_key",
    phase: "A",
    description: "Connect your ReCharge account using an API key from your ReCharge dashboard.",
    docsUrl: "https://docs.rechargepayments.com/",
    rateLimit: "4 req/sec",
  },
  bold: {
    name: "Bold Subscriptions",
    slug: "bold",
    authType: "oauth",
    phase: "A",
    description: "Connect Bold Subscriptions via OAuth. You'll be redirected to authorize access.",
    docsUrl: "https://developer.boldcommerce.com/",
    rateLimit: "2 req/sec",
  },
  skio: {
    name: "Skio",
    slug: "skio",
    authType: "api_key",
    phase: "B",
    description: "Connect your Skio account using a GraphQL API key.",
    docsUrl: "https://docs.skio.com/",
    rateLimit: "Standard",
  },
  seal: {
    name: "Seal Subscriptions",
    slug: "seal",
    authType: "api_key",
    phase: "B",
    description: "Connect Seal Subscriptions using an API key.",
    docsUrl: "https://docs.sealsubscriptions.com/",
    rateLimit: "2 req/sec",
  },
  paywhirl: {
    name: "PayWhirl",
    slug: "paywhirl",
    authType: "api_key",
    phase: "B",
    description: "Connect your PayWhirl account using an API key.",
    docsUrl: "https://docs.paywhirl.com/",
    rateLimit: "Standard",
  },
  loop: {
    name: "Loop Subscriptions",
    slug: "loop",
    authType: "oauth",
    phase: "B",
    description: "Connect Loop Subscriptions via OAuth authorization.",
    docsUrl: "https://docs.loopsubscriptions.com/",
    rateLimit: "Standard",
  },
};

export const PHASE_A_APPS = Object.values(SUBSCRIPTION_APPS).filter(
  (app) => app.phase === "A",
);

export const PHASE_B_APPS = Object.values(SUBSCRIPTION_APPS).filter(
  (app) => app.phase === "B",
);
