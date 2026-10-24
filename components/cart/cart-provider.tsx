"use client";

/* eslint-disable react-hooks/set-state-in-effect -- client-only storage hydration must occur after SSR. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { addToCart, getCartItemCount, getCartSubtotal, removeCartItem, setCartItemQuantity, type CartMutationResult } from "@/lib/cart/domain";
import { CART_STORAGE_KEY, parseCartStorage, readCart, writeCart } from "@/lib/cart/storage";
import type { CartItem } from "@/types/cart";
import type { PublicProduct, PublicProductVariant } from "@/types/storefront";

export interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotalCop: number;
  hydrated: boolean;
  storageError: boolean;
  addItem: (product: PublicProduct, variant: PublicProductVariant, quantity?: number) => CartMutationResult;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
}

const defaultCartContext: CartContextValue = {
  items: [],
  itemCount: 0,
  subtotalCop: 0,
  hydrated: true,
  storageError: false,
  addItem: () => ({ items: [] }),
  setQuantity: () => undefined,
  removeItem: () => undefined,
  clearCart: () => undefined,
};

const CartContext = createContext<CartContextValue>(defaultCartContext);

interface CartProviderProps {
  children: React.ReactNode;
  storage?: Storage | null;
}

export function CartProvider({ children, storage }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const itemsRef = useRef<CartItem[]>([]);

  const commit = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
    if (!writeCart(next, storage)) setStorageError(true);
  }, [storage]);

  useEffect(() => {
    const loaded = readCart(storage);
    itemsRef.current = loaded;
    setItems(loaded);
    setHydrated(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CART_STORAGE_KEY) return;
      const next = parseCartStorage(event.newValue);
      itemsRef.current = next;
      setItems(next);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storage]);

  const addItem = useCallback((product: PublicProduct, variant: PublicProductVariant, quantity = 1) => {
    const result = addToCart(itemsRef.current, product, variant, quantity);
    if (!result.error) commit(result.items);
    return result;
  }, [commit]);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    commit(setCartItemQuantity(itemsRef.current, variantId, quantity));
  }, [commit]);

  const removeItem = useCallback((variantId: string) => {
    commit(removeCartItem(itemsRef.current, variantId));
  }, [commit]);

  const clearCart = useCallback(() => {
    commit([]);
  }, [commit]);

  const value: CartContextValue = {
    items,
    itemCount: getCartItemCount(items),
    subtotalCop: getCartSubtotal(items),
    hydrated,
    storageError,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/* eslint-enable react-hooks/set-state-in-effect */

export function useCart(): CartContextValue {
  return useContext(CartContext);
}
