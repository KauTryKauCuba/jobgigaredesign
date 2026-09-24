// Shared between the two server-side flows that can produce this error
// (email/OTP request and the Google sign-in callback) and the client
// AuthModal, which matches on it verbatim to swap "Send code" for a
// "Get started" button — keeping all three in sync in one place.
export const ACCOUNT_NOT_FOUND_MESSAGE =
  "We couldn't find an account with that email. Try Get started instead.";
