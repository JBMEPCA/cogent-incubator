import { redirect } from "next/navigation";

// Every title's agents now live in one place, the engine hub. The per-title
// engine room was retired on 8 Oct 2026; this keeps old links and bookmarks
// working. The Costs breakdown under it is still a real page.
export default function EngineRoomPage() {
  redirect("/engine-hub");
}
