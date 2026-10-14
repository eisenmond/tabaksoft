export function createAccountEmailSender(config) {
  return async ({ to, type, url }) => {
    if (config.env !== "test") console.info(JSON.stringify({ event: "account_email", to, type, url }));
  };
}
