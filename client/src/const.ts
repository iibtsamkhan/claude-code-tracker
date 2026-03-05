export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginUrl = () => import.meta.env.VITE_CLERK_SIGN_IN_URL || "/sign-in";
export const getSignUpUrl = () => import.meta.env.VITE_CLERK_SIGN_UP_URL || "/sign-up";
