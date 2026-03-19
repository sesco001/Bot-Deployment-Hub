import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
      <AlertCircle className="w-20 h-20 text-destructive mb-6" />
      <h1 className="text-4xl font-display font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-muted-foreground text-lg mb-8 max-w-md">
        The sector of the digital business center you are looking for does not exist or has been relocated.
      </p>
      <Link href="/" className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors">
        Return to Base
      </Link>
    </div>
  );
}
