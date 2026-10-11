"use client";

import { useEffect } from "react";

// A single global observer that reveals content as it scrolls into view. It only
// "arms" (hides, then animates in) elements that start fully below the fold, so
// already-visible content never flashes and nothing stays hidden if JS can't
// run. Targets explicit `.cc-reveal` elements plus the customer list rows.
const SELECTOR = ".cc-reveal, .gp-item";

export function ScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("cc-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    const vh = () => window.innerHeight || document.documentElement.clientHeight;
    const arm = (el: Element) => {
      if (el.classList.contains("cc-armed") || el.classList.contains("cc-in")) return;
      // +24 buffer so items near the fold (or nudged by the entrance animation)
      // aren't hidden — only clearly off-screen elements get the reveal.
      if (el.getBoundingClientRect().top >= vh() + 24) {
        el.classList.add("cc-armed");
        io.observe(el);
      }
    };
    const scan = (root: ParentNode) => root.querySelectorAll(SELECTOR).forEach(arm);

    scan(document);
    // Catch client-side navigations and lists that load in after a fetch.
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches(SELECTOR)) arm(n);
          scan(n);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  return null;
}
