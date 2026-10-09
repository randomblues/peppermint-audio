"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod";

import { rentalDays } from "@/lib/payment-flow";

const hireDatesSchema = z.object({
  pickupDate: z.string(),
  dropoffDate: z.string(),
}).refine(({ pickupDate, dropoffDate }) =>
  (!pickupDate || rentalDays(pickupDate, pickupDate) !== null)
  && (!dropoffDate || rentalDays(dropoffDate, dropoffDate) !== null)
  && (!pickupDate || !dropoffDate || dropoffDate >= pickupDate),
);

export type HireDates = z.infer<typeof hireDatesSchema>;
const emptyHireDates: HireDates = { pickupDate: "", dropoffDate: "" };

export type CartItem = {
  id: string;
  name: string;
  kind: "package" | "equipment";
  option?: string;
  price: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  hireDates: HireDates;
  setHireDates: (dates: HireDates) => void;
  total: number;
  itemCount: number;
};

const storageKey = "peppermint-audio-cart";
const datesStorageKey = "peppermint-audio-hire-dates";
const CartContext = createContext<CartContextValue | null>(null);
const emptyCart: CartContextValue = {
  items: [],
  addItem: () => undefined,
  removeItem: () => undefined,
  updateQuantity: () => undefined,
  clearCart: () => undefined,
  hireDates: emptyHireDates,
  setHireDates: () => undefined,
  total: 0,
  itemCount: 0,
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hireDates, setHireDates] = useState<HireDates>(emptyHireDates);
  const [datesHydrated, setDatesHydrated] = useState(false);

  useEffect(() => {
    let dates = emptyHireDates;
    try {
      const stored = window.localStorage.getItem(datesStorageKey);
      if (stored) {
        const result = hireDatesSchema.safeParse(JSON.parse(stored));
        if (!result.success) throw new Error("Stored hire dates are invalid.");
        dates = result.data;
      }
    } catch (error) {
      console.warn("Could not restore hire dates. Please select your dates again.", error);
      window.localStorage.removeItem(datesStorageKey);
    }
    startTransition(() => {
      setHireDates(dates);
      setDatesHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!datesHydrated) return;
    window.localStorage.setItem(datesStorageKey, JSON.stringify(hireDates));
  }, [datesHydrated, hireDates]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      startTransition(() => {
        setItems(stored ? (JSON.parse(stored) as CartItem[]) : []);
        setHydrated(true);
      });
    } catch {
      window.localStorage.removeItem(storageKey);
      startTransition(() => setHydrated(true));
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    addItem: (item) => setItems((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [...current, { ...item, quantity: 1 }];
    }),
    removeItem: (id) => setItems((current) => current.filter((item) => item.id !== id)),
    updateQuantity: (id, quantity) =>
      setItems((current) =>
        quantity > 0
          ? current.map((item) => (item.id === id ? { ...item, quantity } : item))
          : current.filter((item) => item.id !== id),
      ),
    clearCart: () => {
      setItems([]);
      setHireDates(emptyHireDates);
    },
    hireDates,
    setHireDates,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  }), [items, hireDates]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext) ?? emptyCart;
}
