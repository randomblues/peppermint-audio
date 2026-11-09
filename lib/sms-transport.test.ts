import { describe, expect, it, vi } from "vitest";
import { SmsTransport } from "./sms-transport";
import type { SmsProvider } from "./sms-provider-types";

const message = { to: "+61412345678", body: "Your booking is confirmed." };

function providerStub(): SmsProvider {
  return { send: vi.fn().mockResolvedValue({ id: "provider-message-id" }) };
}

describe("provider-neutral SMS transport", () => {
  it("validates and delegates a message through the injected provider", async () => {
    const provider = providerStub();
    const transport = new SmsTransport(provider);

    await expect(transport.send(message)).resolves.toEqual({ id: "provider-message-id" });
    expect(provider.send).toHaveBeenCalledWith(message, undefined);
  });

  it.each([
    { to: "0412345678", body: "Test" },
    { to: "+61412345678", body: " " },
  ])("rejects invalid SMS input without calling the provider", async (invalidMessage) => {
    const provider = providerStub();
    const transport = new SmsTransport(provider);

    await expect(transport.send(invalidMessage)).rejects.toThrow();
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("surfaces provider delivery errors", async () => {
    const provider: SmsProvider = {
      send: vi.fn().mockRejectedValue(new Error("delivery failed")),
    };
    const transport = new SmsTransport(provider);

    await expect(transport.send(message)).rejects.toThrow("delivery failed");
  });
});
