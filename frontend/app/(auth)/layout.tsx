export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">TradeWise AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligent Trading Assistant
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
