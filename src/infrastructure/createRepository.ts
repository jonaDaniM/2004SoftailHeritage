import { createLocalStorageRepository } from "./localStorageRepository";
import type { TicketRepository } from "./repository";
import { createSupabaseRepository } from "./supabaseRepository";

export const createRepository = (): { repository: TicketRepository; mode: "supabase" | "local" } => {
  const mode = import.meta.env.VITE_PERSISTENCE_MODE === "local" ? "local" : "supabase";

  if (mode === "local") {
    return {
      repository: createLocalStorageRepository(),
      mode
    };
  }

  return {
    repository: createSupabaseRepository(),
    mode
  };
};
