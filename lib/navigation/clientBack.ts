"use client";

type RouterLike = {
  back: () => void;
  replace: (href: string) => void;
};

export function goBackOrFallback(router: RouterLike, fallback: string) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }

  router.replace(fallback);
}
