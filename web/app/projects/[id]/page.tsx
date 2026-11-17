import { Suspense } from "react";
import Workspace from "@/components/projects/Workspace";

// Project ids are only known at request time, so this page cannot be prepared in advance.
export const instant = false;

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Suspense fallback={<p className="label p-8">Loading project…</p>}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Workspace id={id} />;
}
