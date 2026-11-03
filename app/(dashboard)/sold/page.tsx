import type { Metadata } from "next";
import { SaleForm } from "@/components/sold/SaleForm";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "SOLD!!! — Sale Submission",
};

/** Sale form at /sold. Submit is mocked until Django sold APIs exist. */
export default async function SoldPage() {
  const user = await getSessionUser();
  return <SaleForm me={{ email: user?.email ?? "", rep: null }} />;
}
