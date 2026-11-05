import { describe, expect, it, vi } from "vitest";

import { purgeExpiredCustomerEmailHistory, recordCustomerEmail, removeCustomerEmailAttachments } from "./email-log";

describe("customer email attachment storage", () => {
  it("stores attachment files privately and records their metadata", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnThis();
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq: updateEq });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn()
        .mockReturnValueOnce({ insert })
        .mockReturnValueOnce({ update }),
      storage: { from: vi.fn().mockReturnValue({ upload, remove }) },
    };

    await recordCustomerEmail(admin as never, {
      bookingId: "booking-1",
      recipientEmail: "customer@example.invalid",
      emailType: "invoice",
      providerMessageId: "provider-1",
      attachments: [{ filename: "invoice.pdf", content: Buffer.from("%PDF-test") }],
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      booking_id: "booking-1",
      email_type: "invoice",
      provider_message_id: "provider-1",
      attachments_archived: false,
    }));
    const uploadedPath = upload.mock.calls[0][0] as string;
    expect(uploadedPath).toMatch(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\/0-invoice\.pdf$/);
    expect(upload).toHaveBeenCalledWith(uploadedPath, Buffer.from("%PDF-test"), {
      contentType: "application/pdf",
      upsert: false,
    });
    expect(update).toHaveBeenCalledWith({
      attachments: [{
        filename: "invoice.pdf",
        storage_path: uploadedPath,
        content_type: "application/pdf",
        size: Buffer.byteLength("%PDF-test"),
      }],
      attachments_archived: true,
    });
    expect(updateEq).toHaveBeenCalledWith("id", uploadedPath.split("/")[0]);
  });

  it("removes stored files when a booking is deleted", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ attachments: [{ storage_path: "email-1/0-invoice.pdf" }] }, { attachments: [] }],
        error: null,
      }),
    };
    const admin = { from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue({ remove }) } };

    await removeCustomerEmailAttachments(admin as never, "booking-1");

    expect(query.eq).toHaveBeenCalledWith("booking_id", "booking-1");
    expect(remove).toHaveBeenCalledWith(["email-1/0-invoice.pdf"]);
  });

  it("removes expired attachment files before deleting their email history", async () => {
    const cutoff = "2026-10-06T00:00:00.000Z";
    const read = {
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: "email-1", attachments: [{ storage_path: "email-1/0-invoice.pdf" }] }],
        error: null,
      }),
    };
    const remove = vi.fn().mockResolvedValue({ error: null });
    const deletion = { delete: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ error: null }) };
    const admin = {
      from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(deletion),
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    };

    await expect(purgeExpiredCustomerEmailHistory(admin as never, new Date("2026-11-05T00:00:00.000Z"))).resolves.toBe(1);

    expect(read.lt).toHaveBeenCalledWith("sent_at", cutoff);
    expect(remove).toHaveBeenCalledWith(["email-1/0-invoice.pdf"]);
    expect(deletion.in).toHaveBeenCalledWith("id", ["email-1"]);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(deletion.delete.mock.invocationCallOrder[0]);
  });
});
