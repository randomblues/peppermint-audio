/// <reference types="@testing-library/jest-dom" />
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";
import { Button } from "./button";

describe("Button primitive", () => {
  it("uses pointer affordances for enabled and disabled states", () => {
    render(
      <>
        <Button>Continue</Button>
        <Button disabled>Disabled</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("cursor-pointer");
    const disabledButton = screen.getByRole("button", { name: "Disabled" });
    expect(disabledButton).toBeDisabled();
    expect(disabledButton).toHaveClass("disabled:cursor-not-allowed");
  });
});

describe("Select primitive", () => {
  it("opens, selects an item, and renders grouped content", async () => {
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Package">
          <SelectValue placeholder="Choose a package" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Packages</SelectLabel>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectSeparator />
            <SelectItem value="big">Big</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Package" }));
    expect(await screen.findByRole("option", { name: "Standard" })).toBeInTheDocument();
    const bigOption = screen.getByRole("option", { name: "Big" });
    fireEvent.pointerDown(bigOption);
    fireEvent.pointerUp(bigOption);
    fireEvent.click(bigOption);
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("big", expect.anything()));
  });
});

describe("Sheet primitive", () => {
  it("opens and closes content, including the optional close button", async () => {
    render(
      <Sheet>
        <SheetTrigger>Open details</SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
            <SheetDescription>Additional information</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(await screen.findByRole("heading", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByText("Additional information")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Details" })).not.toBeInTheDocument());
  });
});

describe("Navigation menu primitive", () => {
  it("opens a menu and exposes its link", async () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/faq">FAQ</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Resources/ }));
    const link = await screen.findByRole("link", { name: "FAQ" });
    expect(link).toHaveAttribute("href", "/faq");
    fireEvent.click(screen.getByRole("button", { name: /Resources/ }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "FAQ" })).not.toBeInTheDocument());
  });
});
