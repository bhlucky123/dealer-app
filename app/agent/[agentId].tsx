
import { useGlobalSearchParams, useLocalSearchParams } from "expo-router";
import AgentTab from "../(tabs)/agent";

export default function AgentIdScreen() {
    const glob = useGlobalSearchParams();
    const local = useLocalSearchParams();
  
    console.log("Local:", local, "Global:", glob);

  return (
      <AgentTab id={local.agentId} />
  );
}
