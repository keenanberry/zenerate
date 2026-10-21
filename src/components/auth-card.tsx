import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** The single 28rem card the login and password pages share. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-3 text-center">
          <Link href="/" className="mb-3 inline-flex flex-col items-center gap-3 justify-self-center">
            <BrandMark className="size-16 text-primary" />
            <span className="text-2xl font-bold tracking-tight">zenerate</span>
          </Link>
          <CardTitle className="font-serif text-xl font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
