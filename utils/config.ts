export type UserType = "ADMIN" | "DEALER" | "AGENT";

interface Config {
  apiBaseUrl: string;
}

export const config: Config = {
  apiBaseUrl: "https://alfarah.in",
};
