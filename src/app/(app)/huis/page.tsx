import { Suspense } from "react";
import { HomeScreen } from "@/components/screens/home";

export default function Page() {
  // HomeScreen reads ?tab=klusjes from the URL.
  return (
    <Suspense>
      <HomeScreen />
    </Suspense>
  );
}
