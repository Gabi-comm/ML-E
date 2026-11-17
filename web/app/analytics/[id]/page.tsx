import { Suspense } from "react";
import Report from "@/components/analytics/Report";

// Report ids are only known at request time, so this page cannot be prepared in advance.
export const instant = false;

export default function ReportPage({ params }: PageProps<"/analytics/[id]">) {
  return (
    <Suspense fallback={<p className="label p-8">Loading report…</p>}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Report id={id} />;
}
