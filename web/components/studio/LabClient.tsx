"use client";

import dynamic from "next/dynamic";

// The Lab remembers the last lesson in this browser, so it renders on the client only.
const Lab = dynamic(() => import("./Lab"), {
  ssr: false,
  loading: () => <p className="label p-4">Loading the Lab…</p>,
});

export default function LabClient() {
  return <Lab />;
}
