import { PolicyPage } from "@/components/policy-page";
import { createPageMetadata } from "@/lib/seo";
import { business, privacyPolicy } from "@/lib/site-content";

export const metadata = createPageMetadata({
  title: privacyPolicy.title,
  description: privacyPolicy.introduction,
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage {...privacyPolicy}>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <a href={`mailto:${business.email}`} className="inline-flex min-h-11 items-center break-all rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{business.email}</a>
        <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="inline-flex min-h-11 items-center rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{business.phone}</a>
      </div>
    </PolicyPage>
  );
}
