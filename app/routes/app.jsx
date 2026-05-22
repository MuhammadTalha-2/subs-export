import {
  Outlet,
  useLoaderData,
  useRouteError,
  useNavigation,
  useLocation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../utils/shop.server";
import {
  NavigationProgress,
  getSkeletonForPath,
} from "../components/PageSkeletons";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const navigation = useNavigation();
  const currentLocation = useLocation();

  const isNavigatingToNewRoute =
    navigation.state === "loading" &&
    navigation.location &&
    navigation.location.pathname !== currentLocation.pathname;

  const routeSkeleton = isNavigatingToNewRoute
    ? getSkeletonForPath(navigation.location.pathname)
    : null;

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <NavigationProgress />
        <s-app-nav>
          <s-link href="/app">Dashboard</s-link>
          <s-link href="/app/connections">Connections</s-link>
          <s-link href="/app/preview">Preview</s-link>
          <s-link href="/app/exports">Exports</s-link>
          <s-link href="/app/settings">Settings</s-link>
        </s-app-nav>
        {routeSkeleton || <Outlet />}
      </PolarisAppProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
