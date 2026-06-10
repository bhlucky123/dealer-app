export type UserType = "ADMIN" | "DEALER" | "AGENT";

interface Config {
  apiBaseUrl: string;
  build: boolean;
}

export const config: Config = {
  apiBaseUrl: "https://3dlnbe-production.up.railway.app",
  build: true,
};
// claude --dangerously-skip-permissions --model claude-opus-4-6