import { redirect } from "next/navigation";
import { getCurrentUserAction } from "@/app/_actions/auth";

export default async function HomePage() {
  const user = await getCurrentUserAction();
  if (!user) redirect("/login");
  // Mirrors previous client behavior: falsy pos_cashier flag → back office.
  const posCashier = (user as unknown as { pos_cashier?: boolean }).pos_cashier;
  redirect(posCashier ? "/pos" : "/manage");
}
