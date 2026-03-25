import React, { useEffect } from "react";
import { SafeAreaView, Text } from "react-native";
import { initHealthKit } from "./src/services/healthkit";

export default function App() {
  useEffect(() => {
    initHealthKit().catch((e) => console.log("HealthKit init error:", e));
  }, []);

  return (
    <SafeAreaView>
      <Text>HealthApp Setup Complete</Text>
    </SafeAreaView>
  );
}
