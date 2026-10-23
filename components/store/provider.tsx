"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api } from "@/lib/client";
import { catalog } from "@/lib/catalog";
import type { CartItem, Product, Role, Session, User } from "@/lib/types";
type Context = {
  session: Session;
  ready: boolean;
  products: Product[];
  catalogError: string;
  cart: CartItem[];
  toast: (message: string) => void;
  add: (p: Product) => void;
  quantity: (id: string, n: number) => void;
  clear: () => void;
  reload: () => Promise<void>;
  authenticate: (
    action: "login" | "register",
    data: Record<string, string>,
  ) => Promise<User>;
  demo: (role: Role) => Promise<User>;
  logout: () => Promise<void>;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
};
const StoreContext = createContext<Context | null>(null);
const subscribeHydration = () => () => {};
function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem("instantmart-cart") ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (i: CartItem) =>
            i?.product?.id &&
            Number.isInteger(i.quantity) &&
            i.quantity > 0 &&
            i.quantity <= 50,
        )
      : [];
  } catch {
    return [];
  }
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    user: null,
    demoEnabled: false,
    cardEnabled: false,
  });
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>(catalog);
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((message: string) => {
    setNotice(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4200);
  }, []);
  const reload = useCallback(async () => {
    try {
      const data = await api<{ products: Product[] }>("/products");
      setProducts(data.products);
      setCatalogError("");
    } catch (e) {
      setCatalogError(
        e instanceof Error ? e.message : "Could not load products.",
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Session>("/session")
      .then((s) => {
        if (active) setSession(s);
      })
      .catch(() => {
        if (active)
          setCatalogError(
            "We could not connect to the store. Please refresh to try again.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    // This callback only updates state after an asynchronous network request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reload]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem("instantmart-cart", JSON.stringify(cart));
      } catch {
        /* The cart remains usable without persistence. */
      }
  }, [cart, hydrated]);
  const add = (p: Product) => {
    if (!p.stock) {
      toast("This product is currently sold out.");
      return;
    }
    setCart((current) => {
      const item = current.find((i) => i.product.id === p.id);
      return item
        ? current.map((i) =>
            i.product.id === p.id
              ? { product: p, quantity: Math.min(i.quantity + 1, p.stock, 50) }
              : i,
          )
        : [...current, { product: p, quantity: 1 }];
    });
    toast(`${p.name} added to your basket.`);
  };
  const quantity = (id: string, n: number) =>
    setCart((current) =>
      current.flatMap((i) =>
        i.product.id === id
          ? n <= 0
            ? []
            : [{ ...i, quantity: Math.min(50, n, i.product.stock) }]
          : [i],
      ),
    );
  const authenticate = async (
    action: "login" | "register",
    data: Record<string, string>,
  ) => {
    const { user } = await api<{ user: User }>(`/auth/${action}`, "POST", data);
    setSession((s) => ({ ...s, user }));
    setAuthOpen(false);
    await reload();
    return user;
  };
  const demo = async (role: Role) => {
    const { user } = await api<{ user: User }>("/auth/demo", "POST", { role });
    setSession((s) => ({ ...s, user }));
    setAuthOpen(false);
    await reload();
    return user;
  };
  const logout = async () => {
    await api("/auth/logout", "POST", {});
    setSession((s) => ({ ...s, user: null }));
    await reload();
    toast("You have been signed out.");
  };
  return (
    <StoreContext.Provider
      value={{
        session,
        ready,
        products,
        catalogError,
        cart: hydrated ? cart : [],
        toast,
        add,
        quantity,
        clear: () => setCart([]),
        reload,
        authenticate,
        demo,
        logout,
        authOpen,
        setAuthOpen,
      }}
    >
      {children}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </StoreContext.Provider>
  );
}
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("StoreProvider is missing.");
  return context;
}
