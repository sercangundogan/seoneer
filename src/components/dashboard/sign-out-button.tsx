"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/primitives";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      className="w-full justify-start px-3"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await authClient.signOut();
          router.push("/signin");
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      Sign out
    </Button>
  );
}
