export default function ReceivePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-primary-light">Trakie</h1>
        <span className="text-sm text-text-secondary">Inventory Receiving</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-card border border-border">
            <span className="text-2xl">📦</span>
          </div>
          <h2 className="text-xl font-semibold">Inventory Receiving</h2>
          <p className="max-w-xs text-sm text-text-secondary">
            Scan the QR code from your Trakie extension to pair this device and
            start receiving inventory.
          </p>
        </div>
      </main>
    </div>
  );
}
