// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ProductCard, Quantity, ErrorMessage } from "../components/store/ui";
import { catalog } from "../lib/catalog";
const add = vi.fn(),
  quantity = vi.fn();
vi.mock("../components/store/provider", () => ({
  useStore: () => ({ add, quantity, cart: [] }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Storefront controls", () => {
  it("adds the selected product through an accessible control", () => {
    render(<ProductCard product={catalog[0]} />);
    fireEvent.click(
      screen.getByRole("button", { name: `Add ${catalog[0].name} to cart` }),
    );
    expect(add).toHaveBeenCalledWith(catalog[0]);
    expect(
      screen.getByRole("link", { name: `View ${catalog[0].name}` }),
    ).toHaveAttribute("href", "/products/" + catalog[0].id);
  });
  it("disables add to basket for sold-out products", () => {
    render(<ProductCard product={{ ...catalog[0], stock: 0 }} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText("Sold out")).toBeVisible();
  });
  it("supports independently labelled quantity controls", () => {
    const change = vi.fn();
    render(<Quantity id="Apples" value={2} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Add one Apples" }));
    expect(change).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Remove one Apples" }));
    expect(change).toHaveBeenLastCalledWith(1);
  });
  it("announces actionable error messages to assistive technology", () => {
    render(<ErrorMessage message="This product is out of stock." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This product is out of stock.",
    );
  });
});
