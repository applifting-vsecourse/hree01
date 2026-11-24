// Stands in for `@/core/email/render` in integration tests. Signing up sends a
// verification email; rendering it pulls in react-email, which Jest can't load
// (it imports modules dynamically), and no test reads the HTML anyway.
export const renderEmail = async (): Promise<string> => '<p>email</p>';
