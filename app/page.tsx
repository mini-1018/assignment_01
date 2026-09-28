import { SiteShell } from "@/app/ui";
import { HomeView } from "@/views/home";

export default function Page() {
  return (
    <SiteShell activeHref="/">
      <HomeView />
    </SiteShell>
  );
}
