import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ pathname: vi.fn(), script: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("next/script", () => ({ default: (props: object) => { mocks.script(props); return null; } }));
import { GoogleAdsScripts } from "./google-ads-scripts";

beforeEach(() => vi.resetAllMocks());
describe("Google Ads script privacy", () => {
  it("does not load tracking scripts on private calendar links", () => {
    mocks.pathname.mockReturnValue(`/calendar/${"a".repeat(22)}`);
    render(<GoogleAdsScripts conversionId="AW-000000000" />);
    expect(mocks.script).not.toHaveBeenCalled();
  });
  it("preserves Google Ads setup on public catalogue pages", () => {
    mocks.pathname.mockReturnValue("/packages");
    render(<GoogleAdsScripts conversionId="AW-000000000" />);
    expect(mocks.script).toHaveBeenCalledTimes(2);
    expect(mocks.script).toHaveBeenCalledWith(expect.objectContaining({
      src: "https://www.googletagmanager.com/gtag/js?id=AW-000000000", strategy: "afterInteractive",
    }));
    expect(mocks.script).toHaveBeenCalledWith(expect.objectContaining({
      id: "google-ads-gtag", children: expect.stringContaining("gtag('config', \"AW-000000000\")"),
    }));
  });
  it("remains disabled when no conversion ID is configured", () => {
    mocks.pathname.mockReturnValue("/");
    render(<GoogleAdsScripts conversionId="" />);
    expect(mocks.script).not.toHaveBeenCalled();
  });
});
