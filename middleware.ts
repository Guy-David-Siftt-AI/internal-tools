import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Allowed email domain
const ALLOWED_DOMAIN = "siftt.ai";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/unauthorized(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return;
  }

  const { userId, sessionClaims } = await auth.protect();

  // Check email domain
  const email = sessionClaims?.email as string | undefined;
  if (email) {
    const domain = email.split("@")[1];
    if (domain !== ALLOWED_DOMAIN) {
      // Sign out and redirect to unauthorized page
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
