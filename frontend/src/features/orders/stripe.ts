"use client";

/**
 * Minimal Stripe.js loader. Only the *publishable* key (designed to be public)
 * is exposed to the browser; the secret key stays on the backend, which
 * creates the PaymentIntent and hands back its client secret.
 *
 * Stripe requires loading Stripe.js from js.stripe.com (PCI scope); card
 * data never touches this app.
 */
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export interface StripePaymentElement {
  mount: (element: HTMLElement) => void;
  destroy: () => void;
}

export interface StripeElements {
  create: (type: "payment", options?: Record<string, unknown>) => StripePaymentElement;
}

export interface StripeClient {
  elements: (options: { clientSecret: string; appearance?: Record<string, unknown> }) => StripeElements;
  confirmPayment: (options: {
    elements: StripeElements;
    redirect: "if_required";
    confirmParams?: { return_url?: string };
  }) => Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
}

declare global {
  interface Window {
    Stripe?: (key: string) => StripeClient;
  }
}

let loading: Promise<StripeClient | null> | null = null;

export function loadStripe(): Promise<StripeClient | null> {
  if (!STRIPE_PUBLISHABLE_KEY) return Promise.resolve(null);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve(window.Stripe(STRIPE_PUBLISHABLE_KEY));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve(window.Stripe ? window.Stripe(STRIPE_PUBLISHABLE_KEY) : null);
    script.onerror = () => {
      loading = null;
      reject(new Error("Stripe.js failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Payment Element styled with the CollabOS tokens. */
export const STRIPE_APPEARANCE = {
  theme: "night",
  variables: {
    colorPrimary: "#C8FF00",
    colorBackground: "#101010",
    colorText: "#FFFFFF",
    colorDanger: "#FF5C5C",
    borderRadius: "8px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
};
