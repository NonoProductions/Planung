"use client";

import { useEffect } from "react";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export default function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost = LOCAL_HOSTS.has(window.location.hostname);
    if (process.env.NODE_ENV !== "production" && !isLocalhost) {
      return;
    }

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        void registration.update();
      } catch (error) {
        console.error("Service worker registration failed.", error);
      }
    })();
  }, []);

  return null;
}
