export type UserType = "ADMIN" | "DEALER" | "AGENT";

interface Config {
  apiBaseUrl: string;
  build: boolean;
}

export const config: Config = {
  apiBaseUrl: "https://alfarah.in",
  build: true,  
};
